import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import initSqlJs from "sql.js";
import { migrations } from "./migrations/index.js";
import { setUserColor } from "./settings/colors.js";
import {
  ensureStorageEncryptionKey,
  storageEncryption,
} from "./lib/storageEncryption.js";
import { resolveDatabasePath } from "./lib/dataPaths.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRootDir = path.resolve(serverDir, "..");
dotenv.config({ path: path.join(projectRootDir, ".env") });
dotenv.config({ path: path.join(serverDir, ".env"), override: true });
ensureStorageEncryptionKey({ projectRootDir, fsImpl: fs, pathImpl: path, cryptoImpl: crypto });
const dataDir = path.resolve(serverDir, "..", "data");
const dbPath = resolveDatabasePath(dataDir, fs);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const SQL = await initSqlJs({
  locateFile: (file) =>
    path.resolve(serverDir, "node_modules", "sql.js", "dist", file),
});

const fileExists = fs.existsSync(dbPath);
const fileBuffer = fileExists ? fs.readFileSync(dbPath) : null;
const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
const DB_SAVE_DEBOUNCE_MS = Math.max(
  0,
  Number(process.env.DB_SAVE_DEBOUNCE_MS || 150),
);
let pendingSaveTimer = null;
let databaseDirty = false;

function writeDatabaseToDisk() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  databaseDirty = false;
}

function saveDatabase() {
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }
  if (!databaseDirty && fileExists) return;
  writeDatabaseToDisk();
}

function scheduleDatabaseSave() {
  databaseDirty = true;
  if (pendingSaveTimer) return;
  if (DB_SAVE_DEBOUNCE_MS <= 0) {
    saveDatabase();
    return;
  }
  pendingSaveTimer = setTimeout(() => {
    pendingSaveTimer = null;
    if (!databaseDirty) return;
    writeDatabaseToDisk();
  }, DB_SAVE_DEBOUNCE_MS);
  if (typeof pendingSaveTimer?.unref === "function") {
    pendingSaveTimer.unref();
  }
}

function getRow(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const row = stmt.step() ? stmt.getAsObject() : null;

  stmt.free();

  return row;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();

  return rows;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);

  stmt.bind(params);
  stmt.step();
  stmt.free();

  scheduleDatabaseSave();
}

function runWithoutSave(sql, params = []) {
  const stmt = db.prepare(sql);

  stmt.bind(params);
  stmt.step();
  stmt.free();
}

function getLastInsertId() {
  const row = getRow("SELECT last_insert_rowid() AS id");
  return row?.id;
}

function decryptMessageRow(row) {
  if (!row) return row;

  const next = { ...row };

  if (typeof next.edited_body === "string") {
    next.edited_body = storageEncryption.decryptText(next.edited_body);
  }

  if (typeof next.body === "string") {
    next.body = storageEncryption.decryptText(next.body);
  }

  if (typeof next.last_message === "string") {
    next.last_message = storageEncryption.decryptText(next.last_message);
  }

  if (typeof next.reply_body === "string") {
    next.reply_body = storageEncryption.decryptText(next.reply_body);
  }

  return next;
}

function getVisibleMessageFilterSql(alias = "chat_messages", viewerClause = "") {
  const safeAlias = alias || "chat_messages";
  return `${safeAlias}.hidden_everyone_at IS NULL
    AND ${safeAlias}.id NOT IN (
      SELECT hidden_chat_messages.message_id
      FROM hidden_chat_messages
      ${viewerClause}
    )`;
}

function tableExists(name) {
  return Boolean(
    getRow("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [
      name,
    ]),
  );
}

function hasColumn(tableName, columnName) {
  return getAll(`PRAGMA table_info('${tableName}')`).some(
    (col) => col.name === columnName,
  );
}

function getSchemaVersion() {
  const row = getRow("PRAGMA user_version");
  return Number(row?.user_version || 0);
}

function setSchemaVersion(version) {
  db.run(`PRAGMA user_version = ${Number(version) || 0}`);
}

function runDatabaseMigrations() {
  const migrationContext = {
    db,
    getAll,
    tableExists,
    hasColumn,
    setUserColor,
  };

  const orderedMigrations = [...migrations].sort(
    (a, b) => a.version - b.version,
  );

  orderedMigrations.forEach((migration) => {
    if (getSchemaVersion() >= migration.version) return;

    migration.up(migrationContext);
    setSchemaVersion(migration.version);
  });

  // Self-heal schemas where PRAGMA user_version advanced but tables are missing.
  // All migrations are written to be idempotent (CREATE IF NOT EXISTS / guarded ALTERs),
  // so re-applying ensures critical tables exist.
  orderedMigrations.forEach((migration) => {
    migration.up(migrationContext);
  });

  const latestVersion = orderedMigrations.length
    ? Math.max(
        ...orderedMigrations.map((migration) => Number(migration.version) || 0),
      )
    : 0;

  if (getSchemaVersion() < latestVersion) {
    setSchemaVersion(latestVersion);
  }
}

runDatabaseMigrations();

saveDatabase();

const USER_ROLE_SELECT_SQL = hasColumn("users", "role") ? "role" : "'user' AS role";
const USER_ROLE_QUALIFIED_SELECT_SQL = hasColumn("users", "role")
  ? "users.role"
  : "'user' AS role";
const SESSIONS_HAS_IP_ADDRESS = hasColumn("sessions", "ip_address");
const SESSIONS_HAS_USER_AGENT = hasColumn("sessions", "user_agent");
const HAS_UPLOAD_POLICY_COLUMNS = hasColumn("users", "file_upload_max_size_bytes");
const UPLOAD_POLICY_SELECT_SQL = HAS_UPLOAD_POLICY_COLUMNS
  ? "file_upload_disabled, file_upload_max_size_bytes"
  : "0 AS file_upload_disabled, NULL AS file_upload_max_size_bytes";
const UPLOAD_POLICY_QUALIFIED_SELECT_SQL = HAS_UPLOAD_POLICY_COLUMNS
  ? "users.file_upload_disabled, users.file_upload_max_size_bytes"
  : "0 AS file_upload_disabled, NULL AS file_upload_max_size_bytes";

process.once("beforeExit", () => {
  saveDatabase();
});

process.once("exit", () => {
  saveDatabase();
});

export function getCurrentSchemaVersion() {
  return getSchemaVersion();
}

export function findUserByUsername(username) {
  return getRow(
    `SELECT id, username, nickname, avatar_url, color, status, password_hash, banned,
            ${DM_POLICY_SELECT_SQL}, ${CONTACT_REQUEST_POLICY_SELECT_SQL},
            ${UPLOAD_POLICY_SELECT_SQL}, ${USER_ROLE_SELECT_SQL}
     FROM users WHERE username = ?`,
    [username],
  );
}

export function findUserById(id) {
  return getRow(
    `SELECT id, username, nickname, avatar_url, color, status, password_hash, banned,
            ${UI_ACCENT_SELECT_SQL},
            ${DND_UNTIL_SELECT_SQL},
            ${NOTIFICATIONS_PAUSED_SELECT_SQL},
            ${USER_ROLE_SELECT_SQL}
     FROM users WHERE id = ?`,
    [id],
  );
}

export function listUsers(excludeUsername) {
  if (excludeUsername) {
    return getAll(
      `SELECT id, username, nickname, avatar_url, color, status, banned, ${USER_ROLE_SELECT_SQL} FROM users WHERE username != ? ORDER BY username`,
      [excludeUsername],
    );
  }

  return getAll(
    `SELECT id, username, nickname, avatar_url, color, status, banned, ${USER_ROLE_SELECT_SQL} FROM users ORDER BY username`,
  );
}

export function searchUsers(query, excludeUsername) {
  const like = `%${query}%`;

  if (excludeUsername) {
    return getAll(
      `SELECT id, username, nickname, avatar_url, color, status, banned, ${USER_ROLE_SELECT_SQL} FROM users WHERE username != ? AND (username LIKE ? OR nickname LIKE ?) ORDER BY username`,
      [excludeUsername, like, like],
    );
  }

  return getAll(
    `SELECT id, username, nickname, avatar_url, color, status, banned, ${USER_ROLE_SELECT_SQL} FROM users WHERE username LIKE ? OR nickname LIKE ? ORDER BY username`,
    [like, like],
  );
}

const HAS_DM_POLICY_COLUMN = hasColumn("users", "dm_policy");
const HAS_CONTACT_REQUEST_POLICY_COLUMN = hasColumn("users", "contact_request_policy");
const HAS_DND_UNTIL_COLUMN = hasColumn("users", "dnd_until");
const HAS_NOTIFICATIONS_PAUSED_COLUMN = hasColumn("users", "notifications_paused");
const HAS_UI_ACCENT_COLUMN = hasColumn("users", "ui_accent_color");
const HAS_ADMIN_2FA_COLUMN = hasColumn("sessions", "admin_2fa_verified_at");
const HAS_GROUP_E2EE_COLUMN = hasColumn("chats", "group_e2ee_enabled");
const UI_ACCENT_SELECT_SQL = HAS_UI_ACCENT_COLUMN
  ? "users.ui_accent_color"
  : "NULL AS ui_accent_color";
const ADMIN_2FA_SELECT_SQL = HAS_ADMIN_2FA_COLUMN
  ? "sessions.admin_2fa_verified_at"
  : "NULL AS admin_2fa_verified_at";
const DND_UNTIL_SELECT_SQL = HAS_DND_UNTIL_COLUMN
  ? "users.dnd_until"
  : "NULL AS dnd_until";
const NOTIFICATIONS_PAUSED_SELECT_SQL = HAS_NOTIFICATIONS_PAUSED_COLUMN
  ? "users.notifications_paused"
  : "0 AS notifications_paused";
const HAS_DM_STATUS_COLUMN = hasColumn("chats", "dm_status");
const DM_POLICY_SELECT_SQL = HAS_DM_POLICY_COLUMN ? "dm_policy" : "'acquaintances' AS dm_policy";
const CONTACT_REQUEST_POLICY_SELECT_SQL = HAS_CONTACT_REQUEST_POLICY_COLUMN
  ? "contact_request_policy"
  : "'everyone' AS contact_request_policy";
const DM_CHAT_SELECT_SQL = HAS_DM_STATUS_COLUMN
  ? "dm_status, dm_initiator_user_id, dm_resolved_at"
  : "'active' AS dm_status, NULL AS dm_initiator_user_id, NULL AS dm_resolved_at";

export function findUserByExactUsername(username) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) return null;
  return getRow(
    `SELECT id, username, nickname, avatar_url, color, status, banned, ${DM_POLICY_SELECT_SQL}, ${CONTACT_REQUEST_POLICY_SELECT_SQL}, ${USER_ROLE_SELECT_SQL}
     FROM users WHERE lower(username) = ?`,
    [normalized],
  );
}

export function usersShareNonDmChat(userIdA, userIdB) {
  const a = Number(userIdA);
  const b = Number(userIdB);
  if (!a || !b || a === b) return false;
  return Boolean(
    getRow(
      `
      SELECT 1 AS shared
      FROM chat_members m1
      JOIN chat_members m2 ON m2.chat_id = m1.chat_id
      JOIN chats c ON c.id = m1.chat_id
      WHERE m1.user_id = ?
        AND m2.user_id = ?
        AND c.type IN ('group', 'channel')
      LIMIT 1
    `,
      [a, b],
    ),
  );
}

export function updateUserDmPolicy(userId, policy) {
  if (!HAS_DM_POLICY_COLUMN) return;
  run("UPDATE users SET dm_policy = ? WHERE id = ?", [
    String(policy || "acquaintances"),
    Number(userId),
  ]);
}

export function updateUserContactRequestPolicy(userId, policy) {
  if (!HAS_CONTACT_REQUEST_POLICY_COLUMN) return;
  run("UPDATE users SET contact_request_policy = ? WHERE id = ?", [
    String(policy || "everyone"),
    Number(userId),
  ]);
}

export function blockUser(blockerUserId, blockedUserId) {
  run(
    "INSERT OR IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)",
    [Number(blockerUserId), Number(blockedUserId)],
  );
}

export function unblockUser(blockerUserId, blockedUserId) {
  run("DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?", [
    Number(blockerUserId),
    Number(blockedUserId),
  ]);
}

export function listBlockedUsers(blockerUserId) {
  const ownerId = Number(blockerUserId || 0);
  if (!ownerId) return [];
  return getAll(
    `SELECT u.id, u.username, u.nickname, u.avatar_url, u.color
     FROM user_blocks ub
     JOIN users u ON u.id = ub.blocked_user_id
     WHERE ub.blocker_user_id = ?
     ORDER BY COALESCE(NULLIF(u.nickname, ''), u.username) COLLATE NOCASE ASC`,
    [ownerId],
  );
}

export function isUserBlockedBy(blockerUserId, blockedUserId) {
  const blockerId = Number(blockerUserId || 0);
  const blockedId = Number(blockedUserId || 0);
  if (!blockerId || !blockedId) return false;
  return Boolean(
    getRow(
      `SELECT 1 AS blocked FROM user_blocks
       WHERE blocker_user_id = ? AND blocked_user_id = ? LIMIT 1`,
      [blockerId, blockedId],
    )?.blocked,
  );
}

export function isBlockedBetween(userIdA, userIdB) {
  const a = Number(userIdA);
  const b = Number(userIdB);
  if (!a || !b) return false;
  return Boolean(
    getRow(
      `
      SELECT 1 AS blocked
      FROM user_blocks
      WHERE (blocker_user_id = ? AND blocked_user_id = ?)
         OR (blocker_user_id = ? AND blocked_user_id = ?)
      LIMIT 1
    `,
      [a, b, b, a],
    ),
  );
}

