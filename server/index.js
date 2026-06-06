import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import compression from "compression";
import rateLimit from "express-rate-limit";
import multer from "multer";
import webpush from "web-push";
import { registerApiRoutes } from "./api/index.js";
import { ensureValidVapidKeys } from "./lib/vapid.js";
import { createSseHub } from "./lib/sse.js";
import { initWebhookDispatcher, fireWebhookEvent } from "./lib/webhookDispatcher.js";
import { createPushService } from "./lib/push.js";
import { createFirebaseAdmin } from "./lib/firebaseAdmin.js";
import { createFcmService } from "./lib/fcm.js";
import { createUploadTools } from "./lib/uploads.js";
import { createVideoTranscodeManager } from "./lib/videoTranscode.js";
import { createMessageFileJobs } from "./lib/messageFileJobs.js";
import { createInspector } from "./lib/inspect.js";
import { createSessionHelpers } from "./lib/sessions.js";
import { storageEncryption } from "./lib/storageEncryption.js";
import { createRemoteChannelManager } from "./lib/remoteChannels.js";
import { buildTimestampSchedule } from "./lib/timeUtils.js";
import {
  getMaintenanceState,
  getRuntimeSettings,
  resolveRuntimeFlag,
} from "./lib/runtimeSettings.js";
import { isLoopbackRequest, parseUploadFileMetadata } from "./lib/requestUtils.js";
import { getGroupCallLimits } from "./lib/groupCallConfig.js";
import { registerSfuSocketHandlers } from "./lib/sfu/sfuSocketHandlers.js";
import { USER_COLORS, setUserColor } from "./settings/colors.js";
import { readEnvBool, readEnvInt, readEnvString } from "./settings/env.js";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import {
  addChatMember,
  adminGetAll,
  adminGetRow,
  adminRun,
  adminSave,
  applyRequiredChannelsToAllUsers,
  applyRequiredChannelsToUser,
  ensureSavedChatForUser,
  clearChatMemberLeft,
  clearGroupMemberRemoved,
  createChat,
  createCallLog,
  createMessageFiles,
  createMessage,
  createOrReuseMessage,
  editMessage,
  createSession,
  deleteSession,
  createUser,
  deleteChatById,
  deleteUserById,
  findChatById,
  findDmChat,
  findChatByGroupUsername,
  findChatByInviteToken,
  findMessageIdByClientRequestId,
  findMessageById,
  hideMessageForEveryone,
  hideMessageForUser,
  findUserById,
  findUserByExactUsername,
  findUserByUsername,
  usersShareNonDmChat,
  isBlockedBetween,
  isDmRejectionCooldownActive,
  countDmInitiationsToday,
  countNonSystemMessagesInChat,
  getDmChatRow,
  setChatDmState,
  listDmRequestsForUser,
  recordDmRejection,
  blockUser,
  unblockUser,
  updateUserDmPolicy,
  finishCallLog,
  claimNextRemoteChannelQueueItem,
  enqueueRemoteChannelQueueItem,
  getMessageReadCounts,
  getMessageAuthors,
  getMessageReadByUser,
  getMessages,
  getRemoteChannelQueueSummary,
  getRemoteChannelSourceByChatId,
  getRemoteChannelSourceById,
  recordMessageReads,
  listEnabledRemoteChannelSources,
  listMessageFilesByMessageIds,
  markGroupMemberRemoved,
  markChatMemberLeft,
  markRemoteChannelQueueItemDone,
  markRemoteChannelQueueItemRetry,
  markRemoteChannelQueueItemSkipped,
  regenerateGroupInviteToken,
  removeChatMember,
  releaseStaleRemoteChannelQueueItems,
  setMessageExpiresAt,
  setMessageForwardOrigin,
  getSession,
  isMember,
  isGroupMemberRemoved,
  isRequiredChannel,
  listChatMembers,
  listCallLogsForChat,
  listCallLogsForUser,
  listChatsForUser,
  listArchivedChatsForUser,
  listAvailableRequiredChannels,
  listUsers,
  listRequiredChannels,
  searchUsers,
  searchPublicGroups,
  searchPublicChannels,
  setChatMuted,
  setChatPinned,
  setChatArchived,
  setChatMuteUntil,
  setChatNotifyMode,
  listSessionsForUser,
  deleteSessionByIdForUser,
  deleteOtherSessionsForUser,
  updateUserNotificationPrefs,
  createScheduledMessage,
  listScheduledMessagesForUser,
  deleteScheduledMessageForUser,
  setSessionAdmin2faVerified,
  isSessionAdmin2faFresh,
  getAppBranding,
  updateUserUiAccent,
  isGroupE2eeEnabled,
  setGroupE2eeEnabled,
  upsertGroupE2eeWrappedKey,
  listGroupE2eeWrappedKeys,
  getGroupE2eeWrappedKey,
  touchSession,
  updateLastSeen,
  getUserPresence,
  hideChatsForUser,
  markMessagesRead,
  markMessageRead,
  markCallLogAccepted,
  updateUserPassword,
  updateUserProfile,
  updateUserStatus,
  updateGroupChat,
  updateChannelChat,
  updateRemoteChannelSourceError,
  updateRemoteChannelSourceSeen,
  unhideChat,
  getChatMemberRole,
  setChatMemberRole,
  upsertPushSubscription,
  upsertRemoteChannelSource,
  deletePushSubscription,
  listPushSubscriptionsByUserIds,
  upsertDeviceToken,
  deleteDeviceToken,
  listDeviceTokensByUserIds,
  pinMessage,
  unpinMessage,
  listPinnedMessages,
  getPinnedMessageCount,
  listMutedUserIdsForChat,
  getMessageReactions,
  createPollMessage,
  votePollMessage,
  getPollsForMessageIds,
  setRequiredChannels,
  toggleMessageReaction,
  areUsersContacts,
  addMutualUserContacts,
  removeUserContact,
  getPendingContactRequest,
  getContactRequestById,
  createContactRequest,
  acceptContactRequest,
  rejectContactRequest,
  cancelContactRequest,
  cancelPendingContactRequestsBetween,
  removeMutualUserContacts,
  listOutgoingContactRequests,
  listBlockedUsers,
  isUserBlockedBy,
  updateUserContactRequestPolicy,
  listUserContacts,
  listIncomingContactRequests,
  getContactPeerStatus,
} from "./db.js";
import { createCallPresenceTracker } from "./lib/callPresence.js";

