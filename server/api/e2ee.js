/**
 * E2EE Key Exchange API
 *
 * Implements the server-side of X3DH (Extended Triple Diffie-Hellman) key agreement.
 * The server stores public keys and facilitates key bundles for session establishment.
 * Private keys NEVER leave the client.
 */

function registerE2eeRoutes(app, deps) {
  const {
    adminGetAll,
    adminGetRow,
    adminRun,
    adminSave,
    requireSession,
    requireSessionUsernameMatch,
    findUserByUsername,
    findUserById,
    isMember,
    isGroupE2eeEnabled,
    setGroupE2eeEnabled,
    upsertGroupE2eeWrappedKey,
    listGroupE2eeWrappedKeys,
    getGroupE2eeWrappedKey,
    getChatMemberRole,
  } = deps;

  /**
   * Upload identity key + signed prekey + one-time prekeys
   * Called once when user first enables E2EE, or when replenishing prekeys.
   */
  app.post("/api/e2ee/keys/upload", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, identityKey, signedPreKey, oneTimePreKeys } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const userId = Number(user.id);

    // Store identity key (upsert)
    if (identityKey && typeof identityKey === "string") {
      const existing = adminGetRow(
        "SELECT user_id FROM e2ee_identity_keys WHERE user_id = ?",
        [userId],
      );
      if (existing) {
        adminRun(
          "UPDATE e2ee_identity_keys SET public_key = ? WHERE user_id = ?",
          [identityKey, userId],
        );
      } else {
        adminRun(
          "INSERT INTO e2ee_identity_keys (user_id, public_key) VALUES (?, ?)",
          [userId, identityKey],
        );
      }
    }

    // Store signed prekey (replace latest)
    if (signedPreKey && typeof signedPreKey === "object") {
      const { keyId, publicKey, signature } = signedPreKey;
      if (keyId !== undefined && publicKey && signature) {
        // Remove old signed prekeys for this user
        adminRun("DELETE FROM e2ee_signed_prekeys WHERE user_id = ?", [userId]);
        adminRun(
          `INSERT INTO e2ee_signed_prekeys (user_id, key_id, public_key, signature)
           VALUES (?, ?, ?, ?)`,
          [userId, Number(keyId), String(publicKey), String(signature)],
        );
      }
    }

    // Store one-time prekeys (append)
    if (Array.isArray(oneTimePreKeys) && oneTimePreKeys.length > 0) {
      const validKeys = oneTimePreKeys
        .filter((k) => k && typeof k === "object" && k.keyId !== undefined && k.publicKey)
        .slice(0, 100); // Max 100 at a time

      for (const key of validKeys) {
        adminRun(
          `INSERT INTO e2ee_one_time_prekeys (user_id, key_id, public_key)
           VALUES (?, ?, ?)`,
          [userId, Number(key.keyId), String(key.publicKey)],
        );
      }
    }

    adminSave();

    const remainingPreKeys = Number(
      adminGetRow(
        "SELECT COUNT(*) AS count FROM e2ee_one_time_prekeys WHERE user_id = ? AND used = 0",
        [userId],
      )?.count || 0,
    );

    return res.json({ ok: true, remainingPreKeys });
  });

  /**
   * Fetch a key bundle for a target user to establish an E2EE session.
   * Consumes one one-time prekey (if available).
   */
  app.get("/api/e2ee/keys/bundle/:targetUserId", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const targetUserId = Number(req.params.targetUserId || 0);
    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID is required." });
    }

    const targetUser = findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Get identity key
    const identityRow = adminGetRow(
      "SELECT public_key FROM e2ee_identity_keys WHERE user_id = ?",
      [targetUserId],
    );
    if (!identityRow?.public_key) {
      return res.status(404).json({
        error: "User has not enabled end-to-end encryption.",
        code: "E2EE_NOT_ENABLED",
      });
    }

    // Get signed prekey
    const signedPreKeyRow = adminGetRow(
      "SELECT key_id, public_key, signature FROM e2ee_signed_prekeys WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [targetUserId],
    );
    if (!signedPreKeyRow) {
      return res.status(404).json({
        error: "User key bundle is incomplete.",
        code: "E2EE_INCOMPLETE",
      });
    }

    // Consume one one-time prekey (if available)
    const oneTimePreKeyRow = adminGetRow(
      "SELECT id, key_id, public_key FROM e2ee_one_time_prekeys WHERE user_id = ? AND used = 0 ORDER BY id ASC LIMIT 1",
      [targetUserId],
    );

    let oneTimePreKey = null;
    if (oneTimePreKeyRow) {
      adminRun("UPDATE e2ee_one_time_prekeys SET used = 1 WHERE id = ?", [
        Number(oneTimePreKeyRow.id),
      ]);
      adminSave();
      oneTimePreKey = {
        keyId: Number(oneTimePreKeyRow.key_id),
        publicKey: oneTimePreKeyRow.public_key,
      };
    }

    return res.json({
      ok: true,
      userId: targetUserId,
      identityKey: identityRow.public_key,
      signedPreKey: {
        keyId: Number(signedPreKeyRow.key_id),
        publicKey: signedPreKeyRow.public_key,
        signature: signedPreKeyRow.signature,
      },
      oneTimePreKey,
    });
  });

  /**
   * Check if a user has E2EE keys uploaded
   */
  app.get("/api/e2ee/keys/status", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const identityRow = adminGetRow(
      "SELECT public_key FROM e2ee_identity_keys WHERE user_id = ?",
      [Number(user.id)],
    );

    const preKeyCount = Number(
      adminGetRow(
        "SELECT COUNT(*) AS count FROM e2ee_one_time_prekeys WHERE user_id = ? AND used = 0",
        [Number(user.id)],
      )?.count || 0,
    );

    return res.json({
      ok: true,
      enabled: Boolean(identityRow?.public_key),
      remainingPreKeys: preKeyCount,
    });
  });

  /**
   * Check if a peer supports E2EE (has keys uploaded)
   */
  app.get("/api/e2ee/keys/check/:targetUserId", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const targetUserId = Number(req.params.targetUserId || 0);
    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID is required." });
    }

    const identityRow = adminGetRow(
      "SELECT public_key FROM e2ee_identity_keys WHERE user_id = ?",
      [targetUserId],
    );

    return res.json({
      ok: true,
      userId: targetUserId,
      e2eeEnabled: Boolean(identityRow?.public_key),
    });
  });

  /**
   * Get remaining one-time prekey count (for replenishment check)
   */
  app.get("/api/e2ee/keys/prekey-count", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(String(username || "").toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const count = Number(
      adminGetRow(
        "SELECT COUNT(*) AS count FROM e2ee_one_time_prekeys WHERE user_id = ? AND used = 0",
        [Number(user.id)],
      )?.count || 0,
    );

    return res.json({ ok: true, count });
  });

  app.get("/api/e2ee/group/:chatId/status", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId || 0);
    if (!chatId || !isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    return res.json({
      ok: true,
      chatId,
      enabled: isGroupE2eeEnabled(chatId),
    });
  });

  app.post("/api/e2ee/group/:chatId/enable", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId || 0);
    if (!chatId || !isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const role = String(getChatMemberRole?.(chatId, session.id) || "").toLowerCase();
    if (!["owner", "admin"].includes(role)) {
      return res.status(403).json({ error: "Only group admins can enable group E2EE." });
    }

    setGroupE2eeEnabled(chatId, true);
    adminSave?.();
    return res.json({ ok: true, chatId, enabled: true });
  });

  app.post("/api/e2ee/group/:chatId/disable", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId || 0);
    if (!chatId || !isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const role = String(getChatMemberRole?.(chatId, session.id) || "").toLowerCase();
    if (!["owner", "admin"].includes(role)) {
      return res.status(403).json({ error: "Only group admins can disable group E2EE." });
    }

    setGroupE2eeEnabled(chatId, false);
    adminSave?.();
    return res.json({ ok: true, chatId, enabled: false });
  });

  app.put("/api/e2ee/group/:chatId/keys", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId || 0);
    const wrappedKey = String(req.body?.wrappedKey || "").trim();
    const keyGeneration = Number(req.body?.keyGeneration || 1) || 1;
    const requestedUserId = Number(req.body?.userId || session.id) || session.id;

    if (!chatId || !wrappedKey) {
      return res.status(400).json({ error: "Chat id and wrapped key are required." });
    }
    if (!isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }
    if (!isGroupE2eeEnabled(chatId)) {
      return res.status(400).json({ error: "Group E2EE is not enabled for this chat." });
    }

    if (requestedUserId !== session.id) {
      const role = String(getChatMemberRole?.(chatId, session.id) || "").toLowerCase();
      const hasGroupKey = Boolean(getGroupE2eeWrappedKey(chatId, session.id)?.wrapped_key);
      if (!["owner", "admin"].includes(role) && !hasGroupKey) {
        return res.status(403).json({ error: "Only group admins or keyed members can upload keys for others." });
      }
      if (!isMember(chatId, requestedUserId)) {
        return res.status(400).json({ error: "Target user is not a member of this group." });
      }
    }

    upsertGroupE2eeWrappedKey({
      chatId,
      userId: requestedUserId,
      wrappedKey,
      keyGeneration,
    });
    adminSave?.();
    return res.json({ ok: true, chatId, keyGeneration });
  });

  app.get("/api/e2ee/group/:chatId/keys", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId || 0);
    if (!chatId || !isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }
    if (!isGroupE2eeEnabled(chatId)) {
      return res.json({ ok: true, chatId, enabled: false, keys: [] });
    }

    const keys = listGroupE2eeWrappedKeys(chatId).map((row) => ({
      userId: Number(row.user_id),
      wrappedKey: row.wrapped_key,
      keyGeneration: Number(row.key_generation || 1),
      updatedAt: row.updated_at || null,
    }));

    return res.json({ ok: true, chatId, enabled: true, keys });
  });

  app.get("/api/e2ee/group/:chatId/keys/me", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId || 0);
    if (!chatId || !isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const row = getGroupE2eeWrappedKey(chatId, session.id);
    return res.json({
      ok: true,
      chatId,
      wrappedKey: row?.wrapped_key || null,
      keyGeneration: Number(row?.key_generation || 0) || null,
    });
  });
}

export { registerE2eeRoutes };