export function setChatDmState(chatId, { status, initiatorUserId, resolvedAt = null }) {
  if (!HAS_DM_STATUS_COLUMN) return;
  run(
    `UPDATE chats
     SET dm_status = ?, dm_initiator_user_id = ?, dm_resolved_at = ?
     WHERE id = ? AND type = 'dm'`,
    [
      String(status || "active"),
      initiatorUserId ? Number(initiatorUserId) : null,
      resolvedAt,
      Number(chatId),
    ],
  );
}

export function getDmChatRow(chatId) {
  return getRow(
    `SELECT id, name, type, ${DM_CHAT_SELECT_SQL} FROM chats WHERE id = ?`,
    [Number(chatId)],
  );
}

export function countNonSystemMessagesInChat(chatId) {
  const row = getRow(
    `
    SELECT COUNT(*) AS total
    FROM chat_messages
    WHERE chat_id = ?
      AND body NOT LIKE '[[system:%]]'
      AND hidden_everyone_at IS NULL
  `,
    [Number(chatId)],
  );
  return Number(row?.total || 0);
}

export function countDmInitiationsToday(userId) {
  const row = getRow(
    `
    SELECT COUNT(*) AS total
    FROM chats
    WHERE type = 'dm'
      AND dm_initiator_user_id = ?
      AND created_at >= datetime('now', '-1 day')
  `,
    [Number(userId)],
  );
  return Number(row?.total || 0);
}

export function recordDmRejection(fromUserId, toUserId) {
  run(
    `INSERT INTO dm_rejections (from_user_id, to_user_id, rejected_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET rejected_at = datetime('now')`,
    [Number(fromUserId), Number(toUserId)],
  );
}

export function isDmRejectionCooldownActive(fromUserId, toUserId, cooldownDays) {
  const days = Math.max(1, Number(cooldownDays || 7));
  const row = getRow(
    `
    SELECT 1 AS active
    FROM dm_rejections
    WHERE from_user_id = ?
      AND to_user_id = ?
      AND rejected_at >= datetime('now', ?)
    LIMIT 1
  `,
    [Number(fromUserId), Number(toUserId), `-${days} days`],
  );
  return Boolean(row);
}

export function listDmRequestsForUser(userId) {
  if (!HAS_DM_STATUS_COLUMN) return [];
  return getAll(
    `
    SELECT
      c.id,
      c.dm_status,
      c.dm_initiator_user_id,
      c.created_at,
      initiator.id AS initiator_id,
      initiator.username AS initiator_username,
      initiator.nickname AS initiator_nickname,
      initiator.avatar_url AS initiator_avatar_url,
      initiator.color AS initiator_color,
      (
        SELECT COALESCE(cm.edited_body, cm.body)
        FROM chat_messages cm
        WHERE cm.chat_id = c.id
          AND cm.body NOT LIKE '[[system:%]]'
          AND cm.hidden_everyone_at IS NULL
        ORDER BY cm.id DESC
        LIMIT 1
      ) AS preview_body,
      (
        SELECT cm.created_at
        FROM chat_messages cm
        WHERE cm.chat_id = c.id
          AND cm.body NOT LIKE '[[system:%]]'
          AND cm.hidden_everyone_at IS NULL
        ORDER BY cm.id DESC
        LIMIT 1
      ) AS preview_at
    FROM chats c
    JOIN chat_members recipient ON recipient.chat_id = c.id AND recipient.user_id = ?
    JOIN users initiator ON initiator.id = c.dm_initiator_user_id
    WHERE c.type = 'dm'
      AND c.dm_status = 'pending'
      AND c.dm_initiator_user_id != ?
    ORDER BY c.created_at DESC
  `,
    [Number(userId), Number(userId)],
  ).map(decryptMessageRow);
}

export function createUser(
  username,
  passwordHash,
  nickname = null,
  avatarUrl = null,
  color = null,
) {
  const nextColor = color || setUserColor();

  run(
    'INSERT INTO users (username, nickname, avatar_url, color, password_hash, last_seen) VALUES (?, ?, ?, ?, ?, datetime("now"))',
    [username, nickname, avatarUrl, nextColor, passwordHash],
  );

  return getLastInsertId();
}

export function findDmChat(userId, otherUserId) {
  const row = getRow(
    `
    SELECT c.id
    FROM chats c
    JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = ?
    JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = ?
    WHERE c.type = 'dm'
    ORDER BY
      (SELECT COUNT(*) FROM chat_messages WHERE chat_id = c.id) DESC,
      (SELECT id FROM chat_messages WHERE chat_id = c.id ORDER BY julianday(created_at) DESC, id DESC LIMIT 1) DESC,
      c.id DESC
    LIMIT 1
  `,
    [userId, otherUserId],
  );
  return row?.id || null;
}

export function createChat(name, type = "dm", options = {}) {
  const normalizedType = String(type || "dm");
  const normalizedName =
    normalizedType === "dm"
      ? String(name || "").trim() || "dm"
      : String(name || "").trim() || null;
  const groupUsername =
    normalizedType === "group" || normalizedType === "channel"
      ? String(options.groupUsername || "")
          .trim()
          .toLowerCase() || null
      : null;
  const groupVisibility =
    normalizedType === "saved"
      ? "private"
      : (normalizedType === "group" || normalizedType === "channel") &&
          String(options.groupVisibility || "").toLowerCase() === "private"
        ? "private"
        : "public";
  const inviteToken =
    normalizedType === "group" || normalizedType === "channel"
      ? String(options.inviteToken || "").trim() || null
      : null;
  const createdByUserId = Number(options.createdByUserId || 0) || null;
  const groupColor =
    normalizedType === "group" || normalizedType === "channel"
      ? String(options.groupColor || "").trim() || setUserColor()
      : null;
  const allowMemberInvites =
    (normalizedType === "group" || normalizedType === "channel") &&
    options.allowMemberInvites === false
      ? 0
      : 1;
  const groupAvatarUrl =
    normalizedType === "group" || normalizedType === "channel"
      ? String(options.groupAvatarUrl || "").trim() || null
      : null;

  run(
    "INSERT INTO chats (name, type, group_username, group_visibility, invite_token, created_by_user_id, group_color, allow_member_invites, group_avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
    normalizedName,
    normalizedType,
      groupUsername,
      groupVisibility,
      inviteToken,
      createdByUserId,
      groupColor,
      allowMemberInvites,
      groupAvatarUrl,
    ],
  );

  const id = getLastInsertId();
  if (id) return id;

  const fallback = getRow("SELECT id FROM chats ORDER BY id DESC LIMIT 1");
  return fallback?.id || null;
}

export function addChatMember(chatId, userId, role = "member") {
  run(
    "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)",
    [chatId, userId, role],
  );
}

export function listRequiredChannels() {
  return getAll(
    `SELECT
       required_channels.chat_id,
       required_channels.enabled,
       required_channels.created_at,
       required_channels.updated_at,
       chats.id,
       chats.name,
       chats.group_username,
       chats.group_visibility,
       chats.group_color,
       chats.group_avatar_url,
       (SELECT COUNT(*) FROM chat_members WHERE chat_id = chats.id) AS member_count
     FROM required_channels
     JOIN chats ON chats.id = required_channels.chat_id
     WHERE chats.type = 'channel'
     ORDER BY chats.name COLLATE NOCASE ASC, chats.id ASC`,
  ).map((row) => ({
    ...row,
    enabled: Boolean(Number(row.enabled || 0)),
    member_count: Number(row.member_count || 0),
  }));
}

export function listRequiredChannelIds() {
  return getAll(
    `SELECT required_channels.chat_id
     FROM required_channels
     JOIN chats ON chats.id = required_channels.chat_id
     WHERE required_channels.enabled = 1
       AND chats.type = 'channel'`,
  )
    .map((row) => Number(row.chat_id || 0))
    .filter(Boolean);
}

export function isRequiredChannel(chatId) {
  const row = getRow(
    `SELECT 1 AS required
     FROM required_channels
     JOIN chats ON chats.id = required_channels.chat_id
     WHERE required_channels.chat_id = ?
       AND required_channels.enabled = 1
       AND chats.type = 'channel'`,
    [Number(chatId || 0)],
  );
  return Boolean(row?.required);
}

export function listAvailableRequiredChannels() {
  return getAll(
    `SELECT
       chats.id,
       chats.name,
       chats.group_username,
       chats.group_visibility,
       chats.group_color,
       chats.group_avatar_url,
       COALESCE(required_channels.enabled, 0) AS required,
       (SELECT COUNT(*) FROM chat_members WHERE chat_id = chats.id) AS member_count
     FROM chats
     LEFT JOIN required_channels ON required_channels.chat_id = chats.id
     WHERE chats.type = 'channel'
     ORDER BY chats.name COLLATE NOCASE ASC, chats.id ASC`,
  ).map((row) => ({
    ...row,
    required: Boolean(Number(row.required || 0)),
    member_count: Number(row.member_count || 0),
  }));
}

export function setRequiredChannels(chatIds = []) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(chatIds) ? chatIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  const validIds = normalizedIds.length
    ? getAll(
        `SELECT id FROM chats WHERE type = 'channel' AND id IN (${normalizedIds
          .map(() => "?")
          .join(", ")})`,
        normalizedIds,
      ).map((row) => Number(row.id))
    : [];

  const savepoint = `sp_required_channels_${Date.now()}`;
  runWithoutSave(`SAVEPOINT ${savepoint}`);
  try {
    runWithoutSave("DELETE FROM required_channels");
    validIds.forEach((chatId) => {
      runWithoutSave(
        `INSERT INTO required_channels (chat_id, enabled, created_at, updated_at)
         VALUES (?, 1, datetime('now'), datetime('now'))`,
        [chatId],
      );
    });
    runWithoutSave(`RELEASE ${savepoint}`);
    saveDatabase();
  } catch (error) {
    try {
      runWithoutSave(`ROLLBACK TO ${savepoint}`);
      runWithoutSave(`RELEASE ${savepoint}`);
    } catch {
      // ignore rollback failures
    }
    throw error;
  }

  return validIds;
}

export function applyRequiredChannelsToUser(userId) {
  const targetUserId = Number(userId || 0);
  if (!targetUserId) return 0;

  const channelIds = listRequiredChannelIds();
  let added = 0;
  channelIds.forEach((chatId) => {
    const before = getRow(
      "SELECT 1 AS member FROM chat_members WHERE chat_id = ? AND user_id = ?",
      [chatId, targetUserId],
    );
    run(
      "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'member')",
      [chatId, targetUserId],
    );
    run("DELETE FROM chat_left_members WHERE chat_id = ? AND user_id = ?", [
      chatId,
      targetUserId,
    ]);
    run("DELETE FROM hidden_chats WHERE chat_id = ? AND user_id = ?", [
      chatId,
      targetUserId,
    ]);
    run("DELETE FROM group_removed_members WHERE chat_id = ? AND user_id = ?", [
      chatId,
      targetUserId,
    ]);
    if (!before?.member) added += 1;
  });
  return added;
}

export function applyRequiredChannelsToAllUsers() {
  const users = getAll("SELECT id FROM users ORDER BY id ASC")
    .map((row) => Number(row.id || 0))
    .filter(Boolean);
  let membershipsAdded = 0;
  users.forEach((userId) => {
    membershipsAdded += applyRequiredChannelsToUser(userId);
  });
  return {
    usersProcessed: users.length,
    membershipsAdded,
    requiredChannels: listRequiredChannelIds().length,
  };
}

export function searchPublicGroups(query, viewerUserId, limit = 20) {
  const like = `%${String(query || "").trim()}%`;
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  return getAll(
    `SELECT c.id, c.name, c.group_username, c.group_color, c.group_avatar_url, c.invite_token,
            (SELECT COUNT(*) FROM chat_members m WHERE m.chat_id = c.id) AS members_count,
            EXISTS(
              SELECT 1 FROM chat_members vm
              WHERE vm.chat_id = c.id AND vm.user_id = ?
            ) AS is_member
     FROM chats c
     WHERE c.type = 'group'
       AND (
         c.group_visibility = 'public'
         OR EXISTS(
           SELECT 1 FROM chat_members vm
           WHERE vm.chat_id = c.id
             AND vm.user_id = ?
         )
       )
       AND (c.name LIKE ? OR c.group_username LIKE ?)
     ORDER BY
       CASE
         WHEN c.group_username LIKE ? THEN 0
         ELSE 1
       END,
       c.name ASC
     LIMIT ?`,
    [Number(viewerUserId), Number(viewerUserId), like, like, like, safeLimit],
  );
}

export function searchPublicChannels(query, viewerUserId, limit = 20) {
  const like = `%${String(query || "").trim()}%`;
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  return getAll(
    `SELECT c.id, c.name, c.group_username, c.group_color, c.group_avatar_url, c.invite_token,
            (SELECT COUNT(*) FROM chat_members m WHERE m.chat_id = c.id) AS members_count,
            EXISTS(
              SELECT 1 FROM chat_members vm
              WHERE vm.chat_id = c.id AND vm.user_id = ?
            ) AS is_member
     FROM chats c
     WHERE c.type = 'channel'
       AND (
         c.group_visibility = 'public'
         OR EXISTS(
           SELECT 1 FROM chat_members vm
           WHERE vm.chat_id = c.id
             AND vm.user_id = ?
         )
       )
       AND (c.name LIKE ? OR c.group_username LIKE ?)
     ORDER BY
       CASE
         WHEN c.group_username LIKE ? THEN 0
         ELSE 1
       END,
       c.name ASC
     LIMIT ?`,
    [Number(viewerUserId), Number(viewerUserId), like, like, like, safeLimit],
  );
}

const normalizeRemoteSourceUsername = (value) =>
  String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase() || null;

const normalizeRemoteSourceChatId = (value) => {
  const raw = String(value || "").trim();
  return raw || null;
};