process.title = "birdx-server";

const app = express();
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRootDir = path.resolve(serverDir, "..");
dotenv.config({ path: path.join(projectRootDir, ".env") });
dotenv.config({ path: path.join(serverDir, ".env"), override: true });

const port = process.env.SERVER_PORT || process.env.PORT || 5174;
const appEnv = process.env.APP_ENV || "production";
const isProduction = appEnv === "production";
const APP_DEBUG = readEnvBool("APP_DEBUG", false);

function debugLog(...args) {
  if (!APP_DEBUG) return;
  console.log("[app-debug]", ...args);
}

const debugRouteCounts = new Map();

if (APP_DEBUG) {
  setInterval(() => {
    const entries = Array.from(debugRouteCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([route, count]) => ({ route, count }));

    debugLog("api:requests-per-minute", { routes: entries });

    debugRouteCounts.clear();
  }, 60 * 1000);
}

app.set("trust proxy", 1);

app.use(express.json({ limit: "1mb" }));
app.use(
  compression({
    threshold: 1024,
    filter(req, res) {
      if (req.path === "/api/events") return false;
      const contentType = String(res.getHeader("Content-Type") || "").toLowerCase();
      if (contentType.includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

if (APP_DEBUG) {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    let responseBody = null;
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      const routeKey = `${String(req.method || "GET").toUpperCase()} ${
        String(req.path || req.originalUrl || req.url || "").split("?")[0]
      }`;

      debugRouteCounts.set(
        routeKey,
        Number(debugRouteCounts.get(routeKey) || 0) + 1,
      );

      debugLog("api:request", {
        method: req.method,
        path: req.originalUrl || req.url || "",
        query: req.query || {},
        params: req.params || {},
        body: req.body || {},
        status: Number(res.statusCode || 0),
        durationMs: Date.now() - startedAt,
        response: responseBody,
      });
    });
    next();
  });
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});

const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});

const USERNAME_REGEX = /^[a-z0-9._]+$/;
const USERNAME_MAX = readEnvInt("USERNAME_MAX", 16, { min: 3, max: 32 });
const NICKNAME_MAX = readEnvInt("NICKNAME_MAX", 24, { min: 3, max: 64 });
const MESSAGE_MAX_CHARS = readEnvInt(
  ["MESSAGE_MAX_CHARS", "MESSAGE_MAX"],
  4000,
  { min: 1, max: 20000 },
);
const ACCOUNT_CREATION = readEnvBool("ACCOUNT_CREATION", true);
const ADMIN_USERNAMES = String(
  process.env.ADMIN_USERNAMES || process.env.BIRDX_ADMIN_USERNAMES || "",
)
  .split(/[,\s]+/)
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const vapid = ensureValidVapidKeys({ projectRootDir, fs, path, webpush });
const dataDir = path.resolve(serverDir, "..", "data");
const uploadRootDir = path.join(dataDir, "uploads", "messages");
const avatarUploadRootDir = path.join(dataDir, "uploads", "avatars");

const FILE_UPLOAD_MAX_SIZE = readEnvInt(
  "FILE_UPLOAD_MAX_SIZE",
  50 * 1024 * 1024,
  { min: 1024 },
);

const FILE_UPLOAD_MAX_FILES = readEnvInt("FILE_UPLOAD_MAX_FILES", 10, {
  min: 1,
});

const FILE_UPLOAD_MAX_TOTAL_SIZE = readEnvInt(
  "FILE_UPLOAD_MAX_TOTAL_SIZE",
  150 * 1024 * 1024,
);

const MESSAGE_FILE_RETENTION_DAYS = readEnvInt("MESSAGE_FILE_RETENTION", 7, {
  min: 0,
  max: 3650,
});
const MESSAGE_TEXT_RETENTION_DAYS = readEnvInt("MESSAGE_TEXT_RETENTION", 0, {
  min: 0,
  max: 3650,
});

const TRANSCODE_VIDEOS_TO_H264 = readEnvBool(
  "FILE_UPLOAD_TRANSCODE_VIDEOS",
  true,
);

const FILE_UPLOAD = readEnvBool("FILE_UPLOAD", true);
const REMOTE_CHANNEL = readEnvBool("REMOTE_CHANNEL", false);
const REMOTE_CHANNEL_TELEGRAM_API_ID = readEnvInt(
  "REMOTE_CHANNEL_TELEGRAM_API_ID",
  0,
  { min: 1 },
);
const REMOTE_CHANNEL_TELEGRAM_API_HASH = String(
  process.env.REMOTE_CHANNEL_TELEGRAM_API_HASH || "",
).trim();
const REMOTE_CHANNEL_TELEGRAM_SESSION_STRING = String(
  process.env.REMOTE_CHANNEL_TELEGRAM_SESSION_STRING || "",
).trim();
const REMOTE_CHANNEL_PROXY_URL = String(
  process.env.REMOTE_CHANNEL_PROXY_URL || "",
).trim();
const REMOTE_CHANNEL_TELEGRAM_CONFIGURED = Boolean(
  REMOTE_CHANNEL_TELEGRAM_API_ID &&
    REMOTE_CHANNEL_TELEGRAM_API_HASH &&
    REMOTE_CHANNEL_TELEGRAM_SESSION_STRING,
);
const REMOTE_CHANNEL_CONFIG = {
  enabled: REMOTE_CHANNEL,
  telegramConfigured: REMOTE_CHANNEL_TELEGRAM_CONFIGURED,
  proxyConfigured: Boolean(REMOTE_CHANNEL_PROXY_URL),
  telegramApiId: REMOTE_CHANNEL_TELEGRAM_API_ID,
  telegramApiHash: REMOTE_CHANNEL_TELEGRAM_API_HASH,
  telegramSessionString: REMOTE_CHANNEL_TELEGRAM_SESSION_STRING,
  proxyUrl: REMOTE_CHANNEL_PROXY_URL,
  pollIntervalMs: readEnvInt("REMOTE_CHANNEL_POLL_INTERVAL_MS", 5000, {
    min: 1000,
  }),
  telegramPollLimit: readEnvInt("REMOTE_CHANNEL_TELEGRAM_POLL_LIMIT", 50, {
    min: 1,
    max: 100,
  }),
  queueIntervalMs: readEnvInt("REMOTE_CHANNEL_QUEUE_INTERVAL_MS", 1000, {
    min: 100,
  }),
  queueMaxAttempts: readEnvInt("REMOTE_CHANNEL_QUEUE_MAX_ATTEMPTS", 10, {
    min: 1,
    max: 100,
  }),
  queueStaleLockMs: readEnvInt("REMOTE_CHANNEL_QUEUE_STALE_LOCK_MS", 300000, {
    min: 10000,
  }),
  messageMaxChars: MESSAGE_MAX_CHARS,
};
const MESSAGE_FILE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const uploadTools = createUploadTools({
  fs,
  path,
  crypto,
  multer,
  adminGetRow,
  adminRun,
  adminSave,
  uploadRootDir,
  avatarUploadRootDir,
  fileUploadMaxSize: FILE_UPLOAD_MAX_SIZE,
  fileUploadMaxFiles: FILE_UPLOAD_MAX_FILES,
  fileUploadMaxTotalSize: FILE_UPLOAD_MAX_TOTAL_SIZE,
  storageEncryption,
});

