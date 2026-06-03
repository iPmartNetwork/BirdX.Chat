function registerProfileRoutes(app, deps) {
  const {
    ALLOWED_AVATAR_MIME_TYPES,
    AVATAR_FILE_LIMITS,
    createMessage,
    emitChatEvent,
    emitSseEvent,
    FILE_UPLOAD,
    getUserPresence,
    listChatMembers,
    listChatsForUser,
    USER_COLORS,
    NICKNAME_MAX,
    USERNAME_MAX,
    USERNAME_REGEX,
    bcrypt,
    ensureAvatarExists,
    findChatByGroupUsername,
    findUserById,
    findUserByUsername,
    deleteUserById,
    hasEnoughFreeDiskSpace,
    avatarUploadRootDir,
    clearSessionCookie,
    removeAvatarByUrl,
    removeStoredFileNames,
    removeUploadedFiles,
    requireSession,
    requireSessionUsernameMatch,
    updateUserPassword,
    updateUserProfile,
    updateUserStatus,
    uploadAvatar,
    listSessionsForUser,
    deleteSessionByIdForUser,
    deleteOtherSessionsForUser,
    updateUserNotificationPrefs,
    updateUserUiAccent,
    parseCookies,
    getSession,
  } = deps;

  const emitPresenceUpdate = (user) => {
    if (!user?.username) return;
    const normalizedUsername = String(user.username || "").toLowerCase();
    const payload = {
      type: "presence_update",
      username: normalizedUsername,
      status: String(user.status || "online").toLowerCase(),
      lastSeen: user.last_seen || new Date().toISOString(),
    };
    const targets = new Set([normalizedUsername]);
    const chats = listChatsForUser(Number(user.id || 0));
    chats.forEach((chat) => {
      const members = listChatMembers(Number(chat?.id || 0));
      members.forEach((member) => {
        const memberUsername = String(member?.username || "").toLowerCase();
        if (memberUsername) targets.add(memberUsername);
      });
    });
    targets.forEach((targetUsername) => {
      emitSseEvent(targetUsername, payload);
    });
  };

  app.get("/api/profile", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({
      id: user.id,
      username: user.username,
      nickname: user.nickname || null,
      avatarUrl: ensureAvatarExists(user.id, user.avatar_url) || null,
      color: user.color || USER_COLORS[0],
      status: user.status || "online",
    });
  });

  app.put("/api/profile", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { currentUsername, username, nickname, avatarUrl } = req.body || {};
    if (!currentUsername || !username) {
      return res
        .status(400)
        .json({ error: "Current username and new username are required." });
    }

    const currentUser = findUserByUsername(currentUsername.toLowerCase());
    if (!currentUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!requireSessionUsernameMatch(res, session, currentUsername)) return;

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

    if (trimmed !== currentUser.username) {
      const existing = findUserByUsername(trimmed);
      if (existing) {
        return res.status(409).json({ error: "Username already exists." });
      }
      if (findChatByGroupUsername && findChatByGroupUsername(trimmed)) {
        return res.status(409).json({ error: "Username already exists." });
      }
    }

    const nextAvatarUrl = String(avatarUrl || "").trim() || null;
    const currentAvatarUrl = String(currentUser.avatar_url || "").trim() || null;
    if (currentAvatarUrl && currentAvatarUrl !== nextAvatarUrl) {
      removeAvatarByUrl(currentAvatarUrl);
    }

    updateUserProfile(
      currentUser.id,
      trimmed,
      nickname?.trim() || null,
      nextAvatarUrl,
    );

    const updated = findUserById(currentUser.id);

    res.json({
      id: updated.id,
      username: updated.username,
      nickname: updated.nickname || null,
      avatarUrl: ensureAvatarExists(updated.id, updated.avatar_url) || null,
      color: updated.color || USER_COLORS[0],
      status: updated.status || "online",
    });
  });

  app.post("/api/profile/avatar", uploadAvatar.single("avatar"), (req, res) => {
    const session = requireSession(req, res);
    if (!session) {
      removeUploadedFiles(req.file ? [req.file] : [], avatarUploadRootDir);
      return;
    }

    const currentUsername = String(req.body?.currentUsername || "")
      .trim()
      .toLowerCase();
    const file = req.file;

    if (!FILE_UPLOAD) {
      removeUploadedFiles(file ? [file] : [], avatarUploadRootDir);
      return res
        .status(503)
        .json({ error: "File uploads are disabled on this server." });
    }

    if (!currentUsername) {
      removeUploadedFiles(file ? [file] : [], avatarUploadRootDir);
      return res.status(400).json({ error: "Current username is required." });
    }

    if (!requireSessionUsernameMatch(res, session, currentUsername)) {
      removeUploadedFiles(file ? [file] : [], avatarUploadRootDir);
      return;
    }

    const user = findUserByUsername(currentUsername);
    if (!user) {
      removeUploadedFiles(file ? [file] : [], avatarUploadRootDir);
      return res.status(404).json({ error: "User not found." });
    }

    if (!file) {
      return res.status(400).json({ error: "Avatar file is required." });
    }

    const avatarMime = String(file.mimetype || "").toLowerCase();
    if (!ALLOWED_AVATAR_MIME_TYPES.has(avatarMime)) {
      removeUploadedFiles([file], avatarUploadRootDir);
      return res
        .status(400)
        .json({ error: "Avatar must be a JPEG, PNG, GIF, WEBP, or BMP image." });
    }

    if (!hasEnoughFreeDiskSpace(Number(file.size || 0))) {
      removeUploadedFiles([file], avatarUploadRootDir);

      return res
        .status(400)
        .json({ error: "Not enough free storage space on server." });
    }

    const avatarUrl = `/api/uploads/avatars/${file.filename}`;
    if (String(user.avatar_url || "").trim() && user.avatar_url !== avatarUrl) {
      removeAvatarByUrl(user.avatar_url);
    }

    updateUserProfile(
      user.id,
      user.username,
      user.nickname || null,
      avatarUrl,
    );

    const updated = findUserById(user.id);

    return res.json({
      avatarUrl: ensureAvatarExists(updated.id, updated.avatar_url) || avatarUrl,
      sizeBytes: Number(file.size || 0),
      maxFileSizeBytes: AVATAR_FILE_LIMITS.maxFileSizeBytes,
    });
  });

  app.put("/api/password", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, currentPassword, newPassword } = req.body || {};
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Username, current password, and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    updateUserPassword(user.id, passwordHash);

    res.json({ ok: true });
  });

  app.put("/api/status", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, status } = req.body || {};
    if (!username || !status) {
      return res.status(400).json({ error: "Username and status are required." });
    }

    const allowed = new Set(["online", "invisible"]);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    updateUserStatus(user.id, status);
    const refreshedUser = getUserPresence(String(user.username || "").toLowerCase());
    if (refreshedUser) {
      emitPresenceUpdate(refreshedUser);
    }

    res.json({ ok: true, status });
  });

  app.post("/api/profile/delete", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (user.avatar_url) {
      removeAvatarByUrl(user.avatar_url);
    }

    const memberChats = listChatsForUser(Number(user.id || 0));
    memberChats.forEach((chat) => {
      const chatId = Number(chat?.id || 0);
      if (!chatId) return;
      const label = user.nickname || user.username;
      if (String(chat?.type || "").toLowerCase() === "group") {
        createMessage(chatId, user.id, `[[system:left:${label}]]`);
        emitChatEvent(chatId, {
          type: "chat_message",
          chatId,
          username: user.username,
          body: `[[system:left:${label}]]`,
        });
      }
      const members = listChatMembers(chatId);
      members.forEach((member) => {
        const memberUsername = String(member?.username || "").toLowerCase();
        if (!memberUsername || memberUsername === String(user.username || "").toLowerCase())
          return;
        try {
          emitSseEvent(memberUsername, { type: "chat_list_changed", chatId });
        } catch {
          // ignore realtime list errors
        }
      });
    });

    const { storedNames } = deleteUserById(Number(user.id));
    if (Array.isArray(storedNames) && storedNames.length) {
      removeStoredFileNames(storedNames);
    }

    clearSessionCookie(req, res);
    return res.json({ ok: true });
  });

  // ─── Two-Factor Authentication (2FA / TOTP) ──────────────────────────────────
  const {
    adminGetRow: totpGetRow,
    adminRun: totpRun,
    adminSave: totpSave,
    adminGetAll: totpGetAll,
  } = deps;

  app.get("/api/2fa/status", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const row = totpGetRow?.("SELECT enabled, created_at FROM user_totp WHERE user_id = ?", [session.id]);
    res.json({
      ok: true,
      enabled: Boolean(row && Number(row.enabled || 0)),
      createdAt: row?.created_at || null,
    });
  });

  app.post("/api/2fa/setup", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { generateSecret, buildTotpUri, generateBackupCodes } = await import("../lib/totp.js");

    const existing = totpGetRow?.(
      "SELECT secret, backup_codes, enabled FROM user_totp WHERE user_id = ?",
      [session.id],
    );
    if (existing && Number(existing.enabled || 0)) {
      return res.status(400).json({ error: "2FA is already enabled. Disable it first." });
    }

    if (existing?.secret && !Number(existing.enabled || 0)) {
      let backupCodes = [];
      try {
        backupCodes = JSON.parse(existing.backup_codes || "[]");
      } catch {
        backupCodes = [];
      }
      const uri = buildTotpUri(existing.secret, session.username);
      return res.json({
        ok: true,
        secret: existing.secret,
        uri,
        backupCodes,
        resumed: true,
      });
    }

    const secret = generateSecret();
    const backupCodes = generateBackupCodes(8);
    const uri = buildTotpUri(secret, session.username);

    totpRun?.(
      `INSERT INTO user_totp (user_id, secret, backup_codes, enabled, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET secret = excluded.secret, backup_codes = excluded.backup_codes, enabled = 0, created_at = datetime('now')`,
      [session.id, secret, JSON.stringify(backupCodes)],
    );
    totpSave?.();

    res.json({ ok: true, secret, uri, backupCodes, resumed: false });
  });

  app.post("/api/2fa/verify-setup", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { verifyTOTP, normalizeTotpToken } = await import("../lib/totp.js");
    const token = normalizeTotpToken(req.body?.token);
    if (!token) {
      return res.status(400).json({ error: "A 6-digit code is required." });
    }

    const row = totpGetRow?.("SELECT secret, enabled FROM user_totp WHERE user_id = ?", [session.id]);
    if (!row?.secret) {
      return res.status(400).json({ error: "No 2FA setup found. Start setup first." });
    }
    if (Number(row.enabled || 0)) {
      return res.status(400).json({ error: "2FA is already enabled." });
    }

    if (!verifyTOTP(row.secret, token)) {
      return res.status(400).json({
        error: "Invalid code. Check your authenticator time sync and try a fresh code.",
      });
    }

    totpRun?.("UPDATE user_totp SET enabled = 1 WHERE user_id = ?", [session.id]);
    totpSave?.();

    res.json({ ok: true, message: "2FA enabled successfully." });
  });

  app.post("/api/2fa/cancel-setup", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    totpRun?.("DELETE FROM user_totp WHERE user_id = ? AND COALESCE(enabled, 0) = 0", [
      session.id,
    ]);
    totpSave?.();
    res.json({ ok: true });
  });

  app.post("/api/2fa/disable", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const password = String(req.body?.password || "");
    if (!password) {
      return res.status(400).json({ error: "Password is required to disable 2FA." });
    }

    const user = findUserByUsername(session.username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(403).json({ error: "Invalid password." });
    }

    totpRun?.("DELETE FROM user_totp WHERE user_id = ?", [session.id]);
    totpSave?.();

    res.json({ ok: true, message: "2FA disabled." });
  });

  app.get("/api/2fa/backup-codes", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const row = totpGetRow?.("SELECT backup_codes, enabled FROM user_totp WHERE user_id = ?", [session.id]);
    if (!row || !Number(row.enabled || 0)) {
      return res.status(400).json({ error: "2FA is not enabled." });
    }

    let codes = [];
    try {
      codes = JSON.parse(row.backup_codes || "[]");
    } catch {
      codes = [];
    }

    res.json({ ok: true, backupCodes: codes });
  });

  app.get("/api/sessions", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query?.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const cookies = parseCookies?.(req) || {};
    const currentToken = String(cookies.sid || session.token || "").trim();
    const rows = listSessionsForUser(user.id).map((row) => ({
      id: Number(row.id),
      ipAddress: row.ip_address || null,
      userAgent: row.user_agent || null,
      createdAt: row.created_at,
      lastSeen: row.last_seen,
      isCurrent: String(row.token || "") === currentToken,
    }));

    return res.json({ sessions: rows });
  });

  app.delete("/api/sessions/others", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.body?.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const cookies = parseCookies?.(req) || {};
    const currentToken = String(cookies.sid || session.token || "").trim();
    deleteOtherSessionsForUser(user.id, currentToken);
    return res.json({ ok: true });
  });

  app.delete("/api/sessions/:sessionId", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const sessionId = Number(req.params?.sessionId || 0);
    const username = req.body?.username?.toString() || req.query?.username?.toString();
    if (!sessionId || !username) {
      return res.status(400).json({ error: "Session id and username are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    deleteSessionByIdForUser(sessionId, user.id);
    return res.json({ ok: true });
  });

  app.put("/api/notification-prefs", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.body?.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    updateUserNotificationPrefs(user.id, {
      dndUntil: Object.prototype.hasOwnProperty.call(req.body || {}, "dndUntil")
        ? req.body.dndUntil
        : undefined,
      notificationsPaused: Object.prototype.hasOwnProperty.call(
        req.body || {},
        "notificationsPaused",
      )
        ? Boolean(req.body.notificationsPaused)
        : undefined,
    });

    const refreshed = findUserById(user.id) || user;
    return res.json({
      ok: true,
      dndUntil: refreshed?.dnd_until || null,
      notificationsPaused: Boolean(Number(refreshed?.notifications_paused || 0)),
    });
  });

  app.put("/api/profile/ui-prefs", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.body?.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const accent = Object.prototype.hasOwnProperty.call(req.body || {}, "uiAccentColor")
      ? req.body.uiAccentColor
      : req.body.accentColor;

    if (!/^#[0-9a-fA-F]{6}$/.test(String(accent || "").trim()) && accent !== null && accent !== "") {
      return res.status(400).json({ error: "Accent color must be a hex value like #10b981." });
    }

    updateUserUiAccent?.(user.id, accent || null);
    const refreshed = findUserById(user.id) || user;
    return res.json({
      ok: true,
      uiAccentColor: refreshed?.ui_accent_color || null,
    });
  });
}

export { registerProfileRoutes };