export function getRemoteChannelSourceByChatId(chatId) {
  return getRow(
    `SELECT id, chat_id, provider, source_raw, source_chat_id, source_username,
            source_title, source_avatar_url, last_remote_message_id, enabled,
            source_version, sync_metadata, stream_media, last_error, last_seen_at,
            created_at, updated_at
     FROM remote_channel_sources
     WHERE chat_id = ? AND provider = 'telegram'`,
    [Number(chatId)],
  );
}

export function getRemoteChannelSourceById(sourceId) {
  return getRow(
    `SELECT id, chat_id, provider, source_raw, source_chat_id, source_username,
            source_title, source_avatar_url, last_remote_message_id, enabled,
            source_version, sync_metadata, stream_media, last_error, last_seen_at,
            created_at, updated_at
     FROM remote_channel_sources
     WHERE id = ? AND provider = 'telegram'`,
    [Number(sourceId)],
  );
}

export function upsertRemoteChannelSource(payload = {}) {
  const chatId = Number(payload.chatId || 0);
  if (!chatId) return null;

  const sourceRaw = String(payload.sourceRaw || "").trim() || null;
  const sourceChatId = normalizeRemoteSourceChatId(payload.sourceChatId);
  const sourceUsername = normalizeRemoteSourceUsername(payload.sourceUsername);
  const enabled = payload.enabled ? 1 : 0;
  const syncMetadata = payload.syncMetadata ? 1 : 0;
  const streamMedia = payload.streamMedia ? 1 : 0;
  const current = getRemoteChannelSourceByChatId(chatId);
  const sourceChanged = Boolean(
    current?.id &&
      (String(current.source_raw || "") !== String(sourceRaw || "") ||
        String(current.source_chat_id || "") !== String(sourceChatId || "") ||
        String(current.source_username || "") !== String(sourceUsername || "")),
  );
  const sourceVersion = sourceChanged
    ? Math.max(1, Number(current?.source_version || 1) || 1) + 1
    : Math.max(1, Number(current?.source_version || 1) || 1);

  run(
    `INSERT INTO remote_channel_sources (
       chat_id, provider, source_raw, source_chat_id, source_username,
       source_version, sync_metadata, stream_media, enabled, last_error, updated_at
     )
     VALUES (?, 'telegram', ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       provider = excluded.provider,
       source_title = CASE
         WHEN COALESCE(remote_channel_sources.source_raw, '') != COALESCE(excluded.source_raw, '')
           OR COALESCE(remote_channel_sources.source_chat_id, '') != COALESCE(excluded.source_chat_id, '')
           OR COALESCE(remote_channel_sources.source_username, '') != COALESCE(excluded.source_username, '')
         THEN NULL
         ELSE remote_channel_sources.source_title
       END,
       source_avatar_url = CASE
         WHEN COALESCE(remote_channel_sources.source_raw, '') != COALESCE(excluded.source_raw, '')
           OR COALESCE(remote_channel_sources.source_chat_id, '') != COALESCE(excluded.source_chat_id, '')
           OR COALESCE(remote_channel_sources.source_username, '') != COALESCE(excluded.source_username, '')
         THEN NULL
         ELSE remote_channel_sources.source_avatar_url
       END,
       last_remote_message_id = CASE
         WHEN COALESCE(remote_channel_sources.source_raw, '') != COALESCE(excluded.source_raw, '')
           OR COALESCE(remote_channel_sources.source_chat_id, '') != COALESCE(excluded.source_chat_id, '')
           OR COALESCE(remote_channel_sources.source_username, '') != COALESCE(excluded.source_username, '')
         THEN NULL
         ELSE remote_channel_sources.last_remote_message_id
       END,
       source_raw = excluded.source_raw,
       source_chat_id = excluded.source_chat_id,
       source_username = excluded.source_username,
       source_version = excluded.source_version,
       sync_metadata = excluded.sync_metadata,
       stream_media = excluded.stream_media,
       enabled = excluded.enabled,
       last_error = NULL,
       updated_at = datetime('now')`,
    [
      chatId,
      sourceRaw,
      sourceChatId,
      sourceUsername,
      sourceVersion,
      syncMetadata,
      streamMedia,
      enabled,
    ],
  );

  if (current?.id && (sourceChanged || !enabled)) {
    run(
      `UPDATE remote_channel_queue
       SET status = 'skipped',
           locked_at = NULL,
           lock_owner = NULL,
           last_error = ?,
           processed_at = datetime('now')
       WHERE source_id = ?
         AND status IN ('pending', 'retry', 'processing')`,
      [
        sourceChanged
          ? "Remote source changed before this item was mirrored."
          : "Remote Channel was disabled before this item was mirrored.",
        Number(current.id),
      ],
    );
  }
  saveDatabase();

  return getRemoteChannelSourceByChatId(chatId);
}

export function listEnabledRemoteChannelSources(provider = "telegram") {
  return getAll(
    `SELECT id, chat_id, provider, source_raw, source_chat_id, source_username,
            source_title, source_avatar_url, last_remote_message_id, enabled,
            source_version, sync_metadata, stream_media, last_error, last_seen_at,
            created_at, updated_at
     FROM remote_channel_sources
     WHERE provider = ? AND enabled = 1
     ORDER BY id ASC`,
    [String(provider || "telegram")],
  );
}

export function updateRemoteChannelSourceSeen(sourceId, payload = {}) {
  const sourceChatId = normalizeRemoteSourceChatId(payload.sourceChatId);
  const sourceUsername = normalizeRemoteSourceUsername(payload.sourceUsername);
  const sourceTitle = Object.prototype.hasOwnProperty.call(payload, "sourceTitle")
    ? String(payload.sourceTitle || "").trim() || null
    : undefined;
  const lastRemoteMessageId = Number.isFinite(Number(payload.lastRemoteMessageId))
    ? Math.max(0, Math.trunc(Number(payload.lastRemoteMessageId)))
    : null;
  run(
    `UPDATE remote_channel_sources
     SET source_chat_id = COALESCE(?, source_chat_id),
         source_username = COALESCE(?, source_username),
         source_title = CASE WHEN ? THEN ? ELSE source_title END,
         last_remote_message_id = CASE
           WHEN ? IS NOT NULL AND (
             last_remote_message_id IS NULL OR ? > last_remote_message_id
           ) THEN ?
           ELSE last_remote_message_id
         END,
         last_seen_at = datetime('now'),
         last_error = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      sourceChatId,
      sourceUsername,
      sourceTitle !== undefined ? 1 : 0,
      sourceTitle === undefined ? null : sourceTitle,
      lastRemoteMessageId,
      lastRemoteMessageId,
      lastRemoteMessageId,
      Number(sourceId),
    ],
  );
  saveDatabase();
}

export function updateRemoteChannelSourceError(sourceId, error) {
  run(
    `UPDATE remote_channel_sources
     SET last_error = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [String(error || "").slice(0, 1000) || null, Number(sourceId)],
  );
  saveDatabase();
}

export function enqueueRemoteChannelQueueItem(payload = {}) {
  const sourceId = Number(payload.sourceId || 0);
  const payloadJson = String(payload.payloadJson || "").trim();
  if (!sourceId || !payloadJson) return null;
  const telegramUpdateId = Number.isFinite(Number(payload.telegramUpdateId))
    ? Math.trunc(Number(payload.telegramUpdateId))
    : null;
  const telegramMessageId = Number.isFinite(Number(payload.telegramMessageId))
    ? Math.trunc(Number(payload.telegramMessageId))
    : null;
  const sourceVersion = Math.max(1, Math.trunc(Number(payload.sourceVersion || 1)) || 1);

  run(
    `INSERT OR IGNORE INTO remote_channel_queue (
       source_id, provider, telegram_update_id, telegram_message_id,
       source_version, payload_json, status, next_attempt_at
     )
     VALUES (?, 'telegram', ?, ?, ?, ?, 'pending', datetime('now'))`,
    [sourceId, telegramUpdateId, telegramMessageId, sourceVersion, payloadJson],
  );
  saveDatabase();
}

export function getRemoteChannelQueueSummary(sourceId) {
  const rows = getAll(
    `SELECT status, COUNT(*) AS count
     FROM remote_channel_queue
     WHERE source_id = ?
     GROUP BY status`,
    [Number(sourceId)],
  );
  return rows.reduce((acc, row) => {
    const status = String(row?.status || "").trim() || "unknown";
    acc[status] = Number(row?.count || 0);
    return acc;
  }, {});
}

export function releaseStaleRemoteChannelQueueItems(staleBeforeIso) {
  run(
    `UPDATE remote_channel_queue
     SET status = 'retry',
         locked_at = NULL,
         lock_owner = NULL,
         next_attempt_at = datetime('now')
     WHERE status = 'processing'
       AND locked_at IS NOT NULL
       AND julianday(locked_at) <= julianday(?)`,
    [String(staleBeforeIso || new Date().toISOString())],
  );
}

export function claimNextRemoteChannelQueueItem(lockOwner, nowIso) {
  const now = String(nowIso || new Date().toISOString());
  const row = getRow(
    `SELECT q.id, q.source_id, q.provider, q.telegram_update_id,
            q.telegram_message_id, q.source_version, q.payload_json, q.status,
            q.attempts, q.next_attempt_at, q.locked_at, q.lock_owner,
            q.last_error, q.created_message_id, q.created_at, q.processed_at,
            s.chat_id, s.source_raw, s.source_chat_id, s.source_username,
            s.source_title, s.source_avatar_url, s.last_remote_message_id,
            s.source_version AS current_source_version, s.sync_metadata,
            s.stream_media,
            c.name AS target_chat_name, c.created_by_user_id
     FROM remote_channel_queue q
     JOIN remote_channel_sources s ON s.id = q.source_id
     JOIN chats c ON c.id = s.chat_id
     WHERE q.provider = 'telegram'
       AND s.provider = 'telegram'
       AND s.enabled = 1
       AND q.source_version = s.source_version
       AND c.type = 'channel'
       AND q.status IN ('pending', 'retry')
       AND (
         q.next_attempt_at IS NULL
         OR q.next_attempt_at = ''
         OR julianday(q.next_attempt_at) <= julianday(?)
       )
     ORDER BY julianday(q.created_at) ASC, q.id ASC
     LIMIT 1`,
    [now],
  );
  if (!row?.id) return null;

  run(
    `UPDATE remote_channel_queue
     SET status = 'processing',
         locked_at = ?,
         lock_owner = ?
     WHERE id = ?
       AND status IN ('pending', 'retry')`,
    [now, String(lockOwner || "remote-channel-worker"), Number(row.id)],
  );

  return {
    ...row,
    status: "processing",
    locked_at: now,
    lock_owner: String(lockOwner || "remote-channel-worker"),
  };
}

export function markRemoteChannelQueueItemDone(id, messageId) {
  run(
    `UPDATE remote_channel_queue
     SET status = 'done',
         locked_at = NULL,
         lock_owner = NULL,
         last_error = NULL,
         created_message_id = ?,
         processed_at = datetime('now')
     WHERE id = ?`,
    [Number(messageId) || null, Number(id)],
  );
  saveDatabase();
}

export function markRemoteChannelQueueItemSkipped(id, reason) {
  run(
    `UPDATE remote_channel_queue
     SET status = 'skipped',
         locked_at = NULL,
         lock_owner = NULL,
         last_error = ?,
         processed_at = datetime('now')
     WHERE id = ?`,
    [String(reason || "Skipped").slice(0, 1000), Number(id)],
  );
  saveDatabase();
}

export function markRemoteChannelQueueItemRetry(id, payload = {}) {
  run(
    `UPDATE remote_channel_queue
     SET status = ?,
         attempts = attempts + 1,
         next_attempt_at = ?,
         locked_at = NULL,
         lock_owner = NULL,
         last_error = ?
     WHERE id = ?`,
    [
      payload.failed ? "failed" : "retry",
      payload.failed ? null : String(payload.nextAttemptAt || new Date().toISOString()),
      String(payload.error || "").slice(0, 1000) || null,
      Number(id),
    ],
  );
  saveDatabase();
}

export function removeChatMember(chatId, userId) {
  run("DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?", [
    Number(chatId),
    Number(userId),
  ]);
}

export function markChatMemberLeft(chatId, userId) {
  run(
    `INSERT INTO chat_left_members (chat_id, user_id, left_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(chat_id, user_id) DO UPDATE SET
       left_at = datetime('now')`,
    [Number(chatId), Number(userId)],
  );
}

export function clearChatMemberLeft(chatId, userId) {
  run("DELETE FROM chat_left_members WHERE chat_id = ? AND user_id = ?", [
    Number(chatId),
    Number(userId),
  ]);
}

export function hasChatMemberLeft(chatId, userId) {
  const row = getRow(
    "SELECT 1 AS left_chat FROM chat_left_members WHERE chat_id = ? AND user_id = ?",
    [Number(chatId), Number(userId)],
  );
  return Boolean(row);
}

export function markGroupMemberRemoved(chatId, userId, removedByUserId) {
  run(
    `INSERT INTO group_removed_members (chat_id, user_id, removed_by_user_id, removed_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id, user_id) DO UPDATE SET
       removed_by_user_id = excluded.removed_by_user_id,
       removed_at = datetime('now')`,
    [Number(chatId), Number(userId), Number(removedByUserId)],
  );
}

export function clearGroupMemberRemoved(chatId, userId) {
  run("DELETE FROM group_removed_members WHERE chat_id = ? AND user_id = ?", [
    Number(chatId),
    Number(userId),
  ]);
}

export function isGroupMemberRemoved(chatId, userId) {
  const row = getRow(
    "SELECT 1 AS removed FROM group_removed_members WHERE chat_id = ? AND user_id = ?",
    [Number(chatId), Number(userId)],
  );
  return Boolean(row);
}