const {
  MESSAGE_FILE_LIMITS,
  AVATAR_FILE_LIMITS,
  ALLOWED_AVATAR_MIME_TYPES,
  uploadFiles,
  uploadAvatar,
  buildDownloadFilename,
  buildAsciiFallbackFilename,
  decodeOriginalFilename,
  inferMimeFromFilename,
  getUploadKind,
  removeUploadedFiles,
  removeStoredFileNames,
  removeAvatarByUrl,
  resolveAvatarDiskPath,
  normalizeAvatarPublicUrl,
  ensureAvatarExists,
  isDangerousUploadFile,
  registerUploadRoutes,
} = uploadTools;

const { addSseClient, removeSseClient, emitSseEvent, emitChatEvent } = createSseHub({
  listChatMembers,
});

const { setUserInCall, isUserInActiveCall } = createCallPresenceTracker({
  findUserById,
  listChatsForUser,
  listChatMembers,
  emitSseEvent,
});

const callRoomParticipants = new Map();

function trackCallParticipantJoin(roomId, userId) {
  const uid = Number(userId || 0);
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId || !uid) return;
  let users = callRoomParticipants.get(normalizedRoomId);
  if (!users) {
    users = new Set();
    callRoomParticipants.set(normalizedRoomId, users);
  }
  if (!users.has(uid)) {
    users.add(uid);
    setUserInCall(uid, true);
  }
}

function trackCallRoomEnded(roomId) {
  const normalizedRoomId = String(roomId || "").trim();
  const users = callRoomParticipants.get(normalizedRoomId);
  if (!users) return;
  callRoomParticipants.delete(normalizedRoomId);
  users.forEach((uid) => setUserInCall(uid, false));
}

const firebaseAdmin = createFirebaseAdmin({ readEnvString });
const fcmService = createFcmService({
  firebaseAdmin,
  listDeviceTokensByUserIds,
  deleteDeviceToken,
});

const pushService = createPushService({
  webpush,
  listPushSubscriptionsByUserIds,
  deletePushSubscription,
  vapid,
  fcmService,
  findUserById,
});
const { PUSH_ENABLED, VAPID_PUBLIC_KEY, sendPushNotificationToUsers } = pushService;

const videoTranscoder = createVideoTranscodeManager({
  spawn,
  fs,
  path,
  crypto,
  adminRun,
  adminGetRow,
  adminSave,
  listMessageFilesByMessageIds,
  emitChatEvent,
  debugLog,
  uploadRootDir,
  transcodeVideosToH264: TRANSCODE_VIDEOS_TO_H264,
  storageEncryption,
});
const {
  enqueueVideoTranscodeJob,
  ensureFfmpegAvailable,
  probeVideoMetadata,
  isVideoFileProcessing,
  hydrateMissingVideoMetadata,
  summarizeMessageFiles,
  sanitizePositiveInt,
  sanitizeDurationSeconds,
} = videoTranscoder;

const messageFileJobs = createMessageFileJobs({
  adminGetAll,
  adminGetRow,
  adminRun,
  adminSave,
  listMessageFilesByMessageIds,
  removeStoredFileNames,
  uploadRootDir,
  fs,
  path,
  messageFileRetentionDays: MESSAGE_FILE_RETENTION_DAYS,
});
const {
  chunkArray,
  cleanupMissingMessageFiles,
  cleanupExpiredMessageFiles,
  backfillMessageFileExpiry,
  removeAllMessageUploads,
  computeExpiryIso,
} = messageFileJobs;

const inspector = createInspector({ fs, dataDir, adminGetRow, adminGetAll });
const { buildInspectSnapshot, hasEnoughFreeDiskSpace } = inspector;

const sessionHelpers = createSessionHelpers({
  getSession,
  touchSession,
  isProduction,
});
const {
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  requireSession,
  requireSessionUsernameMatch,
} = sessionHelpers;

function bootstrapEnvAdmins() {
  if (!ADMIN_USERNAMES.length) return;
  try {
    const placeholders = ADMIN_USERNAMES.map(() => "?").join(", ");
    const rows = adminGetAll(
      `SELECT id, username FROM users WHERE lower(username) IN (${placeholders})`,
      ADMIN_USERNAMES,
    );
    if (!rows.length) {
      console.warn(
        "[admin] ADMIN_USERNAMES is set, but no matching users were found:",
        ADMIN_USERNAMES.join(", "),
      );
      return;
    }
    adminRun(
      `UPDATE users
       SET role = 'owner', banned = 0
       WHERE lower(username) IN (${placeholders})`,
      ADMIN_USERNAMES,
    );
    adminSave();
    console.log(
      "[admin] Bootstrapped admin users:",
      rows.map((row) => row.username).join(", "),
    );
  } catch (error) {
    console.warn("[admin] Unable to bootstrap ADMIN_USERNAMES:", String(error?.message || error));
  }
}

