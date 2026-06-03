import {
  evaluateDmAccess,
  getDmDiscoveryMode,
  getDmRejectCooldownDays,
  getDmRequestsPerDayLimit,
  normalizeDmPolicy,
  recordDmSecurityEvent,
} from "../lib/dmPrivacy.js";
import { normalizeContactRequestPolicy } from "../lib/contactPolicy.js";

function registerDmPrivacyRoutes(app, deps) {
  const {
    addChatMember,
    adminRun,
    adminSave,
    blockUser,
    cancelPendingContactRequestsBetween,
    countDmInitiationsToday,
    countNonSystemMessagesInChat,
    emitChatEvent,
    emitSseEvent,
    ensureAvatarExists,
    findDmChat,
    findUserByExactUsername,
    findUserByUsername,
    getDmChatRow,
    isBlockedBetween,
    isDmRejectionCooldownActive,
    isMember,
    listBlockedUsers,
    listChatMembers,
    listDmRequestsForUser,
    recordDmSecurityEvent,
    removeMutualUserContacts,
    recordDmRejection,
    requireSession,
    requireSessionUsernameMatch,
    setChatDmState,
    unblockUser,
    unhideChat,
    updateUserContactRequestPolicy,
    updateUserDmPolicy,
    usersShareNonDmChat,
  } = deps;

  app.get("/api/users/lookup", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const mode = getDmDiscoveryMode();
    if (mode === "off") {
      return res.status(403).json({ error: "User lookup is disabled on this server." });
    }

    const exclude = req.query.exclude?.toString();
    const username = String(req.query.username || "")
      .trim()
      .toLowerCase()
      .replace(/^@+/, "");
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (exclude && !requireSessionUsernameMatch(res, session, exclude)) return;

    const user = findUserByExactUsername(username);
    if (!user) {
      return res.json({ user: null });
    }
    if (exclude && String(user.username).toLowerCase() === exclude.toLowerCase()) {
      return res.json({ user: null });
    }
    if (Number(user.banned || 0) === 1) {
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar_url: ensureAvatarExists(user.id, user.avatar_url),
        color: user.color,
      },
    });
  });

  app.get("/api/dm-requests", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const requests = listDmRequestsForUser(user.id).map((row) => ({
      chatId: Number(row.id),
      status: row.dm_status,
      createdAt: row.created_at,
      previewBody: row.preview_body || "",
      previewAt: row.preview_at || null,
      from: {
        id: Number(row.initiator_id),
        username: row.initiator_username,
        nickname: row.initiator_nickname || row.initiator_username,
        avatarUrl: ensureAvatarExists(row.initiator_id, row.initiator_avatar_url),
        color: row.initiator_color || "#10b981",
      },
    }));

    res.json({ requests });
  });

  app.post("/api/dm-requests/:chatId/accept", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId);
    const { username } = req.body || {};
    if (!chatId || !username) {
      return res.status(400).json({ error: "Chat id and username are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (!isMember(chatId, user.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const chat = getDmChatRow(chatId);
    if (!chat || chat.type !== "dm") {
      return res.status(404).json({ error: "Conversation not found." });
    }
    if (String(chat.dm_status) !== "pending") {
      return res.status(400).json({ error: "This request is no longer pending." });
    }
    if (Number(chat.dm_initiator_user_id) === Number(user.id)) {
      return res.status(400).json({ error: "Only the recipient can accept this request." });
    }

    setChatDmState(chatId, {
      status: "active",
      initiatorUserId: chat.dm_initiator_user_id,
      resolvedAt: new Date().toISOString(),
    });
    unhideChat(user.id, chatId);
    unhideChat(Number(chat.dm_initiator_user_id), chatId);

    recordDmSecurityEvent(adminRun, adminSave, req, "dm.request.accepted", {
      username: user.username,
      userId: user.id,
      chatId,
      initiatorUserId: chat.dm_initiator_user_id,
    });

    emitChatEvent(chatId, { type: "dm_request_updated", chatId, status: "active" });
    listChatMembers(chatId).forEach((member) => {
      emitSseEvent(String(member.username || "").toLowerCase(), {
        type: "chat_list_changed",
      });
    });

    res.json({ ok: true, chatId, status: "active" });
  });

  app.post("/api/dm-requests/:chatId/reject", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const chatId = Number(req.params.chatId);
    const { username } = req.body || {};
    if (!chatId || !username) {
      return res.status(400).json({ error: "Chat id and username are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (!isMember(chatId, user.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const chat = getDmChatRow(chatId);
    if (!chat || chat.type !== "dm") {
      return res.status(404).json({ error: "Conversation not found." });
    }
    if (String(chat.dm_status) !== "pending") {
      return res.status(400).json({ error: "This request is no longer pending." });
    }
    if (Number(chat.dm_initiator_user_id) === Number(user.id)) {
      return res.status(400).json({ error: "Only the recipient can reject this request." });
    }

    const initiatorId = Number(chat.dm_initiator_user_id);
    setChatDmState(chatId, {
      status: "rejected",
      initiatorUserId: initiatorId,
      resolvedAt: new Date().toISOString(),
    });
    recordDmRejection(initiatorId, user.id);

    recordDmSecurityEvent(adminRun, adminSave, req, "dm.request.rejected", {
      username: user.username,
      userId: user.id,
      chatId,
      initiatorUserId: initiatorId,
    });

    emitChatEvent(chatId, { type: "dm_request_updated", chatId, status: "rejected" });
    listChatMembers(chatId).forEach((member) => {
      emitSseEvent(String(member.username || "").toLowerCase(), {
        type: "chat_list_changed",
      });
    });

    res.json({ ok: true, chatId, status: "rejected" });
  });

  app.patch("/api/profile/dm-policy", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, dmPolicy } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const policy = normalizeDmPolicy(dmPolicy);
    updateUserDmPolicy(user.id, policy);

    res.json({ ok: true, dmPolicy: policy });
  });

  app.patch("/api/profile/contact-request-policy", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, contactRequestPolicy } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const policy = normalizeContactRequestPolicy(contactRequestPolicy);
    updateUserContactRequestPolicy(user.id, policy);

    res.json({ ok: true, contactRequestPolicy: policy });
  });

  app.get("/api/users/blocked", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const blocked = listBlockedUsers(user.id).map((row) => ({
      id: Number(row.id),
      username: row.username,
      nickname: row.nickname || row.username,
      avatar_url: ensureAvatarExists(row.id, row.avatar_url),
      color: row.color || "#10b981",
    }));

    res.json({ blocked });
  });

  app.post("/api/users/block", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const { username, target } = req.body || {};
    if (!username || !target) {
      return res.status(400).json({ error: "Username and target are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const blocker = findUserByUsername(username.toLowerCase());
    const blocked = findUserByExactUsername(target);
    if (!blocker || !blocked) {
      return res.status(404).json({ error: "User not found." });
    }
    if (Number(blocker.id) === Number(blocked.id)) {
      return res.status(400).json({ error: "You cannot block yourself." });
    }

    blockUser(blocker.id, blocked.id);
    removeMutualUserContacts(blocker.id, blocked.id);
    cancelPendingContactRequestsBetween(blocker.id, blocked.id);
    adminSave?.();
    emitSseEvent(blocker.username, { type: "contacts_updated" });
    emitSseEvent(blocked.username, { type: "contacts_updated" });
    recordDmSecurityEvent(adminRun, adminSave, req, "dm.user.blocked", {
      username: blocker.username,
      userId: blocker.id,
      blockedUsername: blocked.username,
      blockedUserId: blocked.id,
    });

    res.json({ ok: true });
  });

  app.delete("/api/users/block/:target", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    const target = String(req.params.target || "").trim().toLowerCase();
    if (!username || !target) {
      return res.status(400).json({ error: "Username and target are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const blocker = findUserByUsername(username.toLowerCase());
    const blocked = findUserByExactUsername(target);
    if (!blocker || !blocked) {
      return res.status(404).json({ error: "User not found." });
    }

    unblockUser(blocker.id, blocked.id);
    adminSave?.();
    recordDmSecurityEvent(adminRun, adminSave, req, "dm.user.unblocked", {
      username: blocker.username,
      userId: blocker.id,
      blockedUsername: blocked.username,
      blockedUserId: blocked.id,
    });
    res.json({ ok: true });
  });
}

export { registerDmPrivacyRoutes };