export function findChatByGroupUsername(groupUsername) {
  const raw = String(groupUsername || "").trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw.startsWith("@") ? raw.slice(1) : raw;
  const withAt = normalized.startsWith("@") ? normalized : `@${normalized}`;
  return getRow(
    `SELECT id, name, type, group_username, group_visibility, invite_token, group_color,
            allow_member_invites, group_avatar_url, created_by_user_id
     FROM chats
     WHERE group_username IN (?, ?) AND type IN ('group', 'channel')`,
    [normalized, withAt],
  );
}

export function findChatByInviteToken(inviteToken) {
  return getRow(
    "SELECT id, name, type, group_username, group_visibility, invite_token, group_color, allow_member_invites, group_avatar_url, created_by_user_id FROM chats WHERE invite_token = ? AND type IN ('group', 'channel')",
    [String(inviteToken || "").trim()],
  );
}

export function findChatById(chatId) {
  return getRow(
    `SELECT id, name, type, group_username, group_visibility, invite_token, group_color,
            allow_member_invites, group_avatar_url, created_by_user_id, ${DM_CHAT_SELECT_SQL}
     FROM chats WHERE id = ?`,
    [Number(chatId)],
  );
}

export function updateGroupChat(chatId, payload = {}) {
  const name = String(payload?.name || "").trim() || null;
  const groupUsername =
    String(payload?.groupUsername || "")
      .trim()
      .toLowerCase() || null;
  const groupVisibility =
    String(payload?.groupVisibility || "").toLowerCase() === "private"
      ? "private"
      : "public";
  const allowMemberInvites = payload?.allowMemberInvites === false ? 0 : 1;
  const hasGroupAvatarUrl = Object.prototype.hasOwnProperty.call(
    payload || {},
    "groupAvatarUrl",
  );
  const groupAvatarUrl =
    !hasGroupAvatarUrl
      ? null
      : String(payload?.groupAvatarUrl || "").trim() || null;

  run(
    `UPDATE chats
     SET name = ?, group_username = ?, group_visibility = ?, allow_member_invites = ?,
         group_avatar_url = CASE WHEN ? THEN ? ELSE group_avatar_url END
     WHERE id = ? AND type = 'group'`,
    [
      name,
      groupUsername,
      groupVisibility,
      allowMemberInvites,
      hasGroupAvatarUrl ? 1 : 0,
      groupAvatarUrl,
      Number(chatId),
    ],
  );
}

export function updateChannelChat(chatId, payload = {}) {
  const name = String(payload?.name || "").trim() || null;
  const groupUsername =
    String(payload?.groupUsername || "")
      .trim()
      .toLowerCase() || null;
  const groupVisibility =
    String(payload?.groupVisibility || "").toLowerCase() === "private"
      ? "private"
      : "public";
  const allowMemberInvites = payload?.allowMemberInvites === false ? 0 : 1;
  const hasGroupAvatarUrl = Object.prototype.hasOwnProperty.call(
    payload || {},
    "groupAvatarUrl",
  );
  const groupAvatarUrl =
    !hasGroupAvatarUrl
      ? null
      : String(payload?.groupAvatarUrl || "").trim() || null;

  run(
    `UPDATE chats
     SET name = ?, group_username = ?, group_visibility = ?, allow_member_invites = ?,
         group_avatar_url = CASE WHEN ? THEN ? ELSE group_avatar_url END
     WHERE id = ? AND type = 'channel'`,
    [
      name,
      groupUsername,
      groupVisibility,
      allowMemberInvites,
      hasGroupAvatarUrl ? 1 : 0,
      groupAvatarUrl,
      Number(chatId),
    ],
  );
}

export function regenerateGroupInviteToken(chatId, inviteToken) {
  run(
    "UPDATE chats SET invite_token = ? WHERE id = ? AND type IN ('group', 'channel')",
    [String(inviteToken || "").trim(), Number(chatId)],
  );
}

export function isMember(chatId, userId) {
  const row = getRow(
    "SELECT chat_id FROM chat_members WHERE chat_id = ? AND user_id = ?",
    [chatId, userId],
  );
  return Boolean(row);
}

export function listChatMembers(chatId) {
  return getAll(
    `
    SELECT users.id, users.username, users.nickname, users.avatar_url, users.color, users.status, chat_members.role
    FROM chat_members
    JOIN users ON users.id = chat_members.user_id
    WHERE chat_members.chat_id = ?
    ORDER BY users.username
  `,
    [chatId],
  );
}

export function getChatMemberRole(chatId, userId) {
  const row = getRow(
    "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?",
    [Number(chatId), Number(userId)],
  );
  return String(row?.role || "");
}

export function setChatMemberRole(chatId, userId, role = "member") {
  run("UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?", [
    String(role || "member"),
    Number(chatId),
    Number(userId),
  ]);
}

const OPEN_CALL_STATUSES = ["ringing", "accepted", "connected", "reconnecting"];

function getLatestOpenCallLogByRoom(roomId) {
  const placeholders = OPEN_CALL_STATUSES.map(() => "?").join(", ");
  return getRow(
    `SELECT *
     FROM call_logs
     WHERE room_id = ? AND status IN (${placeholders})
     ORDER BY id DESC
     LIMIT 1`,
    [String(roomId || ""), ...OPEN_CALL_STATUSES],
  );
}

export function createCallLog({
  chatId,
  roomId,
  callerUserId = null,
  participantUserIds = [],
  callType = "voice",
}) {
  const targetChatId = Number(chatId || 0);
  const normalizedRoomId = String(roomId || "").trim();
  const callerId = Number(callerUserId || 0) || null;
  if (!targetChatId || !normalizedRoomId) return null;

  const existing = getLatestOpenCallLogByRoom(normalizedRoomId);
  if (existing?.id) return Number(existing.id);

  run(
    `INSERT INTO call_logs (chat_id, room_id, call_type, status, caller_user_id)
     VALUES (?, ?, ?, 'ringing', ?)`,
    [
      targetChatId,
      normalizedRoomId,
      String(callType || "voice").toLowerCase() === "video" ? "video" : "voice",
      callerId,
    ],
  );
  const callLogId = Number(getLastInsertId() || 0);
  if (!callLogId) return null;

  const uniqueParticipantIds = Array.from(
    new Set(
      [callerId, ...(Array.isArray(participantUserIds) ? participantUserIds : [])]
        .map((value) => Number(value || 0))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );

  uniqueParticipantIds.forEach((userId) => {
    const isCaller = callerId && Number(userId) === Number(callerId);
    run(
      `INSERT OR IGNORE INTO call_log_participants
        (call_log_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, ?, ${isCaller ? "CURRENT_TIMESTAMP" : "NULL"})`,
      [
        callLogId,
        userId,
        isCaller ? "caller" : "participant",
        isCaller ? "joined" : "invited",
      ],
    );
  });

  return callLogId;
}

export function markCallLogAccepted({ roomId, acceptedByUserId = null }) {
  const callLog = getLatestOpenCallLogByRoom(roomId);
  if (!callLog?.id) return null;

  run(
    `UPDATE call_logs
     SET status = 'accepted',
         accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)
     WHERE id = ?`,
    [Number(callLog.id)],
  );

  const userId = Number(acceptedByUserId || 0);
  if (userId) {
    run(
      `UPDATE call_log_participants
       SET status = 'joined',
           joined_at = COALESCE(joined_at, CURRENT_TIMESTAMP)
       WHERE call_log_id = ? AND user_id = ?`,
      [Number(callLog.id), userId],
    );
  }

  return Number(callLog.id);
}

export function finishCallLog({
  roomId,
  status = "ended",
  endedByUserId = null,
  reason = "",
}) {
  const callLog = getLatestOpenCallLogByRoom(roomId);
  if (!callLog?.id) return null;

  const normalizedStatus = [
    "ended",
    "rejected",
    "missed",
    "disconnect_timeout",
    "failed",
  ].includes(String(status || "").toLowerCase())
    ? String(status || "").toLowerCase()
    : "ended";

  run(
    `UPDATE call_logs
     SET status = ?,
         ended_at = CURRENT_TIMESTAMP,
         duration_seconds = MAX(
           0,
           CAST(
             (julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(accepted_at, started_at))) * 86400
             AS INTEGER
           )
         ),
         end_reason = ?
     WHERE id = ?`,
    [
      normalizedStatus,
      String(reason || normalizedStatus).slice(0, 120),
      Number(callLog.id),
    ],
  );

  const userId = Number(endedByUserId || 0);
  if (userId) {
    run(
      `UPDATE call_log_participants
       SET left_at = COALESCE(left_at, CURRENT_TIMESTAMP)
       WHERE call_log_id = ? AND user_id = ?`,
      [Number(callLog.id), userId],
    );
  }

  return Number(callLog.id);
}

export function listCallLogsForChat(chatId, limit = 30) {
  const targetChatId = Number(chatId || 0);
  if (!targetChatId) return [];
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 30)));
  const rows = getAll(
    `SELECT call_logs.id, call_logs.chat_id, call_logs.room_id, call_logs.call_type,
            call_logs.status, call_logs.caller_user_id, call_logs.started_at,
            call_logs.accepted_at, call_logs.ended_at, call_logs.duration_seconds,
            call_logs.end_reason,
            users.username AS caller_username,
            users.nickname AS caller_nickname,
            users.avatar_url AS caller_avatar_url,
            users.color AS caller_color
     FROM call_logs
     LEFT JOIN users ON users.id = call_logs.caller_user_id
     WHERE call_logs.chat_id = ?
     ORDER BY julianday(call_logs.started_at) DESC, call_logs.id DESC
     LIMIT ?`,
    [targetChatId, safeLimit],
  );

  return rows.map((row) => {
    const callLogId = Number(row.id);
    const participants = getAll(
      `SELECT call_log_participants.user_id, call_log_participants.role,
              call_log_participants.status, call_log_participants.joined_at,
              call_log_participants.left_at,
              users.username, users.nickname, users.avatar_url, users.color
       FROM call_log_participants
       LEFT JOIN users ON users.id = call_log_participants.user_id
       WHERE call_log_participants.call_log_id = ?
       ORDER BY call_log_participants.role = 'caller' DESC, users.username ASC`,
      [callLogId],
    );
    return { ...row, participants };
  });
}

export function listCallLogsForUser(userId, limit = 50) {
  const targetUserId = Number(userId || 0);
  if (!targetUserId) return [];
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 50)));
  const rows = getAll(
    `SELECT call_logs.id, call_logs.chat_id, call_logs.room_id, call_logs.call_type,
            call_logs.status, call_logs.caller_user_id, call_logs.started_at,
            call_logs.accepted_at, call_logs.ended_at, call_logs.duration_seconds,
            call_logs.end_reason,
            chats.type AS chat_type,
            chats.name AS chat_name,
            chats.group_color AS chat_color,
            chats.group_avatar_url AS chat_avatar_url,
            users.username AS caller_username,
            users.nickname AS caller_nickname,
            users.avatar_url AS caller_avatar_url,
            users.color AS caller_color,
            me.status AS my_participant_status
     FROM call_logs
     INNER JOIN call_log_participants me
       ON me.call_log_id = call_logs.id AND me.user_id = ?
     LEFT JOIN chats ON chats.id = call_logs.chat_id
     LEFT JOIN users ON users.id = call_logs.caller_user_id
     ORDER BY julianday(call_logs.started_at) DESC, call_logs.id DESC
     LIMIT ?`,
    [targetUserId, safeLimit],
  );

  return rows.map((row) => {
    const callLogId = Number(row.id);
    const participants = getAll(
      `SELECT call_log_participants.user_id, call_log_participants.role,
              call_log_participants.status, call_log_participants.joined_at,
              call_log_participants.left_at,
              users.username, users.nickname, users.avatar_url, users.color
       FROM call_log_participants
       LEFT JOIN users ON users.id = call_log_participants.user_id
       WHERE call_log_participants.call_log_id = ?
       ORDER BY call_log_participants.role = 'caller' DESC, users.username ASC`,
      [callLogId],
    );
    return { ...row, participants };
  });
}

export function deleteChatById(chatId) {
  const targetChatId = Number(chatId);
  if (!targetChatId) return { storedNames: [] };

  const fileRows = getAll(
    `
      SELECT cmf.stored_name
      FROM chat_message_files cmf
      JOIN chat_messages cm ON cm.id = cmf.message_id
      WHERE cm.chat_id = ?
    `,
    [targetChatId],
  );
  const storedNames = fileRows
    .map((row) => String(row?.stored_name || "").trim())
    .filter(Boolean);

  const savepoint = `sp_delete_chat_${targetChatId}_${Date.now()}`;
  runWithoutSave(`SAVEPOINT ${savepoint}`);
  try {
    runWithoutSave(
      `DELETE FROM chat_message_reads
       WHERE message_id IN (SELECT id FROM chat_messages WHERE chat_id = ?)`,
      [targetChatId],
    );
    runWithoutSave(
      `DELETE FROM hidden_chat_messages
       WHERE message_id IN (SELECT id FROM chat_messages WHERE chat_id = ?)`,
      [targetChatId],
    );
    runWithoutSave(
      `DELETE FROM chat_message_files
       WHERE message_id IN (SELECT id FROM chat_messages WHERE chat_id = ?)`,
      [targetChatId],
    );
    runWithoutSave("DELETE FROM chat_messages WHERE chat_id = ?", [targetChatId]);
    runWithoutSave("DELETE FROM chat_members WHERE chat_id = ?", [targetChatId]);
      runWithoutSave("DELETE FROM hidden_chats WHERE chat_id = ?", [targetChatId]);
      runWithoutSave("DELETE FROM chat_mutes WHERE chat_id = ?", [targetChatId]);
      runWithoutSave("DELETE FROM chat_left_members WHERE chat_id = ?", [targetChatId]);
      runWithoutSave("DELETE FROM group_removed_members WHERE chat_id = ?", [targetChatId]);
      runWithoutSave("DELETE FROM required_channels WHERE chat_id = ?", [
        targetChatId,
      ]);
      runWithoutSave(
        `DELETE FROM remote_channel_queue
         WHERE source_id IN (
         SELECT id FROM remote_channel_sources WHERE chat_id = ?
       )`,
      [targetChatId],
    );
    runWithoutSave("DELETE FROM remote_channel_sources WHERE chat_id = ?", [
      targetChatId,
    ]);
    runWithoutSave(
      `DELETE FROM call_log_participants
       WHERE call_log_id IN (SELECT id FROM call_logs WHERE chat_id = ?)`,
      [targetChatId],
    );
    runWithoutSave("DELETE FROM call_logs WHERE chat_id = ?", [targetChatId]);
    runWithoutSave("DELETE FROM chats WHERE id = ?", [targetChatId]);
    runWithoutSave(`RELEASE ${savepoint}`);
    saveDatabase();
  } catch (error) {
    try {
      runWithoutSave(`ROLLBACK TO ${savepoint}`);
      runWithoutSave(`RELEASE ${savepoint}`);
    } catch {
      // ignore rollback failures
    }
    throw error;
  }

  return { storedNames };
}