function backfillStorageEncryption() {
  if (!storageEncryption.isEnabled()) return;

  try {
    const pendingMessages = adminGetAll(
      `SELECT id, body
       FROM chat_messages
       WHERE body IS NOT NULL
         AND body != ''`,
    );
    let encryptedMessages = 0;

    pendingMessages.forEach((row) => {
      const body = String(row?.body || "");
      const nextBody = storageEncryption.encryptText(body);
      if (nextBody === body) return;

      adminRun("UPDATE chat_messages SET body = ? WHERE id = ?", [
        nextBody,
        Number(row.id),
      ]);
      encryptedMessages += 1;
    });

    const fileRows = adminGetAll("SELECT stored_name FROM chat_message_files");
    let encryptedFiles = 0;

    fileRows.forEach((row) => {
      const storedName = path.basename(String(row?.stored_name || "").trim());
      if (!storedName) return;

      const filePath = path.join(uploadRootDir, storedName);
      if (!fs.existsSync(filePath)) return;

      if (storageEncryption.encryptFileInPlace(filePath)) {
        encryptedFiles += 1;
      }
    });

    if (encryptedMessages > 0 || encryptedFiles > 0) {
      adminSave();
      console.log(
        `[storage-encryption] encrypted ${encryptedMessages} message(s) and ${encryptedFiles} file(s) at rest.`,
      );
    }
  } catch (error) {
    console.error(
      `[storage-encryption] backfill failed: ${String(error?.message || error)}`,
    );
  }
}

registerUploadRoutes(app, { express, adminGetRow });

if (isProduction) {
  app.use("/api", apiLimiter);
}







const apiDeps = {
  ALLOWED_AVATAR_MIME_TYPES,
  APP_DEBUG,
  AVATAR_FILE_LIMITS,
  FILE_UPLOAD,
  getAccountCreationEnabled: () =>
    resolveRuntimeFlag(getRuntimeSettings(adminGetRow).accountCreation, ACCOUNT_CREATION),
  getFileUploadEnabled: () =>
    resolveRuntimeFlag(getRuntimeSettings(adminGetRow).fileUpload, FILE_UPLOAD),
  getMaintenanceState: () => getMaintenanceState(adminGetRow),
  MESSAGE_FILE_LIMITS,
  MESSAGE_FILE_RETENTION_DAYS,
  MESSAGE_TEXT_RETENTION_DAYS,
  TRANSCODE_VIDEOS_TO_H264,
  USER_COLORS,
  NICKNAME_MAX,
  USERNAME_MAX,
  MESSAGE_MAX_CHARS,
  ACCOUNT_CREATION,
  APP_ENV: appEnv,
  ADMIN_USERNAMES,
  REMOTE_CHANNELS: {
    enabled: REMOTE_CHANNEL_CONFIG.enabled,
    telegramConfigured: REMOTE_CHANNEL_CONFIG.telegramConfigured,
    proxyConfigured: REMOTE_CHANNEL_CONFIG.proxyConfigured,
  },
  USERNAME_REGEX,
  VAPID_PUBLIC_KEY: PUSH_ENABLED ? VAPID_PUBLIC_KEY : "",
  addChatMember,
  applyRequiredChannelsToAllUsers,
  applyRequiredChannelsToUser,
  addSseClient,
  adminGetAll,
  adminGetRow,
  adminRun,
  adminSave,
  ensureSavedChatForUser,
  avatarUploadRootDir,
  bcrypt,
  buildInspectSnapshot,
  buildTimestampSchedule,
  claimNextRemoteChannelQueueItem,
  chunkArray,
  cleanupMissingMessageFiles,
  clearGroupMemberRemoved,
  clearChatMemberLeft,
  clearSessionCookie,
  computeExpiryIso,
  createChat,
  createCallLog,
  createMessage,
  createOrReuseMessage,
  createMessageFiles,
  editMessage,
  createSession,
  createUser,
  crypto,
  debugLog,
  decodeOriginalFilename,
  deleteSession,
  deleteChatById,
  deleteUserById,
  emitChatEvent,
  emitSseEvent,
  enqueueRemoteChannelQueueItem,
  enqueueVideoTranscodeJob,
  ensureAvatarExists,
  ensureFfmpegAvailable,
  findChatById,
  findDmChat,
  findChatByGroupUsername,
  findChatByInviteToken,
  findMessageIdByClientRequestId,
  findMessageById,
  findUserById,
  findUserByExactUsername,
  findUserByUsername,
  usersShareNonDmChat,
  isBlockedBetween,
  isDmRejectionCooldownActive,
  countDmInitiationsToday,
  countNonSystemMessagesInChat,
  getDmChatRow,
  setChatDmState,
  listDmRequestsForUser,
  recordDmRejection,
  blockUser,
  unblockUser,
  updateUserDmPolicy,
  finishCallLog,
  fs,
  getMessageReadCounts,
  getMessageAuthors,
  getMessageReadByUser,
  getMessages,
  getRemoteChannelQueueSummary,
  getRemoteChannelSourceByChatId,
  getRemoteChannelSourceById,
  getSessionFromRequest,
  getUploadKind,
  getUserPresence,
  hasEnoughFreeDiskSpace,
  hideChatsForUser,
  hideMessageForEveryone,
  hideMessageForUser,
  hydrateMissingVideoMetadata,
  inferMimeFromFilename,
  isDangerousUploadFile,
  isLoopbackRequest,
  isMember,
  isGroupMemberRemoved,
  isRequiredChannel,
  isVideoFileProcessing,
  listPushSubscriptionsByUserIds,
  upsertDeviceToken,
  deleteDeviceToken,
  listDeviceTokensByUserIds,
  pinMessage,
  unpinMessage,
  listPinnedMessages,
  getPinnedMessageCount,
  listCallLogsForChat,
  listCallLogsForUser,
  listChatMembers,
  listChatsForUser,
  listArchivedChatsForUser,
  listAvailableRequiredChannels,
  listEnabledRemoteChannelSources,
  listMessageFilesByMessageIds,
  listRequiredChannels,
  listUsers,
  setMessageForwardOrigin,
  getChatMemberRole,
  setChatMemberRole,
  recordMessageReads,
  markChatMemberLeft,
  markGroupMemberRemoved,
  markMessagesRead,
  markMessageRead,
  markCallLogAccepted,
  markRemoteChannelQueueItemDone,
  markRemoteChannelQueueItemRetry,
  markRemoteChannelQueueItemSkipped,
  parseCookies,
  parseUploadFileMetadata,
  path,
  projectRootDir,
  probeVideoMetadata,
  regenerateGroupInviteToken,
  releaseStaleRemoteChannelQueueItems,
  removeAllMessageUploads,
  removeAvatarByUrl,
  removeChatMember,
  deletePushSubscription,
  removeStoredFileNames,
  removeUploadedFiles,
  removeSseClient,
  requireSession,
  requireSessionUsernameMatch,
  sanitizeDurationSeconds,
  sanitizePositiveInt,
  searchUsers,
  searchPublicGroups,
  searchPublicChannels,
  setChatMuted,
  setChatPinned,
  setChatArchived,
  setChatMuteUntil,
  setChatNotifyMode,
  listSessionsForUser,
  deleteSessionByIdForUser,
  deleteOtherSessionsForUser,
  updateUserNotificationPrefs,
  createScheduledMessage,
  listScheduledMessagesForUser,
  deleteScheduledMessageForUser,
  setSessionAdmin2faVerified,
  isSessionAdmin2faFresh,
  getAppBranding,
  updateUserUiAccent,
  isGroupE2eeEnabled,
  setGroupE2eeEnabled,
  upsertGroupE2eeWrappedKey,
  listGroupE2eeWrappedKeys,
  getGroupE2eeWrappedKey,
  setRequiredChannels,
  setMessageExpiresAt,
  listMutedUserIdsForChat,
  setSessionCookie,
  setUserColor,
  updateLastSeen,
  updateGroupChat,
  updateChannelChat,
  updateRemoteChannelSourceError,
  updateRemoteChannelSourceSeen,
  unhideChat,
  updateUserPassword,
  updateUserProfile,
  updateUserStatus,
  uploadAvatar,
  uploadFiles,
  uploadRootDir,
  upsertPushSubscription,
  upsertRemoteChannelSource,
  sendPushNotificationToUsers,
  storageEncryption,
  getMessageReactions,
  toggleMessageReaction,
  createPollMessage,
  votePollMessage,
  getPollsForMessageIds,
  areUsersContacts,
  addMutualUserContacts,
  removeUserContact,
  getPendingContactRequest,
  getContactRequestById,
  createContactRequest,
  acceptContactRequest,
  rejectContactRequest,
  cancelContactRequest,
  cancelPendingContactRequestsBetween,
  removeMutualUserContacts,
  listOutgoingContactRequests,
  listBlockedUsers,
  isUserBlockedBy,
  updateUserContactRequestPolicy,
  listUserContacts,
  listIncomingContactRequests,
  getContactPeerStatus,
  isUserInActiveCall,
};

