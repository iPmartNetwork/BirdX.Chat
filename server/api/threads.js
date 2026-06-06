function registerThreadRoutes(app, deps) {
  const {
    requireSession,
    isMember,
    createThreadReply,
    getThreadReplies,
    getThreadInfo,
    emitChatEvent,
    findMessageById,
  } = deps;

  // Get thread replies for a root message
  app.get("/api/threads/:messageId", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const messageId = Number(req.params.messageId || 0);
    if (!messageId) return res.status(400).json({ error: "messageId is required." });

    const rootMessage = findMessageById(messageId);
    if (!rootMessage) return res.status(404).json({ error: "Message not found." });
    if (!isMember(Number(rootMessage.chat_id), session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const limit = Number(req.query.limit || 100);
    const offset = Number(req.query.offset || 0);
    const replies = getThreadReplies(messageId, limit, offset);
    const info = getThreadInfo(messageId);

    return res.json({
      ok: true,
      threadRootId: messageId,
      replyCount: Number(info?.thread_reply_count || 0),
      lastReplyAt: info?.thread_last_reply_at || null,
      replies,
    });
  });

  // Post a reply in a thread
  app.post("/api/threads/:messageId/reply", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const threadRootId = Number(req.params.messageId || 0);
    if (!threadRootId) return res.status(400).json({ error: "messageId is required." });

    const rootMessage = findMessageById(threadRootId);
    if (!rootMessage) return res.status(404).json({ error: "Thread root message not found." });

    const chatId = Number(rootMessage.chat_id);
    if (!isMember(chatId, session.id)) {
      return res.status(403).json({ error: "Not a member of this chat." });
    }

    const { body } = req.body || {};
    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: "Message body is required." });
    }

    const msgId = createThreadReply(chatId, session.id, String(body).trim(), threadRootId);
    if (!msgId) {
      return res.status(500).json({ error: "Failed to create thread reply." });
    }

    emitChatEvent(chatId, {
      type: "thread_reply",
      chatId,
      threadRootId,
      messageId: msgId,
      userId: session.id,
    });

    return res.json({ ok: true, messageId: msgId, threadRootId });
  });
}

export { registerThreadRoutes };
