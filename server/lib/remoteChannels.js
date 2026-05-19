function normalizeTelegramSource(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, error: "Telegram source is required." };

  if (/^-?\d{5,}$/.test(raw)) {
    return {
      ok: true,
      sourceRaw: raw,
      sourceChatId: raw,
      sourceUsername: "",
      displayName: raw,
    };
  }

  let candidate = raw;
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (!["t.me", "telegram.me"].includes(host)) {
        return {
          ok: false,
          error: "Telegram source must be a t.me channel link or username.",
        };
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "s") parts.shift();
      candidate = parts[0] || "";
    } catch {
      return { ok: false, error: "Telegram source URL is invalid." };
    }
  }

  candidate = candidate.replace(/^@+/, "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(candidate)) {
    return {
      ok: false,
      error:
        "Telegram source must be a public channel username or t.me channel link.",
    };
  }

  const sourceUsername = candidate.toLowerCase();
  return {
    ok: true,
    sourceRaw: raw,
    sourceChatId: "",
    sourceUsername,
    displayName: `@${sourceUsername}`,
  };
}

function errorMessage(error) {
  return String(error?.message || error || "Unknown error")
    .replace(/session[=:]\s*["']?[^"',\s]+/gi, "session=<redacted>")
    .slice(0, 1000);
}

function parseTelegramProxy(proxyUrl, logger = null) {
  const raw = String(proxyUrl || "").trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const protocol = url.protocol.toLowerCase();
    const port = Number(url.port || 0);
    if (!url.hostname || !port) {
      logger?.("[remote-channel] Telegram proxy URL must include host and port.");
      return undefined;
    }
    if (protocol === "socks5:" || protocol === "socks4:") {
      return {
        ip: url.hostname,
        port,
        socksType: protocol === "socks5:" ? 5 : 4,
        username: decodeURIComponent(url.username || "") || undefined,
        password: decodeURIComponent(url.password || "") || undefined,
        timeout: 10,
      };
    }
    logger?.(
      "[remote-channel] Telegram proxy supports socks4:// or socks5:// URLs.",
    );
  } catch (error) {
    logger?.(`[remote-channel] invalid Telegram proxy URL: ${errorMessage(error)}`);
  }
  return undefined;
}

function getTelegramClientConnectionOptions(proxyUrl, logger = null) {
  const proxy = parseTelegramProxy(proxyUrl, logger);
  return proxy ? { proxy } : {};
}

function resolveTelegramSourceRef(source) {
  const username = String(source?.source_username || "")
    .trim()
    .replace(/^@+/, "");
  if (username) return `@${username}`;

  const raw = String(source?.source_chat_id || source?.source_raw || "").trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function resolveEntityTitle(entity, source) {
  return (
    String(entity?.title || entity?.firstName || entity?.username || "").trim() ||
    String(source?.source_title || "").trim() ||
    String(source?.source_username || source?.source_raw || "Telegram channel")
      .trim()
      .replace(/^([^@])/, "@$1")
  );
}

function extractTelegramPostText(message) {
  return String(message?.message || message?.text || "").trim();
}

function truncateBody(body, maxChars) {
  const text = String(body || "");
  const limit = Math.max(1, Number(maxChars || 4000));
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function createRemoteChannelManager(deps = {}) {
  const {
    config = {},
    createOrReuseMessage,
    debugLog = () => {},
    emitChatEvent,
    enqueueRemoteChannelQueueItem,
    findChatById,
    findUserById,
    getRemoteChannelSourceById,
    listChatMembers,
    listEnabledRemoteChannelSources,
    listMutedUserIdsForChat,
    markRemoteChannelQueueItemDone,
    markRemoteChannelQueueItemRetry,
    markRemoteChannelQueueItemSkipped,
    releaseStaleRemoteChannelQueueItems,
    claimNextRemoteChannelQueueItem,
    sendPushNotificationToUsers,
    setMessageForwardOrigin,
    updateRemoteChannelSourceError,
    updateRemoteChannelSourceSeen,
  } = deps;

  const apiId = Number(config.telegramApiId || 0);
  const apiHash = String(config.telegramApiHash || "").trim();
  const sessionString = String(config.telegramSessionString || "").trim();
  const enabled = Boolean(config.enabled && apiId && apiHash && sessionString);
  const pollIntervalMs = Math.max(1000, Number(config.pollIntervalMs || 5000));
  const pollLimit = Math.max(1, Math.min(100, Number(config.telegramPollLimit || 50)));
  const queueIntervalMs = Math.max(250, Number(config.queueIntervalMs || 1000));
  const maxAttempts = Math.max(1, Number(config.queueMaxAttempts || 10));
  const staleLockMs = Math.max(10_000, Number(config.queueStaleLockMs || 300_000));
  const messageMaxChars = Math.max(1, Number(config.messageMaxChars || 4000));
  const lockOwner = `birdx-${process.pid}`;
  const connectionOptions = getTelegramClientConnectionOptions(config.proxyUrl, (msg) =>
    console.warn(msg),
  );

  let stopped = true;
  let timer = null;
  let queueTimer = null;
  let client = null;
  let clientModules = null;
  let polling = false;
  let queueRunning = false;

  const log = (...args) => debugLog("remote-channel", ...args);

  async function loadTelegramModules() {
    if (!clientModules) {
      const [{ TelegramClient }, { StringSession }] = await Promise.all([
        import("telegram"),
        import("telegram/sessions/index.js"),
      ]);
      clientModules = { TelegramClient, StringSession };
    }
    return clientModules;
  }

  async function ensureClient() {
    const { TelegramClient, StringSession } = await loadTelegramModules();
    if (!client) {
      client = new TelegramClient(
        new StringSession(sessionString),
        apiId,
        apiHash,
        {
          connectionRetries: 5,
          reconnectRetries: 5,
          retryDelay: 2000,
          autoReconnect: true,
          ...connectionOptions,
          deviceModel: "BirdX",
          systemVersion: "BirdX Server",
          appVersion: "2.5",
        },
      );
    }
    if (!client.connected) await client.connect();
    return client;
  }

  async function resolveSource(activeClient, source) {
    const ref = resolveTelegramSourceRef(source);
    if (!ref) throw new Error("Telegram source is not configured.");
    const entity = await activeClient.getEntity(ref);
    const title = resolveEntityTitle(entity, source);
    const username = String(entity?.username || source?.source_username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    const chatId = String(entity?.id || source?.source_chat_id || "").trim();
    return { entity, title, username, chatId };
  }

  async function syncSourceMetadata(sourceId) {
    const source = getRemoteChannelSourceById?.(sourceId);
    if (!source?.id) throw new Error("Remote Channel source was not found.");
    const activeClient = await ensureClient();
    const resolved = await resolveSource(activeClient, source);
    updateRemoteChannelSourceSeen?.(source.id, {
      sourceChatId: resolved.chatId,
      sourceUsername: resolved.username,
      sourceTitle: resolved.title,
    });
    return resolved;
  }

  async function pollSource(activeClient, source) {
    const resolved = await resolveSource(activeClient, source);
    const messages = await activeClient.getMessages(resolved.entity, {
      limit: pollLimit,
    });
    const lastSeen = Number(source.last_remote_message_id || 0) || 0;
    const fresh = Array.from(messages || [])
      .filter((message) => Number(message?.id || 0) > lastSeen)
      .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

    let newestId = lastSeen;
    for (const message of fresh) {
      const messageId = Number(message?.id || 0) || 0;
      newestId = Math.max(newestId, messageId);
      const body = truncateBody(extractTelegramPostText(message), messageMaxChars);
      if (!body) continue;
      enqueueRemoteChannelQueueItem?.({
        sourceId: source.id,
        sourceVersion: source.source_version || 1,
        telegramUpdateId: messageId,
        telegramMessageId: messageId,
        payloadJson: JSON.stringify({
          message: {
            id: messageId,
            message: body,
            date: Number(message?.date || 0) || null,
          },
          source: {
            title: resolved.title,
            username: resolved.username,
          },
        }),
      });
    }

    updateRemoteChannelSourceSeen?.(source.id, {
      sourceChatId: resolved.chatId,
      sourceUsername: resolved.username,
      sourceTitle: resolved.title,
      lastRemoteMessageId: newestId,
    });
  }

  async function pollOnce() {
    if (polling || stopped || !enabled) return;
    polling = true;
    try {
      const activeClient = await ensureClient();
      const sources = listEnabledRemoteChannelSources?.("telegram") || [];
      for (const source of sources) {
        try {
          await pollSource(activeClient, source);
        } catch (error) {
          updateRemoteChannelSourceError?.(source.id, errorMessage(error));
          log("poll:error", { sourceId: Number(source.id), error: errorMessage(error) });
        }
      }
    } catch (error) {
      log("poll:unavailable", { error: errorMessage(error) });
    } finally {
      polling = false;
    }
  }

  function resolveAuthorUserId(chat) {
    const members = listChatMembers?.(chat.id) || [];
    const owner = members.find(
      (member) => String(member.role || "").toLowerCase() === "owner",
    );
    return Number(owner?.id || chat?.created_by_user_id || 0) || 0;
  }

  async function sendPushForMirroredPost({ chat, authorId, body }) {
    const members = listChatMembers?.(chat.id) || [];
    const muted = new Set(listMutedUserIdsForChat?.(chat.id) || []);
    const recipients = members
      .map((member) => Number(member.id || 0))
      .filter((id) => id && id !== Number(authorId) && !muted.has(id));
    if (!recipients.length) return;
    await sendPushNotificationToUsers?.(recipients, {
      title: chat.name || "Remote Channel",
      body,
      data: {
        type: "message",
        chatId: Number(chat.id),
      },
      tag: `chat-${Number(chat.id)}`,
    });
  }

  async function processQueueItem(item) {
    const source = getRemoteChannelSourceById?.(item.source_id);
    if (!source || !Number(source.enabled || 0)) {
      markRemoteChannelQueueItemSkipped?.(
        item.id,
        "Remote Channel was disabled before this item was mirrored.",
      );
      return;
    }
    let envelope = null;
    try {
      envelope = JSON.parse(String(item.payload_json || "{}"));
    } catch {
      markRemoteChannelQueueItemSkipped?.(item.id, "Invalid Telegram payload.");
      return;
    }

    const body = truncateBody(
      extractTelegramPostText(envelope.message || {}),
      messageMaxChars,
    );
    if (!body) {
      markRemoteChannelQueueItemSkipped?.(item.id, "Telegram post has no text.");
      return;
    }

    const chat = findChatById?.(Number(item.chat_id));
    if (!chat || String(chat.type || "").toLowerCase() !== "channel") {
      throw new Error("Target channel is no longer available.");
    }
    const authorId = resolveAuthorUserId(chat);
    const author = findUserById?.(authorId);
    if (!author) throw new Error("Target channel owner no longer exists.");

    const telegramMessageId =
      Number(item.telegram_message_id || envelope?.message?.id || 0) || 0;
    const clientRequestId = `remote:tg:${Number(item.source_id)}:${telegramMessageId}`.slice(
      0,
      120,
    );
    const created = createOrReuseMessage?.(
      Number(chat.id),
      authorId,
      body,
      null,
      null,
      clientRequestId,
    );
    const messageId = Number(created?.id || 0);
    if (!messageId) throw new Error("Unable to create mirrored message.");

    if (!created?.deduped) {
      setMessageForwardOrigin?.(messageId, {
        label: `Telegram: ${
          envelope?.source?.title ||
          (envelope?.source?.username ? `@${envelope.source.username}` : "channel")
        }`,
        sourceColor: "#10b981",
      });
      emitChatEvent?.(Number(chat.id), {
        type: "chat_message",
        chatId: Number(chat.id),
        messageId,
        username: author.username,
        clientRequestId,
        client_request_id: clientRequestId,
        isRemoteChannelMessage: true,
        body,
        replyToMessageId: null,
      });
      await sendPushForMirroredPost({ chat, authorId, body });
    }

    markRemoteChannelQueueItemDone?.(item.id, messageId);
    updateRemoteChannelSourceError?.(item.source_id, "");
  }

  async function runQueueOnce() {
    if (queueRunning || stopped || !enabled) return;
    queueRunning = true;
    try {
      releaseStaleRemoteChannelQueueItems?.(
        new Date(Date.now() - staleLockMs).toISOString(),
      );
      while (!stopped) {
        const item = claimNextRemoteChannelQueueItem?.(
          lockOwner,
          new Date().toISOString(),
        );
        if (!item?.id) break;
        try {
          await processQueueItem(item);
        } catch (error) {
          const attempts = Number(item?.attempts || 0) + 1;
          const failed = attempts >= maxAttempts;
          const nextAttemptAt = new Date(
            Date.now() + Math.min(15 * 60, 2 ** attempts) * 1000,
          ).toISOString();
          markRemoteChannelQueueItemRetry?.(item.id, {
            failed,
            nextAttemptAt,
            error: errorMessage(error),
          });
          updateRemoteChannelSourceError?.(item.source_id, errorMessage(error));
        }
      }
    } finally {
      queueRunning = false;
    }
  }

  function start() {
    if (!enabled || !stopped) return;
    stopped = false;
    log("starting", { pollIntervalMs, pollLimit });
    void pollOnce().then(() => runQueueOnce());
    timer = setInterval(() => void pollOnce(), pollIntervalMs);
    queueTimer = setInterval(() => void runQueueOnce(), queueIntervalMs);
    timer.unref?.();
    queueTimer.unref?.();
  }

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    if (queueTimer) clearInterval(queueTimer);
    timer = null;
    queueTimer = null;
    if (client) void client.disconnect().catch(() => {});
  }

  return {
    start,
    stop,
    isEnabled: () => enabled,
    syncSourceMetadata,
  };
}

export {
  createRemoteChannelManager,
  getTelegramClientConnectionOptions,
  normalizeTelegramSource,
  parseTelegramProxy,
};