const remoteChannelManager = createRemoteChannelManager({
  config: REMOTE_CHANNEL_CONFIG,
  createOrReuseMessage,
  debugLog,
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
});

apiDeps.remoteChannelManager = remoteChannelManager;

registerApiRoutes(app, apiDeps);

initWebhookDispatcher({ adminGetAll, adminRun, adminSave });

apiDeps.fireWebhookEvent = fireWebhookEvent;

const clientDist = path.resolve(serverDir, "..", "client", "dist");
const clientDistIndex = path.join(clientDist, "index.html");
const hasClientDist = fs.existsSync(clientDistIndex);

const serveClientSpa = isProduction && hasClientDist;

if (isProduction && !hasClientDist) {
  console.warn(
    "[birdx] client/dist/index.html is missing. For local UI use Vite at http://localhost:5173 or run: npm run build",
  );
}

if (!serveClientSpa) {
  const devUiPort = process.env.VITE_DEV_PORT || 5173;
  app.get("/", (req, res) => {
    res.json({
      ok: true,
      name: "BirdX API",
      health: "/api/health",
      app: `http://localhost:${devUiPort}`,
    });
  });
}

if (serveClientSpa) {
  app.use(staticLimiter);

  const setStaticCacheHeaders = (res, filePath) => {
    const normalizedPath = String(filePath || "").replace(/\\/g, "/");
    if (
      normalizedPath.endsWith("/index.html") ||
      normalizedPath.endsWith("/sw.js") ||
      normalizedPath.endsWith("/manifest.webmanifest")
    ) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return;
    }
    if (normalizedPath.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
  };

  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: setStaticCacheHeaders,
    }),
  );

  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      if (req.path === "/api/profile/avatar") {
        return res.status(400).json({
          error: `Profile photo must be smaller than ${Math.round(AVATAR_FILE_LIMITS.maxFileSizeBytes / (1024 * 1024))} MB.`,
        });
      }

      return res.status(400).json({
        error: `Each file must be smaller than ${Math.round(MESSAGE_FILE_LIMITS.maxFileSizeBytes / (1024 * 1024))} MB.`,
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: `Maximum ${MESSAGE_FILE_LIMITS.maxFiles} files per message.`,
      });
    }

    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

