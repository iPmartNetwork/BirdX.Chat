import { evaluateContactRequestAccess } from "../lib/contactPolicy.js";
import { recordDmSecurityEvent } from "../lib/dmPrivacy.js";

function registerContactsRoutes(app, deps) {
  const {
    acceptContactRequest,
    adminRun,
    adminSave,
    areUsersContacts,
    cancelContactRequest,
    cancelPendingContactRequestsBetween,
    createContactRequest,
    ensureAvatarExists,
    emitSseEvent,
    findDmChat,
    findUserById,
    findUserByUsername,
    getContactPeerStatus,
    isBlockedBetween,
    isUserInActiveCall,
    listIncomingContactRequests,
    listOutgoingContactRequests,
    listUserContacts,
    rejectContactRequest,
    removeMutualUserContacts,
    removeUserContact,
    requireSession,
    requireSessionUsernameMatch,
    sendPushNotificationToUsers,
    usersShareNonDmChat,
  } = deps;

  const logContactEvent = (req, type, details) => {
    recordDmSecurityEvent(adminRun, adminSave, req, type, details);
  };

  const normalizeContactUser = (row) => ({
    id: Number(row?.id || 0),
    username: row?.username || "",
    nickname: row?.nickname || row?.username || "",
    avatar_url: ensureAvatarExists(row?.id, row?.avatar_url),
    color: row?.color || "#10b981",
    status: String(row?.status || "offline").toLowerCase(),
    contactSince: row?.contact_since || null,
    inCall: Boolean(isUserInActiveCall?.(row?.id)),
  });

  const notifyContactRequestPush = async (fromUser, targetUser, requestId) => {
    if (!sendPushNotificationToUsers || !targetUser?.id) return;
    const senderLabel = fromUser?.nickname || fromUser?.username || "Someone";
    await sendPushNotificationToUsers([Number(targetUser.id)], {
      title: "Contact request",
      body: `${senderLabel} wants to add you to their contacts`,
      data: {
        type: "contact_request",
        requestId: Number(requestId || 0),
        fromUserId: Number(fromUser?.id || 0),
        fromUsername: fromUser?.username || "",
        url: "/?tab=calls",
      },
    });
  };

  app.get("/api/contacts", (req, res) => {
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

    const contacts = listUserContacts(user.id).map((row) => {
      const normalized = normalizeContactUser(row);
      const dmChat = findDmChat(user.id, normalized.id);
      return {
        ...normalized,
        chatId: dmChat?.id ? Number(dmChat.id) : null,
      };
    });

    return res.json({ contacts });
  });

  app.get("/api/contacts/requests/incoming", (req, res) => {
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

    const requests = listIncomingContactRequests(user.id).map((row) => {
      const from = normalizeContactUser({
        id: row.from_user_id,
        username: row.username,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        color: row.color,
      });
      const dmChat = findDmChat(user.id, from.id);
      return {
        id: Number(row.id),
        createdAt: row.created_at,
        from,
        chatId: dmChat?.id ? Number(dmChat.id) : null,
      };
    });

    return res.json({ requests });
  });

  app.get("/api/contacts/requests/outgoing", (req, res) => {
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

    const requests = listOutgoingContactRequests(user.id).map((row) => {
      const to = normalizeContactUser({
        id: row.to_user_id,
        username: row.username,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        color: row.color,
      });
      const dmChat = findDmChat(user.id, to.id);
      return {
        id: Number(row.id),
        createdAt: row.created_at,
        to,
        chatId: dmChat?.id ? Number(dmChat.id) : null,
      };
    });

    return res.json({ requests });
  });

  app.get("/api/contacts/peer-status", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    const peerUsername = req.query.peerUsername?.toString();
    if (!username || !peerUsername) {
      return res.status(400).json({ error: "Username and peerUsername are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    const peer = findUserByUsername(peerUsername.toLowerCase());
    if (!user || !peer) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({
      ...getContactPeerStatus(user.id, peer.id),
      blockedByMe: Boolean(deps.isUserBlockedBy?.(user.id, peer.id)),
      blockedMe: Boolean(deps.isUserBlockedBy?.(peer.id, user.id)),
      inCall: Boolean(isUserInActiveCall?.(peer.id)),
    });
  });

  app.post("/api/contacts/requests", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.body?.username?.toString();
    const toUsername = req.body?.toUsername?.toString();
    if (!username || !toUsername) {
      return res.status(400).json({ error: "Username and toUsername are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    const target = findUserByUsername(toUsername.toLowerCase());
    if (!user || !target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (Number(user.id) === Number(target.id)) {
      return res.status(400).json({ error: "You cannot add yourself." });
    }
    if (isBlockedBetween(user.id, target.id)) {
      return res.status(403).json({ error: "Contact request is not allowed." });
    }
    if (areUsersContacts(user.id, target.id)) {
      return res.json({ ok: true, alreadyContact: true, ...getContactPeerStatus(user.id, target.id) });
    }

    const access = evaluateContactRequestAccess({
      fromUser: user,
      toUser: target,
      usersShareGroup: usersShareNonDmChat(user.id, target.id),
      blockedEitherWay: false,
    });
    if (!access.allowed) {
      return res.status(403).json({ error: access.message || "Contact request is not allowed." });
    }

    const result = createContactRequest(user.id, target.id);
    if (!result?.request) {
      return res.status(400).json({ error: "Unable to send contact request." });
    }
    adminSave?.();

    if (result.autoAccepted) {
      logContactEvent(req, "contact.request.accepted", {
        username: user.username,
        userId: user.id,
        peerUsername: target.username,
        peerUserId: target.id,
        autoAccepted: true,
      });
      emitSseEvent(user.username, { type: "contacts_updated" });
      emitSseEvent(target.username, { type: "contacts_updated" });
      return res.json({
        ok: true,
        autoAccepted: true,
        ...getContactPeerStatus(user.id, target.id),
      });
    }

    if (result.created) {
      logContactEvent(req, "contact.request.sent", {
        username: user.username,
        userId: user.id,
        peerUsername: target.username,
        peerUserId: target.id,
        requestId: Number(result.request.id),
      });
      emitSseEvent(target.username, {
        type: "contact_request_received",
        requestId: Number(result.request.id),
        fromUserId: user.id,
      });
      notifyContactRequestPush(user, target, result.request.id).catch((error) => {
        console.warn("[contacts] push failed:", String(error?.message || error));
      });
    }

    return res.json({
      ok: true,
      requestId: Number(result.request.id),
      ...getContactPeerStatus(user.id, target.id),
    });
  });

  app.post("/api/contacts/requests/:requestId/accept", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const requestId = Number(req.params.requestId || 0);
    const username = req.body?.username?.toString();
    if (!requestId || !username) {
      return res.status(400).json({ error: "Request id and username are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const accepted = acceptContactRequest(requestId, user.id);
    if (!accepted) {
      return res.status(404).json({ error: "Contact request not found." });
    }
    adminSave?.();

    const fromUser = findUserById(Number(accepted.from_user_id));
    logContactEvent(req, "contact.request.accepted", {
      username: user.username,
      userId: user.id,
      peerUsername: fromUser?.username || "",
      peerUserId: fromUser?.id || null,
      requestId,
    });

    if (fromUser?.username) {
      emitSseEvent(fromUser.username, { type: "contacts_updated" });
    }
    emitSseEvent(user.username, { type: "contacts_updated" });

    const peerStatus = fromUser
      ? getContactPeerStatus(user.id, fromUser.id)
      : { isContact: true };

    return res.json({ ok: true, ...peerStatus });
  });

  app.post("/api/contacts/requests/:requestId/reject", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const requestId = Number(req.params.requestId || 0);
    const username = req.body?.username?.toString();
    if (!requestId || !username) {
      return res.status(400).json({ error: "Request id and username are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const rejected = rejectContactRequest(requestId, user.id);
    if (!rejected) {
      return res.status(404).json({ error: "Contact request not found." });
    }
    adminSave?.();

    const fromUser = findUserById(Number(rejected.from_user_id));
    logContactEvent(req, "contact.request.rejected", {
      username: user.username,
      userId: user.id,
      peerUsername: fromUser?.username || "",
      peerUserId: fromUser?.id || null,
      requestId,
    });

    if (fromUser?.username) {
      emitSseEvent(fromUser.username, {
        type: "contact_request_rejected",
        requestId,
      });
    }

    const peerStatus = fromUser
      ? getContactPeerStatus(user.id, fromUser.id)
      : { isContact: false };

    return res.json({ ok: true, ...peerStatus });
  });

  app.post("/api/contacts/requests/:requestId/cancel", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const requestId = Number(req.params.requestId || 0);
    const username = req.body?.username?.toString();
    if (!requestId || !username) {
      return res.status(400).json({ error: "Request id and username are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const cancelled = cancelContactRequest(requestId, user.id);
    if (!cancelled) {
      return res.status(404).json({ error: "Contact request not found." });
    }
    adminSave?.();

    const targetUser = findUserById(Number(cancelled.to_user_id));
    logContactEvent(req, "contact.request.cancelled", {
      username: user.username,
      userId: user.id,
      peerUsername: targetUser?.username || "",
      peerUserId: targetUser?.id || null,
      requestId,
    });

    if (targetUser?.username) {
      emitSseEvent(targetUser.username, { type: "contacts_updated" });
    }

    const peerStatus = targetUser
      ? getContactPeerStatus(user.id, targetUser.id)
      : { isContact: false };

    return res.json({ ok: true, ...peerStatus });
  });

  app.delete("/api/contacts/:contactUsername", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const username = req.query.username?.toString();
    const contactUsername = String(req.params.contactUsername || "").trim().toLowerCase();
    if (!username || !contactUsername) {
      return res.status(400).json({ error: "Username and contact are required." });
    }
    if (!requireSessionUsernameMatch(res, session, username)) return;

    const user = findUserByUsername(username.toLowerCase());
    const contact = findUserByUsername(contactUsername);
    if (!user || !contact) {
      return res.status(404).json({ error: "User not found." });
    }

    removeUserContact(user.id, contact.id);
    adminSave?.();

    logContactEvent(req, "contact.removed", {
      username: user.username,
      userId: user.id,
      peerUsername: contact.username,
      peerUserId: contact.id,
    });

    emitSseEvent(user.username, { type: "contacts_updated" });

    return res.json({
      ok: true,
      ...getContactPeerStatus(user.id, contact.id),
    });
  });
}

export { registerContactsRoutes };