export function deleteUserById(userId) {
  const targetUserId = Number(userId);
  if (!targetUserId) {
    return { storedNames: [], deletedChatIds: [], transferredChatIds: [] };
  }

  const ownerChatRows = getAll(
    "SELECT chat_id FROM chat_members WHERE role = 'owner' AND user_id = ?",
    [targetUserId],
  );
  const ownerChatIds = Array.from(
    new Set(ownerChatRows.map((row) => Number(row?.chat_id || 0)).filter(Boolean)),
  );

  const chatIdsToDelete = [];
  const ownershipTransfers = [];

  ownerChatIds.forEach((chatId) => {
    const remaining = getAll(
      "SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id != ?",
      [Number(chatId), targetUserId],
    )
      .map((row) => Number(row?.user_id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!remaining.length) {
      chatIdsToDelete.push(Number(chatId));
      return;
    }

    const nextOwnerId = remaining[Math.floor(Math.random() * remaining.length)];
    if (nextOwnerId) {
      ownershipTransfers.push({
        chatId: Number(chatId),
        nextOwnerId: Number(nextOwnerId),
      });
    }
  });

  const uniqueChatDeletes = Array.from(
    new Set(chatIdsToDelete.filter((id) => Number.isFinite(id) && id > 0)),
  );

  const storedNames = new Set();

  if (uniqueChatDeletes.length) {
    const chatPlaceholders = uniqueChatDeletes.map(() => "?").join(", ");
    const chatFileRows = getAll(
      `SELECT cmf.stored_name
       FROM chat_message_files cmf
       JOIN chat_messages cm ON cm.id = cmf.message_id
       WHERE cm.chat_id IN (${chatPlaceholders})`,
      uniqueChatDeletes,
    );
    chatFileRows.forEach((row) => {
      const name = String(row?.stored_name || "").trim();
      if (name) storedNames.add(name);
    });
  }

  const savepoint = `sp_delete_user_${targetUserId}_${Date.now()}`;
  runWithoutSave(`SAVEPOINT ${savepoint}`);
  try {
    if (uniqueChatDeletes.length) {
      uniqueChatDeletes.forEach((chatId) => {
        runWithoutSave(
          `DELETE FROM chat_message_reads
           WHERE message_id IN (SELECT id FROM chat_messages WHERE chat_id = ?)`,
          [chatId],
        );
        runWithoutSave(
          `DELETE FROM chat_message_files
           WHERE message_id IN (SELECT id FROM chat_messages WHERE chat_id = ?)`,
          [chatId],
        );
        runWithoutSave("DELETE FROM chat_messages WHERE chat_id = ?", [chatId]);
        runWithoutSave("DELETE FROM chat_members WHERE chat_id = ?", [chatId]);
        runWithoutSave("DELETE FROM chat_mutes WHERE chat_id = ?", [chatId]);
        runWithoutSave("DELETE FROM chat_left_members WHERE chat_id = ?", [chatId]);
        runWithoutSave("DELETE FROM group_removed_members WHERE chat_id = ?", [chatId]);
        runWithoutSave("DELETE FROM hidden_chats WHERE chat_id = ?", [chatId]);
        runWithoutSave("DELETE FROM chats WHERE id = ?", [chatId]);
      });
    }

    ownershipTransfers.forEach((transfer) => {
      if (
        uniqueChatDeletes.includes(Number(transfer.chatId)) ||
        !transfer.chatId ||
        !transfer.nextOwnerId
      ) {
        return;
      }
      runWithoutSave("UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?", [
        "owner",
        Number(transfer.chatId),
        Number(transfer.nextOwnerId),
      ]);
    });

    runWithoutSave("DELETE FROM sessions WHERE user_id = ?", [targetUserId]);
    runWithoutSave("DELETE FROM hidden_chats WHERE user_id = ?", [targetUserId]);
    runWithoutSave("DELETE FROM hidden_chat_messages WHERE user_id = ?", [
      targetUserId,
    ]);
    runWithoutSave("DELETE FROM chat_message_reads WHERE user_id = ?", [targetUserId]);
    runWithoutSave("DELETE FROM push_subscriptions WHERE user_id = ?", [targetUserId]);
    runWithoutSave(
      "UPDATE chat_messages SET read_by_user_id = NULL WHERE read_by_user_id = ?",
      [targetUserId],
    );
    runWithoutSave("DELETE FROM chat_left_members WHERE user_id = ?", [targetUserId]);
    runWithoutSave("DELETE FROM chat_members WHERE user_id = ?", [targetUserId]);
    runWithoutSave("DELETE FROM users WHERE id = ?", [targetUserId]);
    runWithoutSave(`RELEASE ${savepoint}`);
    saveDatabase();
  } catch (error) {
    try {
      runWithoutSave(`ROLLBACK TO ${savepoint}`);
      runWithoutSave(`RELEASE ${savepoint}`);
    } catch {
      // ignore rollback failures
    }
    throw error;
  }

  return {
    storedNames: Array.from(storedNames),
    deletedChatIds: uniqueChatDeletes,
    transferredChatIds: ownershipTransfers.map((t) => Number(t.chatId || 0)),
  };
}

export function listChatsForUser(userId, options = {}) {
  const archivedOnly = Boolean(options?.archivedOnly);
  const archivedClause = archivedOnly
    ? "AND ucs.archived_at IS NOT NULL"
    : "AND (ucs.archived_at IS NULL OR ucs.user_id IS NULL)";

  return getAll(
    `
    WITH member_chats AS (
      SELECT
        c.id,
        c.name,
        c.type,
        c.group_username,
        c.group_visibility,
        c.invite_token,
        c.group_color,
        c.allow_member_invites,
        c.group_avatar_url,
        c.created_by_user_id,
        c.created_at,
        COALESCE(c.dm_status, 'active') AS dm_status,
        c.dm_initiator_user_id,
        ${HAS_GROUP_E2EE_COLUMN ? "COALESCE(c.group_e2ee_enabled, 0) AS group_e2ee_enabled," : "0 AS group_e2ee_enabled,"}
        ucs.pinned_at,
        ucs.archived_at,
        ucs.mute_until,
        COALESCE(ucs.notify_mode, 'all') AS notify_mode,
        CASE
          WHEN ucs.mute_until IS NOT NULL AND datetime(ucs.mute_until) > datetime('now') THEN 1
          WHEN COALESCE(mu.muted, 0) = 1 THEN 1
          ELSE 0
        END AS muted
      FROM chats c
      JOIN chat_members m ON m.chat_id = c.id
      LEFT JOIN user_chat_settings ucs ON ucs.chat_id = c.id AND ucs.user_id = m.user_id
      LEFT JOIN chat_mutes mu ON mu.chat_id = c.id AND mu.user_id = m.user_id
      LEFT JOIN hidden_chats h ON h.chat_id = c.id AND h.user_id = m.user_id
      WHERE m.user_id = ?
        AND h.chat_id IS NULL
        ${archivedClause}
        AND NOT (
          c.type = 'dm'
          AND COALESCE(c.dm_status, 'active') = 'pending'
          AND COALESCE(c.dm_initiator_user_id, 0) != m.user_id
        )
        AND NOT (
          c.type = 'dm'
          AND COALESCE(c.dm_status, 'active') = 'rejected'
        )
    ),
    visible_messages AS (
      SELECT
        cm.id,
        cm.chat_id,
        cm.user_id,
        COALESCE(cm.edited_body, cm.body) AS body,
        cm.created_at,
        cm.read_at,
        cm.read_by_user_id
      FROM member_chats mc
      JOIN chat_messages cm ON cm.chat_id = mc.id
      LEFT JOIN hidden_chat_messages hcm
        ON hcm.message_id = cm.id
       AND hcm.user_id = ?
      WHERE cm.body NOT LIKE '[[system:%]]'
        AND cm.hidden_everyone_at IS NULL
        AND hcm.message_id IS NULL
    ),
    last_visible_message_ids AS (
      SELECT chat_id, MAX(id) AS last_message_id
      FROM visible_messages
      GROUP BY chat_id
    ),
    last_outgoing_message_ids AS (
      SELECT chat_id, MAX(id) AS last_outgoing_message_id
      FROM visible_messages
      WHERE user_id = ?
      GROUP BY chat_id
    ),
    unread_counts AS (
      SELECT vm.chat_id, COUNT(*) AS unread_count
      FROM visible_messages vm
      LEFT JOIN chat_message_reads cmr
        ON cmr.message_id = vm.id
       AND cmr.user_id = ?
      WHERE vm.user_id != ?
        AND cmr.message_id IS NULL
      GROUP BY vm.chat_id
    )
    SELECT
      mc.id,
      mc.name,
      mc.type,
      mc.group_username,
      mc.group_visibility,
      mc.invite_token,
      mc.group_color,
      mc.allow_member_invites,
      mc.group_avatar_url,
      mc.created_by_user_id,
      mc.muted,
      mc.pinned_at,
      mc.archived_at,
      mc.mute_until,
      mc.notify_mode,
      mc.dm_status,
      mc.dm_initiator_user_id,
      mc.group_e2ee_enabled,
      lvm.last_message_id,
      last_vm.body AS last_message,
      last_vm.created_at AS last_time,
      last_vm.user_id AS last_sender_id,
      CASE
        WHEN last_vm.id IS NULL THEN NULL
        ELSE COALESCE(last_user.username, 'deleted')
      END AS last_sender_username,
      CASE
        WHEN last_vm.id IS NULL THEN NULL
        ELSE COALESCE(last_user.nickname, 'Deleted user')
      END AS last_sender_nickname,
      last_user.avatar_url AS last_sender_avatar_url,
      last_vm.read_at AS last_message_read_at,
      last_vm.read_by_user_id AS last_message_read_by_user_id,
      outgoing_vm.created_at AS last_outgoing_time,
      COALESCE(uc.unread_count, 0) AS unread_count
    FROM member_chats mc
    LEFT JOIN last_visible_message_ids lvm ON lvm.chat_id = mc.id
    LEFT JOIN visible_messages last_vm ON last_vm.id = lvm.last_message_id
    LEFT JOIN users last_user ON last_user.id = last_vm.user_id
    LEFT JOIN last_outgoing_message_ids lom ON lom.chat_id = mc.id
    LEFT JOIN visible_messages outgoing_vm ON outgoing_vm.id = lom.last_outgoing_message_id
    LEFT JOIN unread_counts uc ON uc.chat_id = mc.id
    ORDER BY
      CASE WHEN mc.id IN (SELECT chat_id FROM required_channels WHERE enabled = 1) THEN 0 ELSE 1 END,
      CASE WHEN mc.pinned_at IS NOT NULL THEN 0 ELSE 1 END,
      mc.pinned_at DESC,
      lvm.last_message_id DESC,
      mc.created_at DESC
  `,
    [
      Number(userId),
      Number(userId),
      Number(userId),
      Number(userId),
      Number(userId),
    ],
  ).map(decryptMessageRow);
}

export function listArchivedChatsForUser(userId) {
  return listChatsForUser(userId, { archivedOnly: true });
}

export function createMessage(
  chatId,
  userId,
  body,
  replyToMessageId = null,
  expiresAt = null,
  clientRequestId = null,
) {
  const storedBody = storageEncryption.encryptText(body);
  run(
    `INSERT INTO chat_messages (
      chat_id, user_id, body, reply_to_message_id, expires_at, client_request_id
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      chatId,
      userId,
      storedBody,
      replyToMessageId || null,
      expiresAt || null,
      clientRequestId || null,
    ],
  );

  // Use a reliable query instead of last_insert_rowid() which can be affected by concurrent inserts
  const row = getRow(
    `SELECT id FROM chat_messages
     WHERE chat_id = ? AND user_id = ? AND body = ?
     ORDER BY id DESC LIMIT 1`,
    [chatId, userId, storedBody],
  );
  if (row?.id) return row.id;

  const id = getLastInsertId();
  if (id) return id;

  const fallback = getRow(
    "SELECT id FROM chat_messages WHERE chat_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
    [chatId, userId],
  );
  return fallback?.id || null;
}

export function findMessageIdByClientRequestId(chatId, userId, clientRequestId) {
  const normalized = String(clientRequestId || "").trim();
  if (!normalized) return null;
  const row = getRow(
    `SELECT id
     FROM chat_messages
     WHERE chat_id = ? AND user_id = ? AND client_request_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [Number(chatId), Number(userId), normalized],
  );
  const id = Number(row?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function createOrReuseMessage(
  chatId,
  userId,
  body,
  replyToMessageId = null,
  expiresAt = null,
  clientRequestId = null,
) {
  const normalizedClientRequestId = String(clientRequestId || "").trim() || null;
  if (normalizedClientRequestId) {
    const existingId = findMessageIdByClientRequestId(
      chatId,
      userId,
      normalizedClientRequestId,
    );
    if (existingId) {
      return { id: existingId, deduped: true };
    }
  }

  try {
    const id = createMessage(
      chatId,
      userId,
      body,
      replyToMessageId,
      expiresAt,
      normalizedClientRequestId,
    );
    return { id, deduped: false };
  } catch (error) {
    if (!normalizedClientRequestId) {
      throw error;
    }
    const existingId = findMessageIdByClientRequestId(
      chatId,
      userId,
      normalizedClientRequestId,
    );
    if (existingId) {
      return { id: existingId, deduped: true };
    }
    throw error;
  }
}

export function markMessageRead(messageId, readerId) {
  run(
    `UPDATE chat_messages
     SET read_at = datetime('now'), read_by_user_id = ?
     WHERE id = ?`,
    [Number(readerId), Number(messageId)],
  );
  const row = getRow("SELECT user_id FROM chat_messages WHERE id = ?", [
    Number(messageId),
  ]);
  if (Number(row?.user_id || 0) === Number(readerId)) return;
  run(
    `INSERT OR IGNORE INTO chat_message_reads (message_id, user_id, read_at)
     VALUES (?, ?, datetime('now'))`,
    [Number(messageId), Number(readerId)],
  );
}

export function findSavedChatByUserId(userId) {
  return getRow(
    `SELECT id, name, type, group_username, group_visibility, invite_token, group_color,
            allow_member_invites, group_avatar_url, created_by_user_id
     FROM chats WHERE type = 'saved' AND created_by_user_id = ?`,
    [Number(userId)],
  );
}

export function ensureSavedChatForUser(userId) {
  const existing = findSavedChatByUserId(userId);
  if (existing?.id) {
    if (!isMember(existing.id, Number(userId))) {
      addChatMember(existing.id, Number(userId), "owner");
    }
    if (String(existing.group_visibility || "").toLowerCase() !== "private") {
      run("UPDATE chats SET group_visibility = 'private' WHERE id = ?", [
        Number(existing.id),
      ]);
    }
    return existing;
  }
  const chatId = createChat("Saved messages", "saved", {
    createdByUserId: Number(userId),
  });
  if (!chatId) return null;
  addChatMember(chatId, Number(userId), "owner");
  return findChatById(chatId);
}

export function findMessageById(messageId) {
  return decryptMessageRow(
    getRow(
      `SELECT id, chat_id, user_id, body, edited, edited_body, hidden_everyone_at,
              forwarded_from_chat_id, forwarded_from_label, forwarded_from_user_id,
              forwarded_from_username, forwarded_from_avatar_url, forwarded_from_color,
              created_at, expires_at
       FROM chat_messages
       WHERE id = ?`,
      [messageId],
    ),
  );
}

export function setMessageExpiresAt(messageId, expiresAt = null) {
  run("UPDATE chat_messages SET expires_at = ? WHERE id = ?", [
    expiresAt || null,
    Number(messageId),
  ]);
}

export function editMessage(messageId, editedBody) {
  run(
    `UPDATE chat_messages
     SET edited = 1,
         edited_body = ?
     WHERE id = ?`,
    [storageEncryption.encryptText(String(editedBody || "")), Number(messageId)],
  );
}

export function hideMessageForUser(messageId, userId) {
  run(
    `INSERT INTO hidden_chat_messages (message_id, user_id, hidden_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id, message_id) DO UPDATE SET hidden_at = datetime('now')`,
    [Number(messageId), Number(userId)],
  );
}

export function hideMessageForEveryone(messageId) {
  run(
    `UPDATE chat_messages
     SET hidden_everyone_at = datetime('now')
     WHERE id = ?`,
    [Number(messageId)],
  );
}

export function setMessageForwardOrigin(messageId, payload = {}) {
  run(
    `UPDATE chat_messages
     SET forwarded_from_chat_id = ?,
         forwarded_from_label = ?,
         forwarded_from_user_id = ?,
         forwarded_from_username = ?,
         forwarded_from_avatar_url = ?,
         forwarded_from_color = ?
     WHERE id = ?`,
    [
      Number(payload.sourceChatId) || null,
      String(payload.label || "").trim() || null,
      Number(payload.sourceUserId) || null,
      String(payload.sourceUsername || "").trim() || null,
      String(payload.sourceAvatarUrl || "").trim() || null,
      String(payload.sourceColor || "").trim() || null,
      Number(messageId),
    ],
  );
}

export function createMessageFiles(messageId, files = []) {
  if (!messageId) return;

  files.forEach((file) => {
    run(
      `INSERT INTO chat_message_files (
        message_id, kind, original_name, stored_name, mime_type, size_bytes, width_px, height_px, duration_seconds, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        file.kind,
        file.originalName,
        file.storedName,
        file.mimeType,
        Number(file.sizeBytes || 0),
        Number.isFinite(Number(file.widthPx)) ? Number(file.widthPx) : null,
        Number.isFinite(Number(file.heightPx)) ? Number(file.heightPx) : null,
        Number.isFinite(Number(file.durationSeconds))
          ? Number(file.durationSeconds)
          : null,
        file.expiresAt || null,
      ],
    );
  });
}

export function getMessages(chatId, options = {}) {
  const limitRaw = Number(options.limit || 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(10000, limitRaw))
    : 50;
  const beforeIdRaw = Number(options.beforeId || 0);
  const beforeCreatedAtRaw = String(options.beforeCreatedAt || "").trim();
  const viewerUserIdRaw = Number(options.viewerUserId || 0);
  const hasViewerUserId = Number.isFinite(viewerUserIdRaw) && viewerUserIdRaw > 0;
  const hasBeforeId = Number.isFinite(beforeIdRaw) && beforeIdRaw > 0;
  const hasBeforeCreatedAt = Boolean(beforeCreatedAtRaw);
  const hasBefore = hasBeforeId && hasBeforeCreatedAt;

  const visibilitySql = hasViewerUserId
    ? `
       AND ${getVisibleMessageFilterSql(
         "chat_messages",
         "WHERE hidden_chat_messages.user_id = ?",
       )}`
    : `
       AND chat_messages.hidden_everyone_at IS NULL`;

  const beforeSql = hasBefore
    ? `
       AND (
         julianday(chat_messages.created_at) < julianday(?)
         OR (
           julianday(chat_messages.created_at) = julianday(?)
           AND chat_messages.id < ?
         )
       )`
    : "";

  const whereSql = `WHERE chat_messages.chat_id = ?${visibilitySql}${beforeSql}`;

  const params = [chatId];
  if (hasViewerUserId) {
    params.push(viewerUserIdRaw);
  }
  if (hasBefore) {
    params.push(beforeCreatedAtRaw, beforeCreatedAtRaw, beforeIdRaw);
  }
  params.push(limit + 1);

  const rowsDesc = getAll(
    `
    SELECT chat_messages.id,
      COALESCE(chat_messages.edited_body, chat_messages.body) AS body,
      chat_messages.edited,
      chat_messages.edited_body,
      chat_messages.forwarded_from_chat_id,
      chat_messages.forwarded_from_label,
      chat_messages.forwarded_from_user_id,
      chat_messages.forwarded_from_username,
      chat_messages.forwarded_from_avatar_url,
      chat_messages.forwarded_from_color,
      chat_messages.created_at,
      chat_messages.expires_at,
      chat_messages.read_at,
      chat_messages.read_by_user_id,
      chat_messages.reply_to_message_id,
      users.id AS user_id,
      COALESCE(users.username, 'deleted') AS username,
      COALESCE(users.nickname, 'Deleted user') AS nickname,
      users.avatar_url, users.color,
      reply.id AS reply_id,
      COALESCE(reply.edited_body, reply.body) AS reply_body,
      reply.created_at AS reply_created_at,
      reply.user_id AS reply_user_id,
      COALESCE(reply_user.username, 'deleted') AS reply_username,
      COALESCE(reply_user.nickname, 'Deleted user') AS reply_nickname,
      reply_user.avatar_url AS reply_avatar_url
    FROM chat_messages
    LEFT JOIN users ON users.id = chat_messages.user_id
    LEFT JOIN chat_messages reply ON reply.id = chat_messages.reply_to_message_id
    LEFT JOIN users reply_user ON reply_user.id = reply.user_id
    ${whereSql}
    ORDER BY julianday(chat_messages.created_at) DESC, chat_messages.id DESC
    LIMIT ?
  `,
    params,
  );

  const hasMore = rowsDesc.length > limit;
  const rows = rowsDesc.slice(0, limit).reverse();

  const totalRow = getRow(
    hasViewerUserId
      ? `SELECT COUNT(*) AS total
         FROM chat_messages
         WHERE chat_id = ?
           AND ${getVisibleMessageFilterSql(
             "chat_messages",
             "WHERE hidden_chat_messages.user_id = ?",
           )}`
      : `SELECT COUNT(*) AS total
         FROM chat_messages
         WHERE chat_id = ?
           AND chat_messages.hidden_everyone_at IS NULL`,
    hasViewerUserId ? [chatId, viewerUserIdRaw] : [chatId],
  );

  const totalCount = Number(totalRow?.total || 0);

const messageIds = rows
  .map((row) => Number(row.id || 0))
  .filter((id) => Number.isFinite(id) && id > 0);

const reactions = getMessageReactions(messageIds);
const pollsByMessageId = getPollsForMessageIds(
  messageIds,
  hasViewerUserId ? viewerUserIdRaw : null,
);

const reactionsByMessageId = reactions.reduce((acc, row) => {
  const messageId = Number(row.message_id || 0);
  if (!messageId) return acc;

  if (!acc[messageId]) acc[messageId] = [];

  acc[messageId].push({
    reaction: row.reaction,
    count: Number(row.count || 0),
  });

  return acc;
}, {});

return {
  messages: rows.map((row) => {
    const message = decryptMessageRow(row);
    return {
      ...message,
      reactions: reactionsByMessageId[Number(message.id || 0)] || [],
      poll: pollsByMessageId[Number(message.id || 0)] || null,
    };
  }),
  hasMore,
  totalCount,
};
}

export function listMessageFilesByMessageIds(messageIds = []) {
  if (!Array.isArray(messageIds) || !messageIds.length) return [];

  const placeholders = messageIds.map(() => "?").join(", ");

  return getAll(
    `
      SELECT id, message_id, kind, original_name, stored_name, mime_type, size_bytes, width_px, height_px, duration_seconds, expires_at, created_at
      FROM chat_message_files
      WHERE message_id IN (${placeholders})
      ORDER BY id ASC
    `,
    messageIds,
  );
}

export function listMessageFilesNeedingMetadata(limit = 10000) {
  const safeLimit = Math.max(1, Math.min(200000, Number(limit) || 10000));

  return getAll(
    `
      SELECT id, stored_name, mime_type, width_px, height_px, duration_seconds, expires_at
      FROM chat_message_files
      WHERE (
        mime_type LIKE 'image/%'
        OR mime_type LIKE 'video/%'
      ) AND (
        width_px IS NULL
        OR height_px IS NULL
        OR (mime_type LIKE 'video/%' AND duration_seconds IS NULL)
      )
      ORDER BY id ASC
      LIMIT ?
    `,
    [safeLimit],
  );
}

export function updateMessageFileMetadata(fileId, metadata = {}) {
  run(
    `
      UPDATE chat_message_files
      SET
        width_px = COALESCE(?, width_px),
        height_px = COALESCE(?, height_px),
        duration_seconds = COALESCE(?, duration_seconds)
      WHERE id = ?
    `,
    [
      Number.isFinite(Number(metadata.widthPx))
        ? Number(metadata.widthPx)
        : null,
      Number.isFinite(Number(metadata.heightPx))
        ? Number(metadata.heightPx)
        : null,
      Number.isFinite(Number(metadata.durationSeconds))
        ? Number(metadata.durationSeconds)
        : null,
      Number(fileId),
    ],
  );
}

export function updateUserProfile(userId, username, nickname, avatarUrl) {
  run(
    "UPDATE users SET username = ?, nickname = ?, avatar_url = ? WHERE id = ?",
    [username, nickname, avatarUrl, userId],
  );
}

export function updateUserPassword(userId, passwordHash) {
  run("UPDATE users SET password_hash = ? WHERE id = ?", [
    passwordHash,
    userId,
  ]);
}

export function updateUserStatus(userId, status) {
  run("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
}

export function setUserBanned(userId, banned) {
  run("UPDATE users SET banned = ? WHERE id = ?", [banned ? 1 : 0, Number(userId)]);
}

export function deleteSessionsByUserId(userId) {
  run("DELETE FROM sessions WHERE user_id = ?", [Number(userId)]);
}

export function updateLastSeen(userId) {
  run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", [userId]);
}

export function getUserPresence(username) {
  return getRow(
    "SELECT id, username, status, last_seen FROM users WHERE username = ?",
    [username],
  );
}

export function markMessagesRead(chatId, readerId) {
  const recentRows = getAll(
    `SELECT id FROM chat_messages
     WHERE chat_id = ?
       AND user_id != ?
       AND id NOT IN (SELECT message_id FROM chat_message_reads WHERE user_id = ?)
     ORDER BY id DESC`,
    [Number(chatId), Number(readerId), Number(readerId)],
  );
  if (!recentRows.length) return;

  const messageIds = recentRows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!messageIds.length) return;

  run(
    `
    UPDATE chat_messages
    SET read_at = datetime('now'), read_by_user_id = ?
    WHERE chat_id = ? AND user_id != ? AND read_at IS NULL
  `,
    [readerId, chatId, readerId],
  );
  const chunkSize = 300;
  for (let i = 0; i < messageIds.length; i += chunkSize) {
    const chunk = messageIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, datetime('now'))").join(", ");
    run(
      `INSERT OR IGNORE INTO chat_message_reads (message_id, user_id, read_at)
       VALUES ${placeholders}`,
      chunk.flatMap((id) => [id, Number(readerId)]),
    );
  }
}

export function getMessageReadCounts(messageIds = []) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(messageIds) ? messageIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  if (!normalized.length) return [];
  const placeholders = normalized.map(() => "?").join(", ");
  return getAll(
    `SELECT message_id, COUNT(*) AS count
     FROM chat_message_reads
     WHERE message_id IN (${placeholders})
     GROUP BY message_id`,
    normalized,
  );
}

export function getMessageAuthors(messageIds = []) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(messageIds) ? messageIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  if (!normalized.length) return [];
  const placeholders = normalized.map(() => "?").join(", ");
  return getAll(
    `SELECT id, user_id FROM chat_messages WHERE id IN (${placeholders})`,
    normalized,
  );
}

export function getMessageReadByUser(messageIds = [], userId) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(messageIds) ? messageIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  if (!normalized.length) return [];
  const placeholders = normalized.map(() => "?").join(", ");
  return getAll(
    `SELECT message_id FROM chat_message_reads
     WHERE user_id = ? AND message_id IN (${placeholders})`,
    [Number(userId), ...normalized],
  );
}

export function recordMessageReads(messageIds = [], readerId) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(messageIds) ? messageIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  if (!normalized.length) return;
  const placeholders = normalized.map(() => "?").join(", ");
  const rows = getAll(
    `SELECT id, user_id FROM chat_messages WHERE id IN (${placeholders})`,
    normalized,
  );
  const toInsert = rows
    .filter((row) => Number(row?.user_id || 0) !== Number(readerId))
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!toInsert.length) return;
  const chunkSize = 300;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    const valuePlaceholders = chunk.map(() => "(?, ?, datetime('now'))").join(", ");
    run(
      `INSERT OR IGNORE INTO chat_message_reads (message_id, user_id, read_at)
       VALUES ${valuePlaceholders}`,
      chunk.flatMap((id) => [id, Number(readerId)]),
    );
  }
}

export function hideChatsForUser(userId, chatIds = []) {
  chatIds.forEach((chatId) => {
    run("INSERT OR IGNORE INTO hidden_chats (user_id, chat_id) VALUES (?, ?)", [
      userId,
      chatId,
    ]);
  });
}

export function unhideChat(userId, chatId) {
  run("DELETE FROM hidden_chats WHERE user_id = ? AND chat_id = ?", [
    userId,
    chatId,
  ]);
}

function ensureUserChatSettingsRow(userId, chatId) {
  run(
    `INSERT OR IGNORE INTO user_chat_settings (user_id, chat_id, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [Number(userId), Number(chatId)],
  );
}

export function setChatPinned(userId, chatId, pinned) {
  ensureUserChatSettingsRow(userId, chatId);
  if (pinned) {
    run(
      `UPDATE user_chat_settings
       SET pinned_at = datetime('now'), updated_at = datetime('now')
       WHERE user_id = ? AND chat_id = ?`,
      [Number(userId), Number(chatId)],
    );
    return;
  }
  run(
    `UPDATE user_chat_settings
     SET pinned_at = NULL, updated_at = datetime('now')
     WHERE user_id = ? AND chat_id = ?`,
    [Number(userId), Number(chatId)],
  );
}

export function setChatArchived(userId, chatId, archived) {
  ensureUserChatSettingsRow(userId, chatId);
  if (archived) {
    run(
      `UPDATE user_chat_settings
       SET archived_at = datetime('now'), pinned_at = NULL, updated_at = datetime('now')
       WHERE user_id = ? AND chat_id = ?`,
      [Number(userId), Number(chatId)],
    );
    return;
  }
  run(
    `UPDATE user_chat_settings
     SET archived_at = NULL, updated_at = datetime('now')
     WHERE user_id = ? AND chat_id = ?`,
    [Number(userId), Number(chatId)],
  );
}

export function setChatMuteUntil(userId, chatId, muteUntil) {
  ensureUserChatSettingsRow(userId, chatId);
  const normalizedUntil = muteUntil ? String(muteUntil).trim() : null;
  if (normalizedUntil) {
    run(
      `UPDATE user_chat_settings
       SET mute_until = ?, updated_at = datetime('now')
       WHERE user_id = ? AND chat_id = ?`,
      [normalizedUntil, Number(userId), Number(chatId)],
    );
    setChatMuted(userId, chatId, true);
    return;
  }
  run(
    `UPDATE user_chat_settings
     SET mute_until = NULL, updated_at = datetime('now')
     WHERE user_id = ? AND chat_id = ?`,
    [Number(userId), Number(chatId)],
  );
  setChatMuted(userId, chatId, false);
}

export function setChatNotifyMode(userId, chatId, notifyMode) {
  const mode = String(notifyMode || "all").toLowerCase();
  const safeMode = ["all", "silent", "mentions"].includes(mode) ? mode : "all";
  ensureUserChatSettingsRow(userId, chatId);
  run(
    `UPDATE user_chat_settings
     SET notify_mode = ?, updated_at = datetime('now')
     WHERE user_id = ? AND chat_id = ?`,
    [safeMode, Number(userId), Number(chatId)],
  );
}

export function setChatMuted(userId, chatId, muted) {
  if (muted) {
    run(
      `INSERT INTO chat_mutes (user_id, chat_id, muted, updated_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, chat_id) DO UPDATE SET
         muted = 1,
         updated_at = datetime('now')`,
      [Number(userId), Number(chatId)],
    );
    ensureUserChatSettingsRow(userId, chatId);
    return;
  }

  run("DELETE FROM chat_mutes WHERE user_id = ? AND chat_id = ?", [
    Number(userId),
    Number(chatId),
  ]);
  run(
    `UPDATE user_chat_settings
     SET mute_until = NULL, updated_at = datetime('now')
     WHERE user_id = ? AND chat_id = ?`,
    [Number(userId), Number(chatId)],
  );
}

export function listSessionsForUser(userId) {
  return getAll(
    `SELECT id, token, ip_address, user_agent, created_at, last_seen
     FROM sessions
     WHERE user_id = ?
     ORDER BY datetime(last_seen) DESC, id DESC`,
    [Number(userId)],
  );
}

export function deleteSessionByIdForUser(sessionId, userId) {
  run("DELETE FROM sessions WHERE id = ? AND user_id = ?", [
    Number(sessionId),
    Number(userId),
  ]);
}

export function deleteOtherSessionsForUser(userId, keepToken) {
  const token = String(keepToken || "").trim();
  if (!token) {
    run("DELETE FROM sessions WHERE user_id = ?", [Number(userId)]);
    return;
  }
  run("DELETE FROM sessions WHERE user_id = ? AND token != ?", [
    Number(userId),
    token,
  ]);
}

export function updateUserNotificationPrefs(userId, prefs = {}) {
  const uid = Number(userId || 0);
  if (!uid) return;
  if (Object.prototype.hasOwnProperty.call(prefs, "dndUntil")) {
    const value = prefs.dndUntil ? String(prefs.dndUntil).trim() : null;
    run("UPDATE users SET dnd_until = ? WHERE id = ?", [value, uid]);
  }
  if (Object.prototype.hasOwnProperty.call(prefs, "notificationsPaused")) {
    run("UPDATE users SET notifications_paused = ? WHERE id = ?", [
      prefs.notificationsPaused ? 1 : 0,
      uid,
    ]);
  }
}

export function createScheduledMessage({ chatId, userId, body, scheduledAt }) {
  const storedBody = storageEncryption.encryptText(String(body || ""));
  run(
    `INSERT INTO scheduled_messages (chat_id, user_id, body, scheduled_at, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
    [Number(chatId), Number(userId), storedBody, String(scheduledAt)],
  );
  return getLastInsertId();
}

export function listScheduledMessagesForUser(userId) {
  return getAll(
    `SELECT sm.id, sm.chat_id, sm.body, sm.scheduled_at, sm.status, sm.created_at, sm.sent_at,
            c.name AS chat_name, c.type AS chat_type
     FROM scheduled_messages sm
     JOIN chats c ON c.id = sm.chat_id
     WHERE sm.user_id = ?
       AND sm.status = 'pending'
     ORDER BY datetime(sm.scheduled_at) ASC`,
    [Number(userId)],
  ).map((row) => ({
    ...row,
    body: storageEncryption.decryptText(row?.body || ""),
  }));
}

export function deleteScheduledMessageForUser(messageId, userId) {
  run(
    `DELETE FROM scheduled_messages
     WHERE id = ? AND user_id = ? AND status = 'pending'`,
    [Number(messageId), Number(userId)],
  );
}

export function upsertPushSubscription(userId, endpoint, p256dh, auth) {
  const uid = Number(userId || 0);
  const safeEndpoint = String(endpoint || "").trim();
  if (!uid || !safeEndpoint) return;
  run(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       updated_at = datetime('now')`,
    [uid, safeEndpoint, String(p256dh || ""), String(auth || "")],
  );
}

export function deletePushSubscription(endpoint) {
  const safeEndpoint = String(endpoint || "").trim();
  if (!safeEndpoint) return;
  run("DELETE FROM push_subscriptions WHERE endpoint = ?", [safeEndpoint]);
}

export function listPushSubscriptionsByUserIds(userIds = []) {
  const ids = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return getAll(
    `SELECT user_id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE user_id IN (${placeholders})`,
    ids,
  );
}

export function listMutedUserIdsForChat(chatId) {
  const id = Number(chatId || 0);
  if (!id) return [];
  return getAll(
    "SELECT user_id FROM chat_mutes WHERE chat_id = ? AND muted = 1",
    [id],
  )
    .map((row) => Number(row?.user_id || 0))
    .filter((userId) => Number.isFinite(userId) && userId > 0);
}

export function createSession(userId, token, metadata = {}) {
  if (SESSIONS_HAS_IP_ADDRESS && SESSIONS_HAS_USER_AGENT) {
    run(
      "INSERT INTO sessions (user_id, token, ip_address, user_agent) VALUES (?, ?, ?, ?)",
      [
        userId,
        token,
        String(metadata.ipAddress || "").slice(0, 120) || null,
        String(metadata.userAgent || "").slice(0, 500) || null,
      ],
    );
    return;
  }

  run("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [userId, token]);
}

export function getSession(token) {
  return getRow(
    `
    SELECT sessions.id AS session_id, sessions.token, users.id, users.username, users.nickname,
           users.avatar_url, users.color, users.status, users.banned,
           ${HAS_DM_POLICY_COLUMN ? "users.dm_policy" : "'acquaintances' AS dm_policy"},
           ${HAS_CONTACT_REQUEST_POLICY_COLUMN ? "users.contact_request_policy" : "'everyone' AS contact_request_policy"},
           ${DND_UNTIL_SELECT_SQL},
           ${NOTIFICATIONS_PAUSED_SELECT_SQL},
           ${UI_ACCENT_SELECT_SQL},
           ${ADMIN_2FA_SELECT_SQL},
           ${UPLOAD_POLICY_QUALIFIED_SELECT_SQL},
           ${USER_ROLE_QUALIFIED_SELECT_SQL}
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
      AND COALESCE(users.banned, 0) = 0
  `,
    [token],
  );
}

export function toggleMessageReaction(messageId, userId, reaction) {
  const exists = getRow(
    "SELECT id FROM message_reactions WHERE message_id=? AND user_id=? AND reaction=?",
    [messageId, userId, reaction]
  );

  if (exists) {
    run(
      "DELETE FROM message_reactions WHERE message_id=? AND user_id=? AND reaction=?",
      [messageId, userId, reaction]
    );
    return { removed: true };
  }

  run(
    "INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)",
    [messageId, userId, reaction]
  );

  return { added: true };
}

export function getMessageReactions(messageIds = []) {
  if (!messageIds.length) return [];

  const placeholders = messageIds.map(() => "?").join(",");

  return getAll(
    `
    SELECT message_id, reaction, COUNT(*) as count
    FROM message_reactions
    WHERE message_id IN (${placeholders})
    GROUP BY message_id, reaction
    `,
    messageIds,
  );
}

export function createPollMessage(
  chatId,
  userId,
  { question, options, multiple = false, replyToMessageId = null, expiresAt = null, clientRequestId = null },
) {
  const normalizedQuestion = String(question || "").trim();
  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((opt) => String(opt || "").trim())
    .filter(Boolean)
    .slice(0, 10);
  if (!normalizedQuestion || normalizedOptions.length < 2) {
    return null;
  }

  const created = createOrReuseMessage(
    chatId,
    userId,
    "[[poll]]",
    replyToMessageId,
    expiresAt,
    clientRequestId,
  );
  const messageId = Number(created?.id || 0);
  if (!messageId) return null;

  if (!created?.deduped) {
    run(
      `INSERT INTO message_polls (message_id, question, options_json, multiple)
       VALUES (?, ?, ?, ?)`,
      [
        messageId,
        normalizedQuestion,
        JSON.stringify(normalizedOptions),
        multiple ? 1 : 0,
      ],
    );
  }

  return {
    id: messageId,
    deduped: Boolean(created?.deduped),
    poll: buildPollPayload(messageId, userId),
  };
}

function buildPollPayload(messageId, viewerUserId = null) {
  const row = getRow(
    `SELECT message_id, question, options_json, multiple FROM message_polls WHERE message_id = ?`,
    [Number(messageId)],
  );
  if (!row?.message_id) return null;

  let options = [];
  try {
    options = JSON.parse(String(row.options_json || "[]"));
  } catch {
    options = [];
  }
  if (!Array.isArray(options)) options = [];

  const voteRows = getAll(
    `SELECT option_index, COUNT(*) AS count
     FROM message_poll_votes
     WHERE message_id = ?
     GROUP BY option_index`,
    [Number(messageId)],
  );
  const counts = options.map((_, index) => {
    const match = voteRows.find((v) => Number(v.option_index) === index);
    return Number(match?.count || 0);
  });
  const totalVotes = voteRows.reduce((sum, v) => sum + Number(v.count || 0), 0);

  let myVotes = [];
  const viewerId = Number(viewerUserId || 0);
  if (viewerId) {
    myVotes = getAll(
      `SELECT option_index FROM message_poll_votes WHERE message_id = ? AND user_id = ?`,
      [Number(messageId), viewerId],
    ).map((v) => Number(v.option_index));
  }

  return {
    question: row.question,
    options,
    multiple: Boolean(Number(row.multiple || 0)),
    counts,
    totalVotes,
    myVotes,
  };
}

export function votePollMessage(messageId, userId, optionIndexes = []) {
  const msgId = Number(messageId || 0);
  const voterId = Number(userId || 0);
  if (!msgId || !voterId) return null;

  const poll = getRow(
    `SELECT message_id, multiple FROM message_polls WHERE message_id = ?`,
    [msgId],
  );
  if (!poll?.message_id) return null;

  const indexes = [...new Set(
    (Array.isArray(optionIndexes) ? optionIndexes : [optionIndexes])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v >= 0),
  )];

  if (!indexes.length) return null;

  const isMultiple = Boolean(Number(poll.multiple || 0));

  if (isMultiple) {
    for (const optionIndex of indexes) {
      const exists = getRow(
        `SELECT 1 AS ok FROM message_poll_votes
         WHERE message_id = ? AND user_id = ? AND option_index = ?`,
        [msgId, voterId, optionIndex],
      );
      if (exists?.ok) {
        run(
          `DELETE FROM message_poll_votes
           WHERE message_id = ? AND user_id = ? AND option_index = ?`,
          [msgId, voterId, optionIndex],
        );
      } else {
        run(
          `INSERT INTO message_poll_votes (message_id, user_id, option_index) VALUES (?, ?, ?)`,
          [msgId, voterId, optionIndex],
        );
      }
    }
  } else {
    run(`DELETE FROM message_poll_votes WHERE message_id = ? AND user_id = ?`, [
      msgId,
      voterId,
    ]);
    run(
      `INSERT INTO message_poll_votes (message_id, user_id, option_index) VALUES (?, ?, ?)`,
      [msgId, voterId, indexes[0]],
    );
  }

  return buildPollPayload(msgId, voterId);
}

export function getPollsForMessageIds(messageIds = [], viewerUserId = null) {
  const ids = (Array.isArray(messageIds) ? messageIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return {};

  const result = {};
  ids.forEach((messageId) => {
    const poll = buildPollPayload(messageId, viewerUserId);
    if (poll) result[messageId] = poll;
  });
  return result;
}

export function touchSession(token) {
  run("UPDATE sessions SET last_seen = datetime('now') WHERE token = ?", [
    token,
  ]);
}

export function deleteSession(token) {
  run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function setSessionAdmin2faVerified(token) {
  if (!HAS_ADMIN_2FA_COLUMN || !token) return;
  run("UPDATE sessions SET admin_2fa_verified_at = datetime('now') WHERE token = ?", [
    String(token),
  ]);
}

export function isSessionAdmin2faFresh(sessionRow, maxAgeHours = 12) {
  if (!HAS_ADMIN_2FA_COLUMN) return true;
  const verifiedAt = String(sessionRow?.admin_2fa_verified_at || "").trim();
  if (!verifiedAt) return false;
  const row = getRow(
    `SELECT CASE
       WHEN datetime(?) > datetime('now', ?) THEN 1
       ELSE 0
     END AS fresh`,
    [verifiedAt, `-${Number(maxAgeHours) || 12} hours`],
  );
  return Boolean(Number(row?.fresh || 0));
}

export function updateUserUiAccent(userId, accentColor) {
  if (!HAS_UI_ACCENT_COLUMN) return;
  const value = accentColor ? String(accentColor).trim().slice(0, 20) : null;
  run("UPDATE users SET ui_accent_color = ? WHERE id = ?", [value, Number(userId)]);
}

export function getAppBranding() {
  const row = getRow("SELECT value FROM app_settings WHERE key = 'branding'");
  if (!row?.value) {
    return {
      appName: "BirdX",
      accentColor: "#10b981",
      logoUrl: "",
      faviconUrl: "",
    };
  }
  try {
    const parsed = JSON.parse(row.value);
    return {
      appName: String(parsed?.appName || "BirdX").slice(0, 80),
      accentColor: String(parsed?.accentColor || "#10b981").slice(0, 20),
      logoUrl: String(parsed?.logoUrl || "").slice(0, 500),
      faviconUrl: String(parsed?.faviconUrl || "").slice(0, 500),
    };
  } catch {
    return {
      appName: "BirdX",
      accentColor: "#10b981",
      logoUrl: "",
      faviconUrl: "",
    };
  }
}

export function isGroupE2eeEnabled(chatId) {
  if (!HAS_GROUP_E2EE_COLUMN) return false;
  const row = getRow("SELECT group_e2ee_enabled FROM chats WHERE id = ?", [
    Number(chatId),
  ]);
  return Boolean(Number(row?.group_e2ee_enabled || 0));
}

export function setGroupE2eeEnabled(chatId, enabled) {
  if (!HAS_GROUP_E2EE_COLUMN) return;
  run("UPDATE chats SET group_e2ee_enabled = ? WHERE id = ?", [
    enabled ? 1 : 0,
    Number(chatId),
  ]);
}

export function upsertGroupE2eeWrappedKey({ chatId, userId, wrappedKey, keyGeneration = 1 }) {
  run(
    `INSERT INTO group_e2ee_keys (chat_id, user_id, wrapped_key, key_generation, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id, user_id) DO UPDATE SET
       wrapped_key = excluded.wrapped_key,
       key_generation = excluded.key_generation,
       updated_at = datetime('now')`,
    [
      Number(chatId),
      Number(userId),
      String(wrappedKey || ""),
      Number(keyGeneration) || 1,
    ],
  );
}

export function listGroupE2eeWrappedKeys(chatId) {
  return getAll(
    `SELECT user_id, wrapped_key, key_generation, updated_at
     FROM group_e2ee_keys
     WHERE chat_id = ?
     ORDER BY user_id ASC`,
    [Number(chatId)],
  );
}

export function getGroupE2eeWrappedKey(chatId, userId) {
  return getRow(
    `SELECT wrapped_key, key_generation
     FROM group_e2ee_keys
     WHERE chat_id = ? AND user_id = ?`,
    [Number(chatId), Number(userId)],
  );
}

export function areUsersContacts(userId, contactUserId) {
  const ownerId = Number(userId || 0);
  const peerId = Number(contactUserId || 0);
  if (!ownerId || !peerId || ownerId === peerId) return false;
  const row = getRow(
    `SELECT 1 AS ok FROM user_contacts WHERE user_id = ? AND contact_user_id = ?`,
    [ownerId, peerId],
  );
  return Boolean(row?.ok);
}

export function addMutualUserContacts(userIdA, userIdB) {
  const a = Number(userIdA || 0);
  const b = Number(userIdB || 0);
  if (!a || !b || a === b) return;
  run(
    `INSERT OR IGNORE INTO user_contacts (user_id, contact_user_id) VALUES (?, ?)`,
    [a, b],
  );
  run(
    `INSERT OR IGNORE INTO user_contacts (user_id, contact_user_id) VALUES (?, ?)`,
    [b, a],
  );
}

export function removeUserContact(userId, contactUserId) {
  const ownerId = Number(userId || 0);
  const peerId = Number(contactUserId || 0);
  if (!ownerId || !peerId) return;
  run(
    `DELETE FROM user_contacts WHERE user_id = ? AND contact_user_id = ?`,
    [ownerId, peerId],
  );
}

export function getPendingContactRequest(fromUserId, toUserId) {
  return getRow(
    `SELECT id, from_user_id, to_user_id, status, created_at, resolved_at
     FROM contact_requests
     WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
    [Number(fromUserId), Number(toUserId)],
  );
}

export function getContactRequestById(requestId) {
  return getRow(
    `SELECT id, from_user_id, to_user_id, status, created_at, resolved_at
     FROM contact_requests WHERE id = ?`,
    [Number(requestId)],
  );
}

export function createContactRequest(fromUserId, toUserId) {
  const fromId = Number(fromUserId || 0);
  const toId = Number(toUserId || 0);
  if (!fromId || !toId || fromId === toId) return null;

  const existingOutgoing = getPendingContactRequest(fromId, toId);
  if (existingOutgoing?.id) return { request: existingOutgoing, created: false };

  const reversePending = getPendingContactRequest(toId, fromId);
  if (reversePending?.id) {
    const accepted = acceptContactRequest(Number(reversePending.id), fromId);
    if (!accepted) return null;
    return { request: accepted, created: false, autoAccepted: true };
  }

  run(
    `INSERT INTO contact_requests (from_user_id, to_user_id, status)
     VALUES (?, ?, 'pending')`,
    [fromId, toId],
  );
  const id = Number(getLastInsertId() || 0);
  return {
    request: getContactRequestById(id),
    created: true,
    autoAccepted: false,
  };
}

export function acceptContactRequest(requestId, acceptingUserId) {
  const req = getContactRequestById(requestId);
  if (!req || String(req.status || "").toLowerCase() !== "pending") return null;
  if (Number(req.to_user_id) !== Number(acceptingUserId)) return null;

  run(
    `UPDATE contact_requests
     SET status = 'accepted', resolved_at = datetime('now')
     WHERE id = ?`,
    [Number(req.id)],
  );
  addMutualUserContacts(req.from_user_id, req.to_user_id);
  return getContactRequestById(Number(req.id));
}

export function rejectContactRequest(requestId, rejectingUserId) {
  const req = getContactRequestById(requestId);
  if (!req || String(req.status || "").toLowerCase() !== "pending") return null;
  if (Number(req.to_user_id) !== Number(rejectingUserId)) return null;

  run(
    `UPDATE contact_requests
     SET status = 'rejected', resolved_at = datetime('now')
     WHERE id = ?`,
    [Number(req.id)],
  );
  return getContactRequestById(Number(req.id));
}

export function cancelContactRequest(requestId, fromUserId) {
  const req = getContactRequestById(requestId);
  if (!req || String(req.status || "").toLowerCase() !== "pending") return null;
  if (Number(req.from_user_id) !== Number(fromUserId)) return null;

  run(
    `UPDATE contact_requests
     SET status = 'cancelled', resolved_at = datetime('now')
     WHERE id = ?`,
    [Number(req.id)],
  );
  return getContactRequestById(Number(req.id));
}

export function cancelPendingContactRequestsBetween(userIdA, userIdB) {
  const a = Number(userIdA || 0);
  const b = Number(userIdB || 0);
  if (!a || !b || a === b) return;
  run(
    `UPDATE contact_requests
     SET status = 'cancelled', resolved_at = datetime('now')
     WHERE status = 'pending'
       AND (
         (from_user_id = ? AND to_user_id = ?)
         OR (from_user_id = ? AND to_user_id = ?)
       )`,
    [a, b, b, a],
  );
}

export function removeMutualUserContacts(userIdA, userIdB) {
  removeUserContact(userIdA, userIdB);
  removeUserContact(userIdB, userIdA);
}

export function listOutgoingContactRequests(userId) {
  const ownerId = Number(userId || 0);
  if (!ownerId) return [];
  return getAll(
    `SELECT cr.id, cr.to_user_id, cr.created_at,
            u.username, u.nickname, u.avatar_url, u.color
     FROM contact_requests cr
     JOIN users u ON u.id = cr.to_user_id
     WHERE cr.from_user_id = ? AND cr.status = 'pending'
     ORDER BY julianday(cr.created_at) DESC, cr.id DESC`,
    [ownerId],
  );
}

export function listUserContacts(userId) {
  const ownerId = Number(userId || 0);
  if (!ownerId) return [];
  return getAll(
    `SELECT u.id, u.username, u.nickname, u.avatar_url, u.color, u.status, u.last_seen,
            uc.created_at AS contact_since
     FROM user_contacts uc
     JOIN users u ON u.id = uc.contact_user_id
     WHERE uc.user_id = ?
     ORDER BY COALESCE(NULLIF(u.nickname, ''), u.username) COLLATE NOCASE ASC`,
    [ownerId],
  );
}

export function listIncomingContactRequests(userId) {
  const ownerId = Number(userId || 0);
  if (!ownerId) return [];
  return getAll(
    `SELECT cr.id, cr.from_user_id, cr.created_at,
            u.username, u.nickname, u.avatar_url, u.color
     FROM contact_requests cr
     JOIN users u ON u.id = cr.from_user_id
     WHERE cr.to_user_id = ? AND cr.status = 'pending'
     ORDER BY julianday(cr.created_at) DESC, cr.id DESC`,
    [ownerId],
  );
}

export function getContactPeerStatus(userId, peerUserId) {
  const ownerId = Number(userId || 0);
  const peerId = Number(peerUserId || 0);
  if (!ownerId || !peerId || ownerId === peerId) {
    return { isContact: false };
  }
  const isContact = areUsersContacts(ownerId, peerId);
  const outgoing = getPendingContactRequest(ownerId, peerId);
  const incoming = getPendingContactRequest(peerId, ownerId);
  return {
    isContact,
    outgoingRequestId: outgoing?.id ? Number(outgoing.id) : null,
    incomingRequestId: incoming?.id ? Number(incoming.id) : null,
  };
}

// Internal admin helpers for server-side DB tooling endpoints.
export function adminGetRow(sql, params = []) {
  return getRow(sql, params);
}

export function adminGetAll(sql, params = []) {
  return getAll(sql, params);
}

export function adminRun(sql, params = []) {
  runWithoutSave(sql, params);
}

export function adminSave() {
  saveDatabase();
}