function cleanupExpiredTextOnlyMessages() {
  if (MESSAGE_TEXT_RETENTION_DAYS <= 0) {
    return { removedMessages: 0 };
  }

  const rows = adminGetAll(
    `SELECT id, chat_id
     FROM chat_messages
     WHERE expires_at IS NOT NULL
       AND expires_at != ''
       AND hidden_everyone_at IS NULL
       AND julianday(expires_at) <= julianday(?)
       AND NOT EXISTS (
         SELECT 1
         FROM chat_message_files
         WHERE chat_message_files.message_id = chat_messages.id
       )`,
    [new Date().toISOString()],
  );

  const messageIds = rows
    .map((row) => Number(row?.id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!messageIds.length) {
    return { removedMessages: 0 };
  }

  const deletedByChat = new Map();
  rows.forEach((row) => {
    const chatId = Number(row?.chat_id || 0);
    const messageId = Number(row?.id || 0);
    if (!chatId || !messageId) return;
    const list = deletedByChat.get(chatId) || [];
    list.push(messageId);
    deletedByChat.set(chatId, list);
  });

  adminRun("BEGIN");
  try {
    chunkArray(messageIds, 500).forEach((chunk) => {
      const placeholders = chunk.map(() => "?").join(", ");
      adminRun(
        `DELETE FROM chat_message_reads WHERE message_id IN (${placeholders})`,
        chunk,
      );
      adminRun(
        `DELETE FROM hidden_chat_messages WHERE message_id IN (${placeholders})`,
        chunk,
      );
      adminRun(`DELETE FROM chat_messages WHERE id IN (${placeholders})`, chunk);
    });
    adminRun("COMMIT");
  } catch (error) {
    adminRun("ROLLBACK");
    throw error;
  }

  adminSave();
  deletedByChat.forEach((ids, chatId) => {
    emitChatEvent(Number(chatId), {
      type: "chat_message_deleted",
      chatId: Number(chatId),
      messageIds: ids,
    });
  });

  return { removedMessages: messageIds.length };
}

function backfillTextMessageExpiry() {
  if (MESSAGE_TEXT_RETENTION_DAYS <= 0) return 0;

  const row = adminGetRow(
    `SELECT COUNT(*) AS n
     FROM chat_messages
     WHERE (expires_at IS NULL OR expires_at = '')
       AND hidden_everyone_at IS NULL
       AND body IS NOT NULL
       AND TRIM(body) != ''
       AND body NOT LIKE '[[system:%]]'
       AND NOT EXISTS (
         SELECT 1
         FROM chat_message_files
         WHERE chat_message_files.message_id = chat_messages.id
       )`,
  );

  const pending = Number(row?.n || 0);
  if (!pending) return 0;

  adminRun(
    `UPDATE chat_messages
     SET expires_at = datetime(created_at, '+' || ? || ' days')
     WHERE (expires_at IS NULL OR expires_at = '')
       AND hidden_everyone_at IS NULL
       AND body IS NOT NULL
       AND TRIM(body) != ''
       AND body NOT LIKE '[[system:%]]'
       AND NOT EXISTS (
         SELECT 1
         FROM chat_message_files
         WHERE chat_message_files.message_id = chat_messages.id
       )`,
    [MESSAGE_TEXT_RETENTION_DAYS],
  );

  adminSave();
  return pending;
}

if (MESSAGE_FILE_RETENTION_DAYS > 0) {
  try {
    backfillMessageFileExpiry();
    cleanupExpiredMessageFiles();
  } catch (_) {
    // best effort startup cleanup
  }

  const expiryCleanupTimer = setInterval(() => {
    try {
      cleanupExpiredMessageFiles();
    } catch (_) {
      // keep server alive if cleanup fails
    }
  }, MESSAGE_FILE_CLEANUP_INTERVAL_MS);

  if (typeof expiryCleanupTimer.unref === "function") {
    expiryCleanupTimer.unref();
  }
}

if (MESSAGE_TEXT_RETENTION_DAYS > 0) {
  try {
    backfillTextMessageExpiry();
    cleanupExpiredTextOnlyMessages();
  } catch (_) {
    // best effort startup cleanup
  }

  const textCleanupTimer = setInterval(() => {
    try {
      backfillTextMessageExpiry();
      cleanupExpiredTextOnlyMessages();
    } catch (_) {
      // keep server alive if cleanup fails
    }
  }, MESSAGE_FILE_CLEANUP_INTERVAL_MS);

  if (typeof textCleanupTimer.unref === "function") {
    textCleanupTimer.unref();
  }
}

bootstrapEnvAdmins();
backfillStorageEncryption();
remoteChannelManager.start();

const httpServer = createServer(app);

// Allowed origins for Socket.io CORS. Configure via APP_ALLOWED_ORIGINS
// (comma/space separated). Capacitor/mobile WebView origins are always allowed.
const ALLOWED_ORIGINS = String(process.env.APP_ALLOWED_ORIGINS || "")
  .split(/[,\s]+/)
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const ALWAYS_ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
]);

function isOriginAllowed(origin) {
  // No origin header = same-origin / native request → allow.
  if (!origin) return true;
  const normalized = String(origin).toLowerCase();
  if (ALWAYS_ALLOWED_ORIGINS.has(normalized)) return true;
  if (ALLOWED_ORIGINS.includes(normalized)) return true;
  // If no explicit allow-list is configured, reflect the request origin.
  // Socket.io still enforces session auth (cookie/token) below.
  if (!ALLOWED_ORIGINS.length) return true;
  return false;
}

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isProduction
      ? (origin, callback) => callback(null, isOriginAllowed(origin))
      : "*",
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake?.headers?.cookie || "";
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      if (name) acc[name] = decodeURIComponent(rest.join("="));
      return acc;
    }, {});

    // Try cookie-based auth first, then fall back to auth.token (for mobile/Capacitor)
    const sid = cookies.sid || socket.handshake?.auth?.token || "";
    if (!sid) return next(new Error("Authentication required"));
    const session = getSession(sid);
    if (!session) return next(new Error("Invalid session"));
    socket.data = { userId: session.id, username: session.username };
    next();
  } catch {
    next(new Error("Authentication failed"));
  }
});

const activeCalls = new Map();
const liveCalls = new Map();
const callDisconnectTimers = new Map();
const CALL_DISCONNECT_GRACE_MS = 45000;

function clearCallDisconnectTimer(roomId) {
  const timer = callDisconnectTimers.get(roomId);
  if (!timer) return;
  clearTimeout(timer);
  callDisconnectTimers.delete(roomId);
}

