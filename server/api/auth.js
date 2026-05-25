function registerAuthRoutes(app, deps) {
  const {
    USER_COLORS,
    NICKNAME_MAX,
    USERNAME_MAX,
    USERNAME_REGEX,
    ACCOUNT_CREATION,
    ADMIN_USERNAMES = [],
    adminRun,
    adminSave,
    applyRequiredChannelsToUser,
    bcrypt,
    clearSessionCookie,
    createSession,
    createUser,
    crypto,
    deleteSession,
    ensureAvatarExists,
    findChatByGroupUsername,
    findUserByUsername,
    parseCookies,
    setSessionCookie,
    setUserColor,
    updateLastSeen,
    getSessionFromRequest,
  } = deps;

  const getRequestIp = (req) =>
    String(
      req.headers?.["x-forwarded-for"] ||
        req.headers?.["x-real-ip"] ||
        req.socket?.remoteAddress ||
        req.ip ||
        "",
    )
      .split(",")[0]
      .trim();

  const getSessionMetadata = (req) => ({
    ipAddress: getRequestIp(req),
    userAgent: String(req.headers?.["user-agent"] || "").slice(0, 500),
  });

  const recordSecurityEvent = (req, type, details = {}) => {
    try {
      adminRun?.(
        `INSERT INTO security_events (type, username, user_id, ip_address, user_agent, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(type || ""),
          String(details.username || "").trim().toLowerCase() || null,
          Number(details.userId || 0) || null,
          getRequestIp(req),
          String(req.headers?.["user-agent"] || "").slice(0, 500),
          JSON.stringify(details),
        ],
      );
      adminSave?.();
    } catch (error) {
      console.warn("[security] event log failed:", String(error?.message || error));
    }
  };

  app.post("/api/register", (req, res) => {
    if (!ACCOUNT_CREATION) {
      return res.status(403).json({ error: "Account creation is disabled." });
    }
    const { username, password, nickname, avatarUrl } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const trimmed = username.trim().toLowerCase();

    if (trimmed.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters." });
    }
    if (USERNAME_MAX && trimmed.length > USERNAME_MAX) {
      return res.status(400).json({
        error: `Username must be at most ${USERNAME_MAX} characters.`,
      });
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      return res.status(400).json({
        error:
          "Username can only include english letters, numbers, dot (.), and underscore (_).",
      });
    }
    if (nickname && String(nickname).trim().length > (NICKNAME_MAX || 0)) {
      return res.status(400).json({
        error: `Nickname must be at most ${NICKNAME_MAX} characters.`,
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const existing = findUserByUsername(trimmed);
    if (existing) {
      return res.status(409).json({ error: "Username already exists." });
    }
    if (findChatByGroupUsername && findChatByGroupUsername(trimmed)) {
      return res.status(409).json({ error: "Username already exists." });
    }

    const assignedColor = setUserColor();
    const passwordHash = bcrypt.hashSync(password, 10);

    const id = createUser(
      trimmed,
      passwordHash,
      nickname?.trim() || null,
      avatarUrl?.trim() || null,
      assignedColor,
    );

    const token = crypto.randomBytes(24).toString("hex");

    createSession(id, token, getSessionMetadata(req));
    const requiredChannelMemberships = applyRequiredChannelsToUser?.(id) || 0;
    setSessionCookie(req, res, token);

    return res.json({
      id,
      username: trimmed,
      nickname: nickname?.trim() || null,
      avatarUrl: ensureAvatarExists(id, avatarUrl?.trim()) || null,
      color: assignedColor,
      status: "online",
      role: "user",
      isAdmin: ADMIN_USERNAMES.includes(trimmed),
      requiredChannelMemberships,
    });
  });

  app.post("/api/login", async (req, res) => {
    try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const trimmed = username.trim().toLowerCase();
    const user = findUserByUsername(trimmed);

    if (user?.banned) {
      recordSecurityEvent(req, "login.banned", {
        username: trimmed,
        userId: user.id,
      });
      return res.status(403).json({ error: "Account is banned." });
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      recordSecurityEvent(req, "login.failed", {
        username: trimmed,
        userId: user?.id || null,
        reason: "invalid_credentials",
      });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Check if 2FA is enabled for this user
    const { adminGetRow: authGetRow } = deps;
    let totpRow = null;
    try {
      totpRow = authGetRow?.("SELECT enabled, secret, backup_codes FROM user_totp WHERE user_id = ? AND enabled = 1", [user.id]);
    } catch { /* table might not exist yet */ }
    if (totpRow && Number(totpRow.enabled || 0)) {
      const totpToken = String(req.body?.totpToken || "").trim();
      if (!totpToken) {
        return res.status(200).json({
          requires2FA: true,
          userId: user.id,
          message: "Two-factor authentication code required.",
        });
      }
      const { verifyTOTP } = await import("../lib/totp.js");
      let valid = verifyTOTP(totpRow.secret, totpToken);

      if (!valid) {
        let backupCodes = [];
        try { backupCodes = JSON.parse(totpRow.backup_codes || "[]"); } catch { backupCodes = []; }
        const normalizedToken = totpToken.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        const codeIndex = backupCodes.findIndex((c) => c === normalizedToken);
        if (codeIndex >= 0) {
          valid = true;
          backupCodes.splice(codeIndex, 1);
          const { adminRun: authRun, adminSave: authSave } = deps;
          authRun?.("UPDATE user_totp SET backup_codes = ? WHERE user_id = ?", [JSON.stringify(backupCodes), user.id]);
          authSave?.();
        }
      }

      if (!valid) {
        recordSecurityEvent(req, "login.2fa_failed", {
          username: trimmed,
          userId: user.id,
        });
        return res.status(401).json({ error: "Invalid 2FA code.", requires2FA: true });
      }
    }

    updateLastSeen(user.id);

    const token = crypto.randomBytes(24).toString("hex");

    createSession(user.id, token, getSessionMetadata(req));
    setSessionCookie(req, res, token);

    return res.json({
      id: user.id,
      username: user.username,
      nickname: user.nickname || null,
      avatarUrl: ensureAvatarExists(user.id, user.avatar_url) || null,
      color: user.color || USER_COLORS[0],
      status: user.status || "online",
      role: user.role || "user",
      isAdmin:
        ["owner", "admin", "moderator", "support"].includes(
          String(user.role || "").toLowerCase(),
        ) ||
        ADMIN_USERNAMES.includes(String(user.username || "").toLowerCase()),
    });
    } catch (err) {
      console.error("[login] unexpected error:", err?.message || err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Login failed. Please try again." });
      }
    }
  });

  app.get("/api/me", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    res.json({
      id: session.id,
      username: session.username,
      nickname: session.nickname || null,
      avatarUrl: ensureAvatarExists(session.id, session.avatar_url) || null,
      color: session.color || USER_COLORS[0],
      status: session.status || "online",
      role: session.role || "user",
      fileUploadMaxSizeBytes: Number(session.file_upload_max_size_bytes || 0) || null,
      isAdmin:
        ["owner", "admin", "moderator", "support"].includes(
          String(session.role || "").toLowerCase(),
        ) ||
        ADMIN_USERNAMES.includes(String(session.username || "").toLowerCase()),
    });
  });

  app.post("/api/logout", (req, res) => {
    const cookies = parseCookies(req);

    if (cookies.sid) {
      deleteSession(cookies.sid);
    }

    clearSessionCookie(req, res);

    res.json({ ok: true });
  });
}

export { registerAuthRoutes };