function scheduleCallDisconnectEnd(roomId) {
  if (!roomId || callDisconnectTimers.has(roomId)) return;
  const timer = setTimeout(() => {
    callDisconnectTimers.delete(roomId);
    activeCalls.delete(roomId);
    liveCalls.delete(roomId);
    trackCallRoomEnded(roomId);
    finishCallLog({
      roomId,
      status: "disconnect_timeout",
      reason: "disconnect_timeout",
    });
    io.to(roomId).emit("call-ended", { roomId, reason: "disconnect_timeout" });
  }, CALL_DISCONNECT_GRACE_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  callDisconnectTimers.set(roomId, timer);
}

function parseCallRoomChatId(roomId) {
  const match = String(roomId || "").match(/^chat-(\d+)$/);
  if (!match) return 0;
  return Number(match[1] || 0);
}

function isGroupChatRoom(chatId) {
  const chat = findChatById(Number(chatId || 0));
  return String(chat?.type || "").toLowerCase() === "group";
}

function countCallRoomParticipants(roomId) {
  const live = liveCalls.get(roomId);
  if (live?.size) return live.size;
  const room = io.sockets.adapter.rooms.get(roomId);
  return room?.size || 0;
}

function emitGroupCallParticipantCount(roomId) {
  const chatId = parseCallRoomChatId(roomId);
  if (!isGroupChatRoom(chatId)) return;
  const count = countCallRoomParticipants(roomId);
  io.to(roomId).emit("call-participant-count", {
    roomId,
    count,
    maxParticipants: getGroupCallLimits().maxParticipants,
  });
}

function normalizeCallType(callType) {
  return String(callType || "voice").toLowerCase() === "video" ? "video" : "voice";
}

async function notifyIncomingCallByPush({
  roomId,
  chatId,
  callType,
  callerUserId,
  callerName,
}) {
  const normalizedCallType = normalizeCallType(callType);
  const targetChatId = Number(chatId || parseCallRoomChatId(roomId) || 0);
  if (!targetChatId) return;
  const chat = findChatById(targetChatId);
  if (!chat) return;

  const chatType = String(chat.type || "").toLowerCase();
  const members = listChatMembers(targetChatId);
  const mutedRows = listMutedUserIdsForChat(targetChatId);
  const mutedIds = new Set(
    mutedRows.map((row) => Number(row?.user_id || 0)).filter(Boolean),
  );
  const callerId = Number(callerUserId || 0);
  const recipientIds = members
    .map((member) => Number(member?.id || 0))
    .filter(
      (memberId) =>
        Number.isFinite(memberId) &&
        memberId > 0 &&
        memberId !== callerId &&
        !mutedIds.has(memberId),
    );
  if (!recipientIds.length) return;

  const isGroupCall = chatType === "group" || chatType === "channel";
  const title = isGroupCall
    ? `Incoming group ${normalizedCallType} call`
    : `Incoming ${normalizedCallType} call`;
  const body = isGroupCall
    ? `${callerName || "Someone"} started a call in ${chat.name || "group"}`
    : `${callerName || "Someone"} is calling...`;

  await sendPushNotificationToUsers(recipientIds, {
    title,
    body,
    data: {
      type: "incoming_call",
      chatId: targetChatId,
      callType: normalizedCallType,
      roomId,
      isGroup: isGroupCall,
      url: `/chat?openChatId=${encodeURIComponent(String(targetChatId))}`,
    },
  });
}

io.on("connection", (socket) => {
  console.log("SOCKET CONNECTED:", socket.id);
  const socketCallRooms = new Set();
  const socketCallUserId = { value: null };
  const cleanupSfu = registerSfuSocketHandlers(io, socket);

  socket.on("join-call", (roomId) => {
    if (!roomId) return;
    console.log("JOIN CALL:", socket.id, roomId);
    const targetChatId = parseCallRoomChatId(roomId);
    if (targetChatId && isGroupChatRoom(targetChatId)) {
      const limits = getGroupCallLimits();
      const currentCount = countCallRoomParticipants(roomId);
      if (currentCount >= limits.maxParticipants) {
        socket.emit("call-error", {
          code: "room_full",
          roomId,
          maxParticipants: limits.maxParticipants,
        });
        return;
      }
    }
    socket.join(roomId);
    socketCallRooms.add(roomId);

    const activeCall = activeCalls.get(roomId);
    if (activeCall && activeCall.callerSocketId !== socket.id) {
      console.log("SEND PENDING INCOMING CALL:", socket.id, roomId);
      socket.emit("incoming-call", activeCall);
    }
    emitGroupCallParticipantCount(roomId);
  });

  socket.on("resume-call", ({ roomId }) => {
    if (!roomId) return;
    console.log("RESUME CALL:", socket.id, roomId);
    socket.join(roomId);
    socketCallRooms.add(roomId);
    clearCallDisconnectTimer(roomId);
    const participants = liveCalls.get(roomId);
    if (participants) {
      participants.add(socket.id);
    }
  });

  socket.on("leave-call", (payload) => {
    const roomId = typeof payload === "string" ? payload : payload?.roomId;
    if (!roomId) return;
    const endedByUserId =
      typeof payload === "object" ? Number(payload?.userId || 0) || null : null;
    console.log("LEAVE CALL:", socket.id, roomId);
    clearCallDisconnectTimer(roomId);
    activeCalls.delete(roomId);
    liveCalls.delete(roomId);
    trackCallRoomEnded(roomId);
    finishCallLog({
      roomId,
      status: "ended",
      endedByUserId,
      reason: "ended",
    });
    fireWebhookEvent("call.ended", {
      roomId,
      endedByUserId,
      reason: "ended",
    });
    socket.leave(roomId);
    socket.to(roomId).emit("call-ended", { roomId });
    emitGroupCallParticipantCount(roomId);
  });

  socket.on("call-user", ({ roomId, chatId, callType, callerUserId, callerUsername, callerName }) => {
    if (!roomId) return;
    if (callerUserId) socketCallUserId.value = Number(callerUserId);
    const normalizedCallType = normalizeCallType(callType);
    const targetChatId = Number(chatId || parseCallRoomChatId(roomId) || 0) || null;

    if (targetChatId && isGroupChatRoom(targetChatId)) {
      const limits = getGroupCallLimits();
      const memberCount = listChatMembers(targetChatId).length;
      if (memberCount < limits.minGroupMembers) {
        socket.emit("call-error", {
          code: "group_too_small",
          roomId,
          minGroupMembers: limits.minGroupMembers,
          currentMembers: memberCount,
        });
        return;
      }
      if (countCallRoomParticipants(roomId) >= limits.maxParticipants) {
        socket.emit("call-error", {
          code: "room_full",
          roomId,
          maxParticipants: limits.maxParticipants,
        });
        return;
      }
    }

    clearCallDisconnectTimer(roomId);
    socket.join(roomId);
    socketCallRooms.add(roomId);

    const payload = {
      roomId,
      chatId: targetChatId,
      callType: normalizedCallType,
      callerUserId: Number(callerUserId || 0) || null,
      callerUsername: callerUsername || "",
      callerName: callerName || "Someone",
      callerSocketId: socket.id,
    };

    activeCalls.set(roomId, payload);
    let liveParticipants = liveCalls.get(roomId);
    if (!liveParticipants) {
      liveParticipants = new Set();
      liveCalls.set(roomId, liveParticipants);
    }
    liveParticipants.add(socket.id);
    trackCallParticipantJoin(roomId, payload.callerUserId);
    const participantUserIds = listChatMembers(payload.chatId)
      .map((member) => Number(member?.id || 0))
      .filter(Boolean);
    createCallLog({
      chatId: payload.chatId,
      roomId,
      callerUserId: payload.callerUserId,
      participantUserIds,
      callType: normalizedCallType,
    });
    fireWebhookEvent("call.started", {
      roomId,
      chatId: payload.chatId,
      callType: normalizedCallType,
      callerUserId: payload.callerUserId,
    });

    console.log("CALL USER:", socket.id, roomId, callerName);
    console.log(
      "ROOM MEMBERS:",
      roomId,
      Array.from(io.sockets.adapter.rooms.get(roomId) || []),
    );

    socket.to(roomId).emit("incoming-call", payload);
    notifyIncomingCallByPush(payload).catch((error) => {
      console.warn("[call] incoming-call push failed:", String(error?.message || error));
    });
    emitGroupCallParticipantCount(roomId);
    console.log("INCOMING CALL EMITTED:", roomId);
  });

  socket.on("accept-call", ({ roomId, userId }) => {
    if (!roomId) return;
    if (userId) socketCallUserId.value = Number(userId);
    const targetChatId = parseCallRoomChatId(roomId);
    if (targetChatId && isGroupChatRoom(targetChatId)) {
      const limits = getGroupCallLimits();
      const currentCount = countCallRoomParticipants(roomId);
      if (currentCount >= limits.maxParticipants) {
        socket.emit("call-error", {
          code: "room_full",
          roomId,
          maxParticipants: limits.maxParticipants,
        });
        return;
      }
    }
    console.log("ACCEPT CALL:", socket.id, roomId);
    clearCallDisconnectTimer(roomId);
    socket.join(roomId);
    socketCallRooms.add(roomId);
    const activeCall = activeCalls.get(roomId);
    let participants = liveCalls.get(roomId);
    if (!participants) {
      participants = new Set();
      if (activeCall?.callerSocketId) {
        participants.add(activeCall.callerSocketId);
      }
      liveCalls.set(roomId, participants);
    }
    participants.add(socket.id);
    trackCallParticipantJoin(roomId, userId);
    if (activeCall?.callerUserId) {
      trackCallParticipantJoin(roomId, activeCall.callerUserId);
    }
    markCallLogAccepted({ roomId, acceptedByUserId: userId });
    activeCalls.delete(roomId);
    socket.to(roomId).emit("call-accepted", {
      roomId,
      participantSocketId: socket.id,
    });
    socket.to(roomId).emit("call-participant-joined", {
      roomId,
      socketId: socket.id,
      userId: Number(userId || 0) || null,
    });
    emitGroupCallParticipantCount(roomId);
  });

  socket.on("reject-call", ({ roomId, userId }) => {
    if (!roomId) return;
    console.log("REJECT CALL:", socket.id, roomId);
    clearCallDisconnectTimer(roomId);
    activeCalls.delete(roomId);
    finishCallLog({
      roomId,
      status: "rejected",
      endedByUserId: userId,
      reason: "rejected",
    });
    socket.to(roomId).emit("call-rejected", { roomId });
  });

  socket.on("offer", ({ roomId, offer, targetSocketId }) => {
    if (!roomId || !offer) return;
    console.log("OFFER:", socket.id, roomId, targetSocketId || "room");
    const payload = { roomId, offer, fromSocketId: socket.id };
    if (targetSocketId) {
      io.to(targetSocketId).emit("offer", payload);
      return;
    }
    socket.to(roomId).emit("offer", payload);
  });

  socket.on("answer", ({ roomId, answer, targetSocketId }) => {
    if (!roomId || !answer) return;
    console.log("ANSWER:", socket.id, roomId, targetSocketId || "room");
    const payload = { roomId, answer, fromSocketId: socket.id };
    if (targetSocketId) {
      io.to(targetSocketId).emit("answer", payload);
      return;
    }
    socket.to(roomId).emit("answer", payload);
  });

  socket.on("ice-candidate", ({ roomId, candidate, targetSocketId }) => {
    if (!roomId || !candidate) return;
    const payload = { roomId, candidate, fromSocketId: socket.id };
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", payload);
      return;
    }
    socket.to(roomId).emit("ice-candidate", payload);
  });

  socket.on("disconnect", () => {
    console.log("SOCKET DISCONNECTED:", socket.id);
    for (const roomId of socketCallRooms) {
      const uid = socketCallUserId.value;
      const users = callRoomParticipants.get(roomId);
      if (users && uid && users.has(uid)) {
        users.delete(uid);
        if (!users.size) callRoomParticipants.delete(roomId);
        setUserInCall(uid, false);
      }
    }
    for (const [roomId, activeCall] of activeCalls.entries()) {
      if (activeCall?.callerSocketId === socket.id) {
        scheduleCallDisconnectEnd(roomId);
      }
    }
    for (const roomId of socketCallRooms) {
      const participants = liveCalls.get(roomId);
      if (!participants?.has(socket.id)) continue;
      participants.delete(socket.id);
      emitGroupCallParticipantCount(roomId);
      scheduleCallDisconnectEnd(roomId);
    }
  });
});

httpServer.listen(port, () => {
  const devUiPort = process.env.VITE_DEV_PORT || 5173;
  console.log(`BirdX API: http://localhost:${port}`);
  if (!serveClientSpa) {
    console.log(`BirdX app (dev): http://localhost:${devUiPort}`);
  }
});
