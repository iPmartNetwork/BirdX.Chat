import {
  normalizeChatType,
  normalizeGroupUsername,
  normalizeHexColor,
  normalizeVisibility,
  parseListValue,
  resolveChatRow,
  resolveUserRow,
} from "../lib/dbToolHelpers.js";
import { storageEncryption } from "../lib/storageEncryption.js";
import os from "node:os";

function registerAdminRoutes(app, deps) {
  const {
    adminGetAll,
    adminGetRow,
    adminRun,
    adminSave,
    chunkArray,
    bcrypt,
    setUserColor,
    NICKNAME_MAX,
    USERNAME_MAX,
    MESSAGE_MAX_CHARS,
    ACCOUNT_CREATION,
    APP_ENV,
    VAPID_PUBLIC_KEY,
    USERNAME_REGEX,
    isLoopbackRequest,
    removeAllMessageUploads,
    removeStoredFileNames,
    buildInspectSnapshot,
    buildTimestampSchedule,
    addChatMember,
    applyRequiredChannelsToAllUsers,
    clearChatMemberLeft,
    clearGroupMemberRemoved,
    getChatMemberRole,
    isRequiredChannel,
    listAvailableRequiredChannels,
    listRequiredChannels,
    setChatMemberRole,
    setRequiredChannels,
    avatarUploadRootDir,
    fs,
    path,
    projectRootDir,
    uploadRootDir,
    emitChatEvent,
    emitSseEvent,
    ADMIN_USERNAMES = [],
    deleteChatById,
    deleteUserById,
    ensureAvatarExists,
    requireSession,
  } = deps;

  const adminUsernameSet = new Set(
    (Array.isArray(ADMIN_USERNAMES) ? ADMIN_USERNAMES : [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean),
  );

  const adminHasColumn = (tableName, columnName) =>
    adminGetAll(`PRAGMA table_info('${String(tableName || "").replace(/'/g, "''")}')`).some(
      (column) => column?.name === columnName,
    );

  const ensureAdminSchema = () => {
    try {
      if (!adminHasColumn("users", "role")) {
        adminRun("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
      }

      if (!adminHasColumn("sessions", "ip_address")) {
        adminRun("ALTER TABLE sessions ADD COLUMN ip_address TEXT");
      }
      if (!adminHasColumn("sessions", "user_agent")) {
        adminRun("ALTER TABLE sessions ADD COLUMN user_agent TEXT");
      }

      adminRun(`
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_user_id INTEGER,
          actor_username TEXT,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      adminRun(`
        CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
        ON admin_audit_logs(created_at)
      `);

      adminRun(`
        CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
        ON admin_audit_logs(actor_user_id)
      `);

      if (!adminHasColumn("admin_audit_logs", "ip_address")) {
        adminRun("ALTER TABLE admin_audit_logs ADD COLUMN ip_address TEXT");
      }
      if (!adminHasColumn("admin_audit_logs", "user_agent")) {
        adminRun("ALTER TABLE admin_audit_logs ADD COLUMN user_agent TEXT");
      }
      if (!adminHasColumn("admin_audit_logs", "success")) {
        adminRun("ALTER TABLE admin_audit_logs ADD COLUMN success INTEGER NOT NULL DEFAULT 1");
      }

      adminRun(`
        CREATE TABLE IF NOT EXISTS security_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          username TEXT,
          user_id INTEGER,
          ip_address TEXT,
          user_agent TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      adminRun(`
        CREATE INDEX IF NOT EXISTS idx_security_events_created_at
        ON security_events(created_at)
      `);

      adminRun(`
        CREATE INDEX IF NOT EXISTS idx_security_events_type
        ON security_events(type)
      `);

      adminSave();
    } catch (error) {
      console.warn("[admin] schema self-heal failed:", String(error?.message || error));
    }
  };

  ensureAdminSchema();

  const ADMIN_ROLES = ["owner", "admin", "moderator", "support"];
  const ALL_ROLES = [...ADMIN_ROLES, "user"];
  const normalizeAdminRole = (value) => {
    const role = String(value || "").trim().toLowerCase();
    return ALL_ROLES.includes(role) ? role : "user";
  };

  const resolveSessionRole = (session) => {
    const username = String(session?.username || "").toLowerCase();
    if (adminUsernameSet.has(username)) return "owner";
    return normalizeAdminRole(session?.role);
  };

  const hasPermission = (session, permission) => {
    const role = resolveSessionRole(session);
    if (role === "owner") return true;
    const permissions = {
      view: ["admin", "moderator", "support"],
      usersRead: ["admin", "moderator", "support"],
      usersWrite: ["admin"],
      rolesWrite: ["admin"],
      chatsWrite: ["admin", "moderator"],
      chatAdminWrite: ["admin"],
      filesWrite: ["admin", "moderator"],
      auditRead: ["admin"],
      backupsWrite: ["admin"],
      settingsRead: ["admin", "moderator", "support"],
      settingsWrite: ["admin"],
    };
    return (permissions[permission] || []).includes(role);
  };

  const isAdminSession = (session) =>
    Boolean(
      session &&
        (ADMIN_ROLES.includes(resolveSessionRole(session)) ||
          adminUsernameSet.has(String(session.username || "").toLowerCase())),
    );

  const requireAdminSession = (req, res, permission = "view") => {
    const session = requireSession?.(req, res);
    if (!session) return null;
    if (!isAdminSession(session)) {
      res.status(403).json({ error: "Admin access is required." });
      return null;
    }
    if (!hasPermission(session, permission)) {
      res.status(403).json({ error: "You do not have permission for this admin action." });
      return null;
    }
    return session;
  };

  const getRequestIp = (req) =>
    String(
      req?.headers?.["x-forwarded-for"] ||
        req?.headers?.["x-real-ip"] ||
        req?.socket?.remoteAddress ||
        req?.ip ||
        "",
    )
      .split(",")[0]
      .trim();

  const writeAuditLog = (
    req,
    session,
    action,
    targetType = "",
    targetId = "",
    details = {},
    success = true,
  ) => {
    try {
      adminRun(
        `INSERT INTO admin_audit_logs (
          actor_user_id, actor_username, action, target_type, target_id, details,
          ip_address, user_agent, success
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(session?.id || 0) || null,
          session?.username || "",
          String(action || ""),
          String(targetType || ""),
          String(targetId || ""),
          JSON.stringify(details || {}),
          getRequestIp(req),
          String(req?.headers?.["user-agent"] || "").slice(0, 500),
          success ? 1 : 0,
        ],
      );
      adminSave();
    } catch (error) {
      console.warn("[admin] audit log failed:", String(error?.message || error));
    }
  };

  const toInt = (value) => Number.parseInt(String(value || "0"), 10) || 0;
  const resolvePagination = (query = {}) => {
    const page = Math.max(1, toInt(query.page) || 1);
    const pageSize = Math.max(10, Math.min(100, toInt(query.pageSize) || 25));
    return { page, pageSize, offset: (page - 1) * pageSize };
  };
  const resolveSort = (value, allowed, fallback) => {
    const key = String(value || "").trim();
    return allowed[key] || fallback;
  };
  const createPaginationPayload = (total, page, pageSize) => ({
    total: Number(total || 0),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / pageSize)),
  });
  const toBytesLabel = (bytes) => {
    const value = Math.max(0, Number(bytes || 0));
    if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  };

  const countRoleAdmins = () =>
    Number(adminGetRow("SELECT COUNT(*) AS count FROM users WHERE role IN ('owner', 'admin')")?.count || 0);

  const requireAdminPassword = (req, res, session) => {
    const password = String(req.body?.adminPassword || "");
    if (!password) {
      res.status(400).json({ error: "Admin password confirmation is required." });
      return false;
    }
    const user = adminGetRow("SELECT password_hash FROM users WHERE id = ?", [
      Number(session?.id || 0),
    ]);
    if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      writeAuditLog(req, session, "admin.reauth.failed", "user", session?.id || "", {}, false);
      res.status(403).json({ error: "Admin password confirmation failed." });
      return false;
    }
    return true;
  };

  const backupDir = path.join(projectRootDir, "data", "backups");
  const dbFilePath = path.join(projectRootDir, "data", "songbird.db");

  const ensureBackupDir = () => {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  };

  const listBackupFiles = () => {
    ensureBackupDir();
    return fs
      .readdirSync(backupDir)
      .filter((name) => /^birdx-backup-\d{8}-\d{6}\.db$/.test(name))
      .map((name) => {
        const fullPath = path.join(backupDir, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          sizeBytes: stat.size,
          sizeLabel: toBytesLabel(stat.size),
          createdAt: stat.birthtime?.toISOString?.() || stat.mtime?.toISOString?.() || "",
        };
      })
      .sort((a, b) => String(b.name).localeCompare(String(a.name)));
  };

  let lastCpuSample = null;
  const getCpuSample = () => {
    const cpus = os.cpus() || [];
    const totals = cpus.reduce(
      (acc, cpu) => {
        const times = cpu.times || {};
        const idle = Number(times.idle || 0);
        const total = Object.values(times).reduce((sum, value) => sum + Number(value || 0), 0);
        acc.idle += idle;
        acc.total += total;
        return acc;
      },
      { idle: 0, total: 0 },
    );
    return { ...totals, at: Date.now() };
  };

  const getCpuUsagePercent = () => {
    const next = getCpuSample();
    if (!lastCpuSample) {
      lastCpuSample = next;
      const load = Number(os.loadavg?.()[0] || 0);
      const cores = Math.max(1, os.cpus()?.length || 1);
      return Math.max(0, Math.min(100, (load / cores) * 100));
    }
    const idleDelta = Math.max(0, next.idle - lastCpuSample.idle);
    const totalDelta = Math.max(1, next.total - lastCpuSample.total);
    lastCpuSample = next;
    return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
  };

  const percent = (used, total) => {
    const safeTotal = Number(total || 0);
    if (!safeTotal) return 0;
    return Math.max(0, Math.min(100, (Number(used || 0) / safeTotal) * 100));
  };

  const toStatus = (value) => {
    const number = Number(value || 0);
    if (number >= 90) return "critical";
    if (number >= 75) return "warning";
    return "healthy";
  };

  const getDirectorySize = (dirPath, maxEntries = 5000) => {
    try {
      if (!dirPath || !fs.existsSync(dirPath)) return 0;
      let total = 0;
      let scanned = 0;
      const stack = [dirPath];
      while (stack.length && scanned < maxEntries) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        entries.forEach((entry) => {
          if (scanned >= maxEntries) return;
          scanned += 1;
          const entryPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(entryPath);
          } else if (entry.isFile()) {
            total += fs.statSync(entryPath).size;
          }
        });
      }
      return total;
    } catch {
      return 0;
    }
  };

  const getDiskSnapshot = () => {
    try {
      const stats = fs.statfsSync(projectRootDir);
      const total = Number(stats.blocks || 0) * Number(stats.bsize || 0);
      const free = Number(stats.bavail || stats.bfree || 0) * Number(stats.bsize || 0);
      const used = Math.max(0, total - free);
      const usage = percent(used, total);
      return {
        total,
        used,
        free,
        percent: Math.round(usage),
        totalLabel: toBytesLabel(total),
        usedLabel: toBytesLabel(used),
        freeLabel: toBytesLabel(free),
        status: toStatus(usage),
      };
    } catch {
      return {
        total: 0,
        used: 0,
        free: 0,
        percent: 0,
        totalLabel: "0 B",
        usedLabel: "0 B",
        freeLabel: "0 B",
        status: "unknown",
      };
    }
  };

  const countSince = (table, where = "", params = []) =>
    Number(
      adminGetRow(
        `SELECT COUNT(*) AS count FROM ${table} WHERE datetime(created_at) >= datetime('now', '-24 hours') ${
          where ? `AND ${where}` : ""
        }`,
        params,
      )?.count || 0,
    );

  const normalizeChatMemberRole = (value) => {
    const role = String(value || "").trim().toLowerCase();
    return ["owner", "admin", "moderator", "member"].includes(role) ? role : "member";
  };

  const getAdminChatRow = (chatId) =>
    adminGetRow(
      `SELECT id, name, type, group_username, group_visibility, invite_token, group_color,
              allow_member_invites, group_avatar_url, created_by_user_id, created_at
       FROM chats
       WHERE id = ? AND type IN ('group', 'channel')`,
      [Number(chatId)],
    );

  const assertCanManageChat = (req, res) => {
    const session = requireAdminSession(req, res, "chatAdminWrite");
    if (!session) return null;
    if (!requireAdminPassword(req, res, session)) return null;
    return session;
  };

  app.get("/api/admin/system-health", (req, res) => {
    const session = requireAdminSession(req, res, "settingsRead");
    if (!session) return;

    const memoryTotal = Number(os.totalmem?.() || 0);
    const memoryFree = Number(os.freemem?.() || 0);
    const memoryUsed = Math.max(0, memoryTotal - memoryFree);
    const memoryPercent = Math.round(percent(memoryUsed, memoryTotal));
    const cpuPercent = Math.round(getCpuUsagePercent());
    const disk = getDiskSnapshot();
    const databaseBytes = fs.existsSync(dbFilePath) ? fs.statSync(dbFilePath).size : 0;
    const uploadsBytes = getDirectorySize(uploadRootDir || path.join(projectRootDir, "uploads"));
    const latestBackup = listBackupFiles()[0] || null;
    const versionPath = path.join(projectRootDir, "VERSION");
    const version = fs.existsSync(versionPath)
      ? String(fs.readFileSync(versionPath, "utf8")).trim()
      : "";

    res.json({
      ok: true,
      system: {
        cpu: {
          percent: cpuPercent,
          cores: os.cpus()?.length || 0,
          model: os.cpus?.()[0]?.model || "",
          loadAverage: os.loadavg?.() || [],
          status: toStatus(cpuPercent),
        },
        memory: {
          total: memoryTotal,
          used: memoryUsed,
          free: memoryFree,
          percent: memoryPercent,
          totalLabel: toBytesLabel(memoryTotal),
          usedLabel: toBytesLabel(memoryUsed),
          freeLabel: toBytesLabel(memoryFree),
          status: toStatus(memoryPercent),
        },
        disk,
        runtime: {
          uptimeSeconds: Math.round(process.uptime()),
          systemUptimeSeconds: Math.round(os.uptime?.() || 0),
          platform: os.platform?.() || "",
          arch: os.arch?.() || "",
          nodeVersion: process.version,
          appEnv: APP_ENV || process.env.APP_ENV || "production",
          birdxVersion: version,
        },
        services: {
          database: {
            exists: fs.existsSync(dbFilePath),
            sizeBytes: databaseBytes,
            sizeLabel: toBytesLabel(databaseBytes),
          },
          uploads: {
            sizeBytes: uploadsBytes,
            sizeLabel: toBytesLabel(uploadsBytes),
          },
          push: {
            configured: Boolean(VAPID_PUBLIC_KEY),
          },
          turn: {
            configured: Boolean(process.env.APP_TURN_URLS || process.env.TURN_URLS),
          },
          storageEncryption: {
            enabled: Boolean(storageEncryption?.isEnabled?.()),
          },
          backups: {
            count: listBackupFiles().length,
            latest: latestBackup,
          },
        },
      },
    });
  });

  app.get("/api/admin/security-summary", (req, res) => {
    const session = requireAdminSession(req, res, "auditRead");
    if (!session) return;

    const failedLogins24h = countSince("security_events", "type = ?", ["login.failed"]);
    const bannedLogins24h = countSince("security_events", "type = ?", ["login.banned"]);
    const failedReauth24h = countSince("admin_audit_logs", "action = ? AND COALESCE(success, 1) = 0", [
      "admin.reauth.failed",
    ]);
    const sensitiveActions24h = countSince(
      "admin_audit_logs",
      "action IN ('user.update', 'user.reset_password', 'user.sessions.delete_all', 'user.session.delete', 'user.delete', 'chat.delete', 'file.delete', 'backup.create', 'backup.delete', 'chat.member.add', 'chat.member.role', 'chat.member.remove', 'chat.visibility.update')",
    );
    const activeAdminSessions = Number(
      adminGetRow(
        `SELECT COUNT(*) AS count
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE users.role IN ('owner', 'admin', 'moderator', 'support')`,
      )?.count || 0,
    );
    const recentEvents = adminGetAll(
      `SELECT id, type, username, ip_address, user_agent, details, created_at
       FROM security_events
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 12`,
    ).map((event) => {
      let details = {};
      try {
        details = event.details ? JSON.parse(event.details) : {};
      } catch {
        details = {};
      }
      return { ...event, details };
    });
    const recentSensitiveActions = adminGetAll(
      `SELECT id, actor_username, action, target_type, target_id, ip_address, success, created_at
       FROM admin_audit_logs
       WHERE action IN ('user.update', 'user.reset_password', 'user.sessions.delete_all', 'user.session.delete', 'user.delete', 'chat.delete', 'file.delete', 'backup.create', 'backup.delete', 'chat.member.add', 'chat.member.role', 'chat.member.remove', 'chat.visibility.update', 'admin.reauth.failed')
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 12`,
    ).map((row) => ({ ...row, success: Boolean(Number(row.success || 0)) }));
    const topIps = adminGetAll(
      `SELECT ip_address, COUNT(*) AS count
       FROM security_events
       WHERE datetime(created_at) >= datetime('now', '-24 hours') AND COALESCE(ip_address, '') != ''
       GROUP BY ip_address
       ORDER BY count DESC
       LIMIT 8`,
    ).map((row) => ({ ip: row.ip_address, count: Number(row.count || 0) }));

    res.json({
      ok: true,
      security: {
        failedLogins24h,
        bannedLogins24h,
        failedReauth24h,
        sensitiveActions24h,
        activeAdminSessions,
        topIps,
        recentEvents,
        recentSensitiveActions,
      },
    });
  });

  app.get("/api/admin/me", (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    res.json({
      ok: true,
      user: {
        id: session.id,
        username: session.username,
        nickname: session.nickname || null,
        role: resolveSessionRole(session),
        isAdmin: true,
      },
    });
  });

  app.get("/api/admin/overview", (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const users = adminGetRow(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN role IN ('owner', 'admin') THEN 1 ELSE 0 END) AS admins,
        SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) AS owners,
        SUM(CASE WHEN role = 'moderator' THEN 1 ELSE 0 END) AS moderators,
        SUM(CASE WHEN role = 'support' THEN 1 ELSE 0 END) AS support,
        SUM(CASE WHEN COALESCE(banned, 0) = 1 THEN 1 ELSE 0 END) AS banned,
        SUM(CASE WHEN julianday('now') - julianday(last_seen) <= (15.0 / 1440.0) THEN 1 ELSE 0 END) AS recentlyActive
      FROM users
    `);
    const chats = adminGetAll(`
      SELECT type, COUNT(*) AS count
      FROM chats
      GROUP BY type
    `);
    const messages = adminGetRow("SELECT COUNT(*) AS total FROM chat_messages");
    const files = adminGetRow(`
      SELECT COUNT(*) AS total, COALESCE(SUM(size_bytes), 0) AS bytes
      FROM chat_message_files
    `);
    const sessions = adminGetRow("SELECT COUNT(*) AS total FROM sessions");
    const latestAudit = adminGetAll(`
      SELECT id, actor_username, action, target_type, target_id, created_at
      FROM admin_audit_logs
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 8
    `);

    res.json({
      ok: true,
      stats: {
        users: {
          total: Number(users?.total || 0),
          admins: Number(users?.admins || 0),
          owners: Number(users?.owners || 0),
          moderators: Number(users?.moderators || 0),
          support: Number(users?.support || 0),
          banned: Number(users?.banned || 0),
          recentlyActive: Number(users?.recentlyActive || 0),
        },
        chats: chats.reduce((acc, row) => {
          acc[String(row.type || "unknown")] = Number(row.count || 0);
          return acc;
        }, {}),
        messages: Number(messages?.total || 0),
        files: {
          total: Number(files?.total || 0),
          bytes: Number(files?.bytes || 0),
          label: toBytesLabel(files?.bytes || 0),
        },
        sessions: Number(sessions?.total || 0),
      },
      latestAudit,
      admin: {
        username: session.username,
        role: resolveSessionRole(session),
        envAdmin: adminUsernameSet.has(String(session.username || "").toLowerCase()),
      },
    });
  });

  app.get("/api/admin/users", (req, res) => {
    const session = requireAdminSession(req, res, "usersRead");
    if (!session) return;

    const { page, pageSize, offset } = resolvePagination(req.query);
    const query = String(req.query?.query || "").trim();
    const role = String(req.query?.role || "").trim().toLowerCase();
    const status = String(req.query?.status || "").trim().toLowerCase();
    const params = [];
    const where = [];
    if (query) {
      where.push("(users.username LIKE ? OR users.nickname LIKE ?)");
      params.push(`%${query}%`, `%${query}%`);
    }
    if (ALL_ROLES.includes(role)) {
      where.push("users.role = ?");
      params.push(role);
    }
    if (status === "banned") {
      where.push("COALESCE(users.banned, 0) = 1");
    } else if (status === "active") {
      where.push("COALESCE(users.banned, 0) = 0");
    } else if (status === "recent") {
      where.push("julianday('now') - julianday(users.last_seen) <= (15.0 / 1440.0)");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sortSql = resolveSort(
      req.query?.sort,
      {
        newest: "datetime(users.created_at) DESC, users.id DESC",
        username: "users.username COLLATE NOCASE ASC",
        messages: "message_count DESC, users.id DESC",
        chats: "chat_count DESC, users.id DESC",
        last_seen: "datetime(users.last_seen) DESC, users.id DESC",
      },
      "datetime(users.created_at) DESC, users.id DESC",
    );

    const total = adminGetRow(
      `SELECT COUNT(*) AS total FROM users ${whereSql}`,
      params,
    )?.total;

    const users = adminGetAll(
      `
        SELECT
          users.id, users.username, users.nickname, users.avatar_url, users.color,
          users.status, users.banned, users.role, users.created_at, users.last_seen,
          COUNT(DISTINCT chat_members.chat_id) AS chat_count,
          COUNT(DISTINCT chat_messages.id) AS message_count
        FROM users
        LEFT JOIN chat_members ON chat_members.user_id = users.id
        LEFT JOIN chat_messages ON chat_messages.user_id = users.id
        ${whereSql}
        GROUP BY users.id
        ORDER BY ${sortSql}
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset],
    ).map((user) => ({
      ...user,
      avatar_url: ensureAvatarExists?.(user.id, user.avatar_url) || null,
      banned: Boolean(Number(user.banned || 0)),
      role: normalizeAdminRole(user.role),
      envAdmin: adminUsernameSet.has(String(user.username || "").toLowerCase()),
      chat_count: Number(user.chat_count || 0),
      message_count: Number(user.message_count || 0),
    }));

    res.json({
      ok: true,
      users,
      pagination: createPaginationPayload(total, page, pageSize),
    });
  });

  app.get("/api/admin/users/:id", (req, res) => {
    const session = requireAdminSession(req, res, "usersRead");
    if (!session) return;

    const userId = toInt(req.params.id);
    const user = userId
      ? adminGetRow(
          `SELECT id, username, nickname, avatar_url, color, status, banned, role, created_at, last_seen
           FROM users
           WHERE id = ?`,
          [userId],
        )
      : null;
    if (!user?.id) return res.status(404).json({ error: "User not found." });

    const stats = adminGetRow(
      `
        SELECT
          (SELECT COUNT(*) FROM chat_messages WHERE user_id = ?) AS messages,
          (SELECT COUNT(*) FROM chat_members WHERE user_id = ?) AS chats,
          (SELECT COUNT(*) FROM sessions WHERE user_id = ?) AS sessions,
          (SELECT COUNT(*) FROM chat_message_files cmf
             JOIN chat_messages cm ON cm.id = cmf.message_id
             WHERE cm.user_id = ?) AS files,
          (SELECT COALESCE(SUM(cmf.size_bytes), 0) FROM chat_message_files cmf
             JOIN chat_messages cm ON cm.id = cmf.message_id
             WHERE cm.user_id = ?) AS storageBytes
      `,
      [userId, userId, userId, userId, userId],
    );
    const sessions = adminGetAll(
      `SELECT id, created_at, last_seen, ip_address, user_agent
       FROM sessions
       WHERE user_id = ?
       ORDER BY datetime(last_seen) DESC, id DESC`,
      [userId],
    );
    const chats = adminGetAll(
      `
        SELECT chats.id, chats.name, chats.type, chats.group_username, chats.created_at, chat_members.role,
               COUNT(chat_messages.id) AS message_count
        FROM chat_members
        JOIN chats ON chats.id = chat_members.chat_id
        LEFT JOIN chat_messages ON chat_messages.chat_id = chats.id
        WHERE chat_members.user_id = ?
        GROUP BY chats.id
        ORDER BY datetime(chats.created_at) DESC, chats.id DESC
        LIMIT 20
      `,
      [userId],
    );
    const files = adminGetAll(
      `
        SELECT cmf.id, cmf.original_name, cmf.stored_name, cmf.mime_type, cmf.size_bytes, cmf.created_at
        FROM chat_message_files cmf
        JOIN chat_messages cm ON cm.id = cmf.message_id
        WHERE cm.user_id = ?
        ORDER BY datetime(cmf.created_at) DESC, cmf.id DESC
        LIMIT 20
      `,
      [userId],
    ).map((file) => ({
      ...file,
      size_bytes: Number(file.size_bytes || 0),
      size_label: toBytesLabel(file.size_bytes || 0),
    }));

    res.json({
      ok: true,
      user: {
        ...user,
        avatar_url: ensureAvatarExists?.(user.id, user.avatar_url) || null,
        banned: Boolean(Number(user.banned || 0)),
        role: normalizeAdminRole(user.role),
        envAdmin: adminUsernameSet.has(String(user.username || "").toLowerCase()),
      },
      stats: {
        messages: Number(stats?.messages || 0),
        chats: Number(stats?.chats || 0),
        sessions: Number(stats?.sessions || 0),
        files: Number(stats?.files || 0),
        storageBytes: Number(stats?.storageBytes || 0),
        storageLabel: toBytesLabel(stats?.storageBytes || 0),
      },
      sessions,
      chats,
      files,
    });
  });

  app.patch("/api/admin/users/:id", (req, res) => {
    const session = requireAdminSession(req, res, "usersWrite");
    if (!session) return;

    const userId = toInt(req.params.id);
    const target = userId ? adminGetRow("SELECT id, username, role, banned FROM users WHERE id = ?", [userId]) : null;
    if (!target?.id) return res.status(404).json({ error: "User not found." });
    if (Number(target.id) === Number(session.id) && req.body?.banned !== undefined) {
      return res.status(400).json({ error: "You cannot ban your own admin account." });
    }

    const updates = [];
    const params = [];
    const targetRole = normalizeAdminRole(target.role);
    const sessionRole = resolveSessionRole(session);
    if (targetRole === "owner" && sessionRole !== "owner") {
      return res.status(403).json({ error: "Only an owner can change an owner account." });
    }
    if (req.body?.role !== undefined) {
      if (!hasPermission(session, "rolesWrite")) {
        return res.status(403).json({ error: "You do not have permission to change roles." });
      }
      const nextRole = normalizeAdminRole(req.body.role);
      if (nextRole === "owner" && sessionRole !== "owner") {
        return res.status(403).json({ error: "Only an owner can assign the owner role." });
      }
      if (
        ["owner", "admin"].includes(targetRole) &&
        !["owner", "admin"].includes(nextRole) &&
        countRoleAdmins() <= 1 &&
        !adminUsernameSet.size
      ) {
        return res.status(400).json({ error: "At least one admin is required." });
      }
      updates.push("role = ?");
      params.push(nextRole);
    }
    if (req.body?.banned !== undefined) {
      updates.push("banned = ?");
      params.push(req.body.banned ? 1 : 0);
    }
    if (!updates.length) return res.status(400).json({ error: "No changes provided." });
    if (!requireAdminPassword(req, res, session)) return;
    params.push(userId);
    adminRun(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    if (req.body?.banned) {
      adminRun("DELETE FROM sessions WHERE user_id = ?", [userId]);
    }
    adminSave();
    writeAuditLog(req, session, "user.update", "user", userId, {
      role: req.body?.role,
      banned: req.body?.banned,
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/users/:id/reset-password", async (req, res) => {
    const session = requireAdminSession(req, res, "usersWrite");
    if (!session) return;

    const userId = toInt(req.params.id);
    const password = String(req.body?.password || "");
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const target = userId ? adminGetRow("SELECT id, username FROM users WHERE id = ?", [userId]) : null;
    if (!target?.id) return res.status(404).json({ error: "User not found." });
    if (!requireAdminPassword(req, res, session)) return;

    const passwordHash = await bcrypt.hash(password, 10);
    adminRun("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
    adminRun("DELETE FROM sessions WHERE user_id = ?", [userId]);
    adminSave();
    writeAuditLog(req, session, "user.reset_password", "user", userId, { username: target.username });
    res.json({ ok: true });
  });

  app.delete("/api/admin/users/:id/sessions", (req, res) => {
    const session = requireAdminSession(req, res, "usersWrite");
    if (!session) return;

    const userId = toInt(req.params.id);
    const target = userId ? adminGetRow("SELECT id, username FROM users WHERE id = ?", [userId]) : null;
    if (!target?.id) return res.status(404).json({ error: "User not found." });
    if (Number(userId) === Number(session.id)) {
      return res.status(400).json({ error: "Use logout to end your own current session." });
    }
    if (!requireAdminPassword(req, res, session)) return;
    const removed = Number(adminGetRow("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?", [userId])?.count || 0);
    adminRun("DELETE FROM sessions WHERE user_id = ?", [userId]);
    adminSave();
    writeAuditLog(req, session, "user.sessions.delete_all", "user", userId, {
      username: target.username,
      removed,
    });
    res.json({ ok: true, removed });
  });

  app.delete("/api/admin/users/:id/sessions/:sessionId", (req, res) => {
    const session = requireAdminSession(req, res, "usersWrite");
    if (!session) return;

    const userId = toInt(req.params.id);
    const sessionId = toInt(req.params.sessionId);
    const target = userId ? adminGetRow("SELECT id, username FROM users WHERE id = ?", [userId]) : null;
    if (!target?.id) return res.status(404).json({ error: "User not found." });
    if (Number(sessionId) === Number(session.session_id)) {
      return res.status(400).json({ error: "You cannot revoke your current admin session here." });
    }
    const existing = adminGetRow("SELECT id FROM sessions WHERE id = ? AND user_id = ?", [
      sessionId,
      userId,
    ]);
    if (!existing?.id) return res.status(404).json({ error: "Session not found." });
    if (!requireAdminPassword(req, res, session)) return;
    adminRun("DELETE FROM sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
    adminSave();
    writeAuditLog(req, session, "user.session.delete", "session", sessionId, {
      userId,
      username: target.username,
    });
    res.json({ ok: true });
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    const session = requireAdminSession(req, res, "usersWrite");
    if (!session) return;

    const userId = toInt(req.params.id);
    if (Number(userId) === Number(session.id)) {
      return res.status(400).json({ error: "You cannot delete your own admin account." });
    }
    const target = userId ? adminGetRow("SELECT id, username, role FROM users WHERE id = ?", [userId]) : null;
    if (!target?.id) return res.status(404).json({ error: "User not found." });
    const targetRole = normalizeAdminRole(target.role);
    if (targetRole === "owner" && resolveSessionRole(session) !== "owner") {
      return res.status(403).json({ error: "Only an owner can delete an owner account." });
    }
    if (["owner", "admin"].includes(targetRole) && countRoleAdmins() <= 1 && !adminUsernameSet.size) {
      return res.status(400).json({ error: "At least one admin is required." });
    }
    if (!requireAdminPassword(req, res, session)) return;

    const result = deleteUserById(userId);
    removeStoredFileNames(result?.storedNames || []);
    writeAuditLog(req, session, "user.delete", "user", userId, { username: target.username, result });
    res.json({ ok: true, result });
  });

  app.get("/api/admin/chats", (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const { page, pageSize, offset } = resolvePagination(req.query);
    const query = String(req.query?.query || "").trim();
    const type = String(req.query?.type || "").trim().toLowerCase();
    const visibility = String(req.query?.visibility || "").trim().toLowerCase();
    const where = [];
    const params = [];
    if (query) {
      where.push("(chats.name LIKE ? OR chats.group_username LIKE ?)");
      params.push(`%${query}%`, `%${query}%`);
    }
    if (["dm", "group", "channel", "saved"].includes(type)) {
      where.push("chats.type = ?");
      params.push(type);
    }
    if (["public", "private"].includes(visibility)) {
      where.push("chats.group_visibility = ?");
      params.push(visibility);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = adminGetRow(
      `SELECT COUNT(*) AS total FROM chats ${whereSql}`,
      params,
    )?.total;
    const sortSql = resolveSort(
      req.query?.sort,
      {
        newest: "datetime(chats.created_at) DESC, chats.id DESC",
        members: "member_count DESC, chats.id DESC",
        messages: "message_count DESC, chats.id DESC",
        name: "chats.name COLLATE NOCASE ASC",
      },
      "datetime(chats.created_at) DESC, chats.id DESC",
    );
    const chats = adminGetAll(
      `
        SELECT
          chats.id, chats.name, chats.type, chats.group_username, chats.group_visibility,
          chats.created_at, chats.created_by_user_id,
          COUNT(DISTINCT chat_members.user_id) AS member_count,
          COUNT(DISTINCT chat_messages.id) AS message_count,
          COUNT(DISTINCT CASE WHEN chat_members.role IN ('owner', 'admin', 'moderator') THEN chat_members.user_id END) AS admin_count
        FROM chats
        LEFT JOIN chat_members ON chat_members.chat_id = chats.id
        LEFT JOIN chat_messages ON chat_messages.chat_id = chats.id
        ${whereSql}
        GROUP BY chats.id
        ORDER BY ${sortSql}
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset],
    ).map((chat) => ({
      ...chat,
      member_count: Number(chat.member_count || 0),
      message_count: Number(chat.message_count || 0),
      admin_count: Number(chat.admin_count || 0),
    }));
    res.json({
      ok: true,
      chats,
      pagination: createPaginationPayload(total, page, pageSize),
    });
  });

  app.get("/api/admin/chats/:id/detail", (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const chatId = toInt(req.params.id);
    const chat = getAdminChatRow(chatId);
    if (!chat?.id) return res.status(404).json({ error: "Group or channel not found." });

    const stats = adminGetRow(
      `SELECT
         (SELECT COUNT(*) FROM chat_members WHERE chat_id = ?) AS members,
         (SELECT COUNT(*) FROM chat_members WHERE chat_id = ? AND role IN ('owner', 'admin', 'moderator')) AS admins,
         (SELECT COUNT(*) FROM chat_messages WHERE chat_id = ?) AS messages,
         (SELECT COUNT(*) FROM chat_message_files cmf
            JOIN chat_messages cm ON cm.id = cmf.message_id
            WHERE cm.chat_id = ?) AS files
       `,
      [chatId, chatId, chatId, chatId],
    );
    const members = adminGetAll(
      `SELECT users.id, users.username, users.nickname, users.avatar_url, users.color, users.status,
              users.last_seen, users.banned, chat_members.role
       FROM chat_members
       JOIN users ON users.id = chat_members.user_id
       WHERE chat_members.chat_id = ?
       ORDER BY
         CASE chat_members.role
           WHEN 'owner' THEN 0
           WHEN 'admin' THEN 1
           WHEN 'moderator' THEN 2
           ELSE 3
         END,
         users.username COLLATE NOCASE ASC`,
      [chatId],
    ).map((member) => ({
      ...member,
      avatar_url: ensureAvatarExists?.(member.id, member.avatar_url) || null,
      banned: Boolean(Number(member.banned || 0)),
      role: normalizeChatMemberRole(member.role),
    }));

    res.json({
      ok: true,
      chat: {
        ...chat,
        allow_member_invites: Boolean(Number(chat.allow_member_invites || 0)),
        required_channel: Boolean(isRequiredChannel?.(chatId)),
      },
      stats: {
        members: Number(stats?.members || 0),
        admins: Number(stats?.admins || 0),
        messages: Number(stats?.messages || 0),
        files: Number(stats?.files || 0),
      },
      members,
    });
  });

  app.patch("/api/admin/chats/:id/settings", (req, res) => {
    const session = assertCanManageChat(req, res);
    if (!session) return;

    const chatId = toInt(req.params.id);
    const chat = getAdminChatRow(chatId);
    if (!chat?.id) return res.status(404).json({ error: "Group or channel not found." });

    const updates = [];
    const params = [];
    const nextVisibility = req.body?.groupVisibility !== undefined
      ? normalizeVisibility(req.body.groupVisibility)
      : null;
    if (nextVisibility) {
      updates.push("group_visibility = ?");
      params.push(nextVisibility);
    }
    if (req.body?.groupUsername !== undefined) {
      const username = normalizeGroupUsername(req.body.groupUsername);
      if (username && !/^[a-z0-9_.]{3,32}$/.test(username)) {
        return res.status(400).json({
          error: "Public username must be 3-32 characters and use english letters, numbers, dot, or underscore.",
        });
      }
      if (username) {
        const existingUser = adminGetRow("SELECT id FROM users WHERE username = ?", [username]);
        const existingChat = adminGetRow(
          "SELECT id FROM chats WHERE group_username IN (?, ?) AND id != ?",
          [username, `@${username}`, chatId],
        );
        if (existingUser?.id || existingChat?.id) {
          return res.status(409).json({ error: "This public username is already in use." });
        }
      }
      updates.push("group_username = ?");
      params.push(username || null);
    }
    if (req.body?.allowMemberInvites !== undefined) {
      updates.push("allow_member_invites = ?");
      params.push(req.body.allowMemberInvites ? 1 : 0);
    }
    if (!updates.length) return res.status(400).json({ error: "No chat settings provided." });

    params.push(chatId);
    adminRun(`UPDATE chats SET ${updates.join(", ")} WHERE id = ?`, params);
    adminSave();
    writeAuditLog(req, session, "chat.visibility.update", "chat", chatId, {
      before: {
        groupVisibility: chat.group_visibility,
        groupUsername: chat.group_username,
        allowMemberInvites: Boolean(Number(chat.allow_member_invites || 0)),
      },
      after: {
        groupVisibility: nextVisibility || chat.group_visibility,
        groupUsername: req.body?.groupUsername,
        allowMemberInvites: req.body?.allowMemberInvites,
      },
    });
    res.json({ ok: true, detail: { chat: getAdminChatRow(chatId) } });
  });

  app.post("/api/admin/chats/:id/members", (req, res) => {
    const session = assertCanManageChat(req, res);
    if (!session) return;

    const chatId = toInt(req.params.id);
    const chat = getAdminChatRow(chatId);
    if (!chat?.id) return res.status(404).json({ error: "Group or channel not found." });

    const username = String(req.body?.username || "").trim().toLowerCase();
    const role = normalizeChatMemberRole(req.body?.role || "admin");
    if (!username) return res.status(400).json({ error: "Username is required." });
    const user = adminGetRow("SELECT id, username FROM users WHERE username = ?", [username]);
    if (!user?.id) return res.status(404).json({ error: "User not found." });

    addChatMember?.(chatId, user.id, role);
    clearChatMemberLeft?.(chatId, user.id);
    clearGroupMemberRemoved?.(chatId, user.id);
    setChatMemberRole?.(chatId, user.id, role);
    adminSave();
    writeAuditLog(req, session, "chat.member.add", "chat", chatId, {
      username: user.username,
      userId: user.id,
      role,
    });
    res.json({ ok: true });
  });

  app.patch("/api/admin/chats/:id/members/:userId", (req, res) => {
    const session = assertCanManageChat(req, res);
    if (!session) return;

    const chatId = toInt(req.params.id);
    const userId = toInt(req.params.userId);
    const chat = getAdminChatRow(chatId);
    if (!chat?.id) return res.status(404).json({ error: "Group or channel not found." });
    const member = adminGetRow(
      `SELECT users.id, users.username, chat_members.role
       FROM chat_members
       JOIN users ON users.id = chat_members.user_id
       WHERE chat_members.chat_id = ? AND chat_members.user_id = ?`,
      [chatId, userId],
    );
    if (!member?.id) return res.status(404).json({ error: "Member not found." });
    const nextRole = normalizeChatMemberRole(req.body?.role);
    const previousRole = normalizeChatMemberRole(member.role);
    if (
      previousRole === "owner" &&
      nextRole !== "owner" &&
      Number(adminGetRow("SELECT COUNT(*) AS count FROM chat_members WHERE chat_id = ? AND role = 'owner'", [chatId])?.count || 0) <= 1
    ) {
      return res.status(400).json({ error: "At least one group/channel owner is required." });
    }

    setChatMemberRole?.(chatId, userId, nextRole);
    adminSave();
    writeAuditLog(req, session, "chat.member.role", "chat", chatId, {
      username: member.username,
      userId,
      previousRole,
      nextRole,
    });
    res.json({ ok: true });
  });

  app.delete("/api/admin/chats/:id/members/:userId", (req, res) => {
    const session = assertCanManageChat(req, res);
    if (!session) return;

    const chatId = toInt(req.params.id);
    const userId = toInt(req.params.userId);
    const chat = getAdminChatRow(chatId);
    if (!chat?.id) return res.status(404).json({ error: "Group or channel not found." });
    const member = adminGetRow(
      `SELECT users.id, users.username, chat_members.role
       FROM chat_members
       JOIN users ON users.id = chat_members.user_id
       WHERE chat_members.chat_id = ? AND chat_members.user_id = ?`,
      [chatId, userId],
    );
    if (!member?.id) return res.status(404).json({ error: "Member not found." });
    if (chat.type === "channel" && isRequiredChannel?.(chatId)) {
      return res.status(403).json({
        error: "Members cannot be removed from a required channel.",
      });
    }
    if (
      normalizeChatMemberRole(member.role) === "owner" &&
      Number(adminGetRow("SELECT COUNT(*) AS count FROM chat_members WHERE chat_id = ? AND role = 'owner'", [chatId])?.count || 0) <= 1
    ) {
      return res.status(400).json({ error: "At least one group/channel owner is required." });
    }

    adminRun("DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?", [chatId, userId]);
    adminSave();
    writeAuditLog(req, session, "chat.member.remove", "chat", chatId, {
      username: member.username,
      userId,
      role: member.role,
    });
    res.json({ ok: true });
  });

  app.delete("/api/admin/chats/:id", (req, res) => {
    const session = requireAdminSession(req, res, "chatsWrite");
    if (!session) return;

    const chatId = toInt(req.params.id);
    const target = chatId ? adminGetRow("SELECT id, name, type FROM chats WHERE id = ?", [chatId]) : null;
    if (!target?.id) return res.status(404).json({ error: "Chat not found." });
    if (!requireAdminPassword(req, res, session)) return;
    const result = deleteChatById(chatId);
    removeStoredFileNames(result?.storedNames || []);
    writeAuditLog(req, session, "chat.delete", "chat", chatId, { name: target.name, type: target.type, result });
    res.json({ ok: true, result });
  });

  app.get("/api/admin/files", (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;

    const { page, pageSize, offset } = resolvePagination(req.query);
    const query = String(req.query?.query || "").trim();
    const kind = String(req.query?.kind || "").trim().toLowerCase();
    const where = [];
    const params = [];
    if (query) {
      where.push("(cmf.original_name LIKE ? OR cmf.stored_name LIKE ? OR users.username LIKE ?)");
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    if (kind) {
      where.push("(cmf.kind = ? OR cmf.mime_type LIKE ?)");
      params.push(kind, `${kind}/%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = adminGetRow(
      `
        SELECT COUNT(*) AS total
        FROM chat_message_files cmf
        LEFT JOIN chat_messages cm ON cm.id = cmf.message_id
        LEFT JOIN users ON users.id = cm.user_id
        ${whereSql}
      `,
      params,
    )?.total;
    const files = adminGetAll(`
      SELECT
        cmf.id, cmf.message_id, cmf.kind, cmf.original_name, cmf.stored_name,
        cmf.mime_type, cmf.size_bytes, cmf.created_at, cm.chat_id,
        users.username AS owner_username,
        chats.name AS chat_name,
        chats.type AS chat_type
      FROM chat_message_files cmf
      LEFT JOIN chat_messages cm ON cm.id = cmf.message_id
      LEFT JOIN users ON users.id = cm.user_id
      LEFT JOIN chats ON chats.id = cm.chat_id
      ${whereSql}
      ORDER BY datetime(cmf.created_at) DESC, cmf.id DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]).map((file) => ({
      ...file,
      size_bytes: Number(file.size_bytes || 0),
      size_label: toBytesLabel(file.size_bytes || 0),
    }));
    res.json({
      ok: true,
      files,
      pagination: createPaginationPayload(total, page, pageSize),
    });
  });

  app.delete("/api/admin/files/:id", (req, res) => {
    const session = requireAdminSession(req, res, "filesWrite");
    if (!session) return;

    const fileId = toInt(req.params.id);
    const target = fileId
      ? adminGetRow("SELECT id, stored_name, message_id, original_name FROM chat_message_files WHERE id = ?", [fileId])
      : null;
    if (!target?.id) return res.status(404).json({ error: "File not found." });
    if (!requireAdminPassword(req, res, session)) return;
    adminRun("DELETE FROM chat_message_files WHERE id = ?", [fileId]);
    adminSave();
    removeStoredFileNames([target.stored_name]);
    writeAuditLog(req, session, "file.delete", "file", fileId, {
      messageId: target.message_id,
      originalName: target.original_name,
    });
    res.json({ ok: true });
  });

  app.get("/api/admin/audit-logs", (req, res) => {
    const session = requireAdminSession(req, res, "auditRead");
    if (!session) return;

    const { page, pageSize, offset } = resolvePagination(req.query);
    const action = String(req.query?.action || "").trim();
    const actor = String(req.query?.actor || "").trim();
    const targetType = String(req.query?.targetType || "").trim();
    const where = [];
    const params = [];
    if (action) {
      where.push("action LIKE ?");
      params.push(`%${action}%`);
    }
    if (actor) {
      where.push("actor_username LIKE ?");
      params.push(`%${actor}%`);
    }
    if (targetType) {
      where.push("target_type = ?");
      params.push(targetType);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = adminGetRow(
      `SELECT COUNT(*) AS total FROM admin_audit_logs ${whereSql}`,
      params,
    )?.total;

    const logs = adminGetAll(`
      SELECT id, actor_user_id, actor_username, action, target_type, target_id, details,
             ip_address, user_agent, success, created_at
      FROM admin_audit_logs
      ${whereSql}
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]).map((log) => {
      let details = {};
      try {
        details = log.details ? JSON.parse(log.details) : {};
      } catch {
        details = {};
      }
      return { ...log, success: Boolean(Number(log.success || 0)), details };
    });
    res.json({
      ok: true,
      logs,
      pagination: createPaginationPayload(total, page, pageSize),
    });
  });

  app.get("/api/admin/backups", (req, res) => {
    const session = requireAdminSession(req, res, "settingsRead");
    if (!session) return;
    res.json({ ok: true, backups: listBackupFiles() });
  });

  app.post("/api/admin/backups", (req, res) => {
    const session = requireAdminSession(req, res, "backupsWrite");
    if (!session) return;
    if (!requireAdminPassword(req, res, session)) return;
    if (!fs.existsSync(dbFilePath)) {
      return res.status(404).json({ error: "Database file was not found." });
    }
    ensureBackupDir();
    adminSave();
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "-")
      .slice(0, 15);
    const name = `birdx-backup-${stamp}.db`;
    const targetPath = path.join(backupDir, name);
    fs.copyFileSync(dbFilePath, targetPath);
    const stat = fs.statSync(targetPath);
    writeAuditLog(req, session, "backup.create", "backup", name, {
      sizeBytes: stat.size,
    });
    res.json({
      ok: true,
      backup: {
        name,
        sizeBytes: stat.size,
        sizeLabel: toBytesLabel(stat.size),
        createdAt: stat.birthtime?.toISOString?.() || stat.mtime?.toISOString?.() || "",
      },
      backups: listBackupFiles(),
    });
  });

  app.get("/api/admin/backups/:name/download", (req, res) => {
    const session = requireAdminSession(req, res, "backupsWrite");
    if (!session) return;
    const name = path.basename(String(req.params.name || ""));
    if (!/^birdx-backup-\d{8}-\d{6}\.db$/.test(name)) {
      return res.status(400).json({ error: "Invalid backup name." });
    }
    const filePath = path.join(backupDir, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Backup not found." });
    writeAuditLog(req, session, "backup.download", "backup", name, {});
    return res.download(filePath, name);
  });

  app.delete("/api/admin/backups/:name", (req, res) => {
    const session = requireAdminSession(req, res, "backupsWrite");
    if (!session) return;
    const name = path.basename(String(req.params.name || ""));
    if (!/^birdx-backup-\d{8}-\d{6}\.db$/.test(name)) {
      return res.status(400).json({ error: "Invalid backup name." });
    }
    const filePath = path.join(backupDir, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Backup not found." });
    if (!requireAdminPassword(req, res, session)) return;
    fs.unlinkSync(filePath);
    writeAuditLog(req, session, "backup.delete", "backup", name, {});
    res.json({ ok: true, backups: listBackupFiles() });
  });

  app.get("/api/admin/required-channels", (req, res) => {
    const session = requireAdminSession(req, res, "settingsRead");
    if (!session) return;

    res.json({
      ok: true,
      requiredChannels: listRequiredChannels?.() || [],
      availableChannels: listAvailableRequiredChannels?.() || [],
    });
  });

  app.put("/api/admin/required-channels", (req, res) => {
    const session = requireAdminSession(req, res, "settingsWrite");
    if (!session) return;
    if (!requireAdminPassword(req, res, session)) return;

    const requestedIds = Array.isArray(req.body?.chatIds)
      ? req.body.chatIds
      : Array.isArray(req.body?.requiredChannelIds)
        ? req.body.requiredChannelIds
        : [];
    const selectedIds = Array.from(
      new Set(
        requestedIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    const savedIds = setRequiredChannels?.(selectedIds) || [];
    const applyResult = req.body?.applyNow
      ? applyRequiredChannelsToAllUsers?.() || {
          usersProcessed: 0,
          membershipsAdded: 0,
          requiredChannels: savedIds.length,
        }
      : null;

    writeAuditLog(req, session, "required_channels.update", "settings", "required_channels", {
      requestedIds: selectedIds,
      savedIds,
      applyNow: Boolean(req.body?.applyNow),
      applyResult,
    });

    res.json({
      ok: true,
      requiredChannels: listRequiredChannels?.() || [],
      availableChannels: listAvailableRequiredChannels?.() || [],
      result: applyResult,
    });
  });

  app.post("/api/admin/required-channels/apply", (req, res) => {
    const session = requireAdminSession(req, res, "settingsWrite");
    if (!session) return;
    if (!requireAdminPassword(req, res, session)) return;

    const result = applyRequiredChannelsToAllUsers?.() || {
      usersProcessed: 0,
      membershipsAdded: 0,
      requiredChannels: 0,
    };
    writeAuditLog(req, session, "required_channels.apply", "settings", "required_channels", result);

    res.json({
      ok: true,
      result,
      requiredChannels: listRequiredChannels?.() || [],
      availableChannels: listAvailableRequiredChannels?.() || [],
    });
  });

  app.get("/api/admin/settings", (req, res) => {
    const session = requireAdminSession(req, res, "settingsRead");
    if (!session) return;

    let dbInfo = {};
    try {
      dbInfo = buildInspectSnapshot?.() || {};
    } catch (error) {
      console.warn("[admin] settings inspect failed:", String(error?.message || error));
      dbInfo = {};
    }
    res.json({
      ok: true,
      settings: {
        accountCreation: Boolean(ACCOUNT_CREATION),
        messageMaxChars: Number(MESSAGE_MAX_CHARS || 0),
        adminUsernames: Array.from(adminUsernameSet),
        storageEncryption: Boolean(storageEncryption?.isEnabled?.()),
        database: dbInfo?.database || null,
        requiredChannels: listRequiredChannels?.() || [],
      },
    });
  });

  app.post("/api/admin/db-tools", async (req, res) => {
    if (!isLoopbackRequest(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const expectedToken = process.env.ADMIN_API_TOKEN;

    if (expectedToken) {
      const provided = String(req.headers["x-songbird-admin-token"] || "");

      if (!provided || provided !== expectedToken) {
        return res.status(401).json({ error: "Invalid admin token." });
      }
    }

    const action = String(req.body?.action || "")
      .trim()
      .toLowerCase();
    const payload = req.body?.payload || {};

    try {
      if (action === "delete_chats") {
        let chatIds = Array.isArray(payload.chatIds)
          ? payload.chatIds
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id) && id > 0)
          : [];
        if (!chatIds.length) {
          chatIds = adminGetAll("SELECT id FROM chats ORDER BY id ASC")
            .map((row) => Number(row.id))
            .filter((id) => Number.isFinite(id) && id > 0);
        }

        if (!chatIds.length) {
          return res.json({
            ok: true,
            result: { removedChats: 0, removedFiles: 0 },
          });
        }

        const placeholders = chatIds.map(() => "?").join(", ");
        const fileRows = adminGetAll(
          `SELECT cmf.stored_name
           FROM chat_message_files cmf
           JOIN chat_messages cm ON cm.id = cmf.message_id
           WHERE cm.chat_id IN (${placeholders})`,
          chatIds,
        );
        const storedNames = fileRows.map((row) => row.stored_name);

        adminRun("BEGIN");
        try {
          chunkArray(chatIds, 500).forEach((chunk) => {
            const chunkPlaceholders = chunk.map(() => "?").join(", ");

            adminRun(
              `DELETE FROM chat_message_reads WHERE message_id IN (
                SELECT id FROM chat_messages WHERE chat_id IN (${chunkPlaceholders})
              )`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_message_files WHERE message_id IN (
                SELECT id FROM chat_messages WHERE chat_id IN (${chunkPlaceholders})
              )`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_messages WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_members WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_mutes WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM group_removed_members WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_left_members WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM hidden_chats WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM required_channels WHERE chat_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM chats WHERE id IN (${chunkPlaceholders})`,
              chunk,
            );
          });

          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        removeStoredFileNames(storedNames);
        adminSave();

        return res.json({
          ok: true,
          result: {
            removedChats: chatIds.length,
            removedFiles: storedNames.length,
          },
        });
      }

      if (action === "delete_users") {
        const selectors = Array.isArray(payload.selectors)
          ? payload.selectors
          : [];

        let userIds = [];

        selectors.forEach((selector) => {
          const raw = String(selector || "").trim();
          if (!raw) return;

          const numeric = Number(raw);

          if (Number.isFinite(numeric) && numeric > 0) {
            userIds.push(Math.trunc(numeric));
            return;
          }

          const groupRow = adminGetRow(
            "SELECT id FROM chats WHERE type IN ('group', 'channel') AND group_username = ?",
            [raw],
          );
          if (groupRow?.id) {
            throw new Error(`Cannot delete user. "${raw}" is a group/channel username.`);
          }

          const row = adminGetRow("SELECT id FROM users WHERE username = ?", [raw]);

          if (row?.id) userIds.push(Number(row.id));
        });

        if (!userIds.length) {
          userIds = adminGetAll("SELECT id FROM users ORDER BY id ASC")
            .map((row) => Number(row.id))
            .filter((id) => Number.isFinite(id) && id > 0);
        }

        userIds = Array.from(new Set(userIds));

        if (!userIds.length) {
          return res.json({
            ok: true,
            result: { removedUsers: 0, removedFiles: 0, removedChats: 0 },
          });
        }

        const userPlaceholders = userIds.map(() => "?").join(", ");
        const ownerChatRows = adminGetAll(
          `SELECT chat_id FROM chat_members WHERE role = 'owner' AND user_id IN (${userPlaceholders})`,
          userIds,
        );
        const ownerChatIds = Array.from(
          new Set(ownerChatRows.map((row) => Number(row?.chat_id || 0)).filter(Boolean)),
        );
        const chatIdsToDelete = [];
        const ownershipTransfers = [];
        ownerChatIds.forEach((chatId) => {
          const remaining = adminGetAll(
            `SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id NOT IN (${userPlaceholders})`,
            [Number(chatId), ...userIds],
          )
            .map((row) => Number(row?.user_id || 0))
            .filter((id) => Number.isFinite(id) && id > 0);
          if (!remaining.length) {
            chatIdsToDelete.push(Number(chatId));
            return;
          }
          const nextOwnerId =
            remaining[Math.floor(Math.random() * remaining.length)];
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
        const chatDeletePlaceholders = uniqueChatDeletes.map(() => "?").join(", ");
        const chatStoredRows = uniqueChatDeletes.length
          ? adminGetAll(
              `SELECT cmf.stored_name
               FROM chat_message_files cmf
               JOIN chat_messages cm ON cm.id = cmf.message_id
               WHERE cm.chat_id IN (${chatDeletePlaceholders})`,
              uniqueChatDeletes,
            )
          : [];
        const storedNames = Array.from(
          new Set(
            [...chatStoredRows]
              .map((row) => String(row?.stored_name || "").trim())
              .filter(Boolean),
          ),
        );

        adminRun("BEGIN");
        try {
          if (uniqueChatDeletes.length) {
            chunkArray(uniqueChatDeletes, 500).forEach((chunk) => {
              const chunkPlaceholders = chunk.map(() => "?").join(", ");
              adminRun(
                `DELETE FROM chat_message_reads WHERE message_id IN (
                  SELECT id FROM chat_messages WHERE chat_id IN (${chunkPlaceholders})
                )`,
                chunk,
              );
              adminRun(
                `DELETE FROM chat_message_files WHERE message_id IN (
                  SELECT id FROM chat_messages WHERE chat_id IN (${chunkPlaceholders})
                )`,
                chunk,
              );
              adminRun(
                `DELETE FROM chat_messages WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM chat_members WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM chat_mutes WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM group_removed_members WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM chat_left_members WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM hidden_chats WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM required_channels WHERE chat_id IN (${chunkPlaceholders})`,
                chunk,
              );
              adminRun(
                `DELETE FROM chats WHERE id IN (${chunkPlaceholders})`,
                chunk,
              );
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
            adminRun(
              `UPDATE chat_members SET role = 'owner' WHERE chat_id = ? AND user_id = ?`,
              [Number(transfer.chatId), Number(transfer.nextOwnerId)],
            );
          });
          chunkArray(userIds, 500).forEach((chunk) => {
            const chunkPlaceholders = chunk.map(() => "?").join(", ");

            adminRun(
              `DELETE FROM chat_message_reads WHERE user_id IN (${chunkPlaceholders})`,
              chunk,
            );
            adminRun(
              `UPDATE chat_messages SET read_by_user_id = NULL WHERE read_by_user_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_members WHERE user_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM chat_left_members WHERE user_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM sessions WHERE user_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM hidden_chats WHERE user_id IN (${chunkPlaceholders})`,
              chunk,
            );

            adminRun(
              `DELETE FROM users WHERE id IN (${chunkPlaceholders})`,
              chunk,
            );

          });

          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        removeStoredFileNames(storedNames);
        adminSave();

        return res.json({
          ok: true,
          result: {
            removedUsers: userIds.length,
            removedFiles: storedNames.length,
            removedChats: uniqueChatDeletes.length,
          },
        });
      }

      if (action === "create_user") {
        const rawUsername = String(payload.username || "").trim().toLowerCase();
        const nickname = String(payload.nickname || "").trim();
        const password = String(payload.password || "");

        if (!nickname || !rawUsername || !password) {
          return res.status(400).json({
            error: "Nickname, username, and password are required.",
          });
        }
        if (rawUsername.length < 3) {
          return res.status(400).json({ error: "Username must be at least 3 characters." });
        }
        if (USERNAME_MAX && rawUsername.length > USERNAME_MAX) {
          return res.status(400).json({
            error: `Username must be at most ${USERNAME_MAX} characters.`,
          });
        }
        if (nickname && nickname.length > (NICKNAME_MAX || 0)) {
          return res.status(400).json({
            error: `Nickname must be at most ${NICKNAME_MAX} characters.`,
          });
        }

        if (USERNAME_REGEX && !USERNAME_REGEX.test(rawUsername)) {
          return res
            .status(400)
            .json({ error: "Invalid username. Allowed: lowercase english letters, numbers, ., _" });
        }

        const exists = adminGetRow("SELECT id FROM users WHERE username = ?", [
          rawUsername,
        ]);
        if (exists?.id) {
          return res.status(409).json({ error: "Username already exists." });
        }
        const groupExists = adminGetRow(
          "SELECT id FROM chats WHERE type IN ('group', 'channel') AND group_username = ?",
          [rawUsername],
        );
        if (groupExists?.id) {
          return res.status(409).json({ error: "Username already exists." });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const assignedColor = setUserColor ? setUserColor() : null;
        adminRun(
          `INSERT INTO users (username, nickname, avatar_url, color, status, password_hash, created_at, last_seen)
           VALUES (?, ?, NULL, ?, ?, ?, datetime('now'), datetime('now'))`,
          [rawUsername, nickname, assignedColor, "online", passwordHash],
        );
        adminSave();

        const row = adminGetRow(
          "SELECT id, username, nickname FROM users WHERE username = ?",
          [rawUsername],
        );

        return res.json({
          ok: true,
          result: {
            id: row?.id,
            username: row?.username,
            nickname: row?.nickname,
          },
        });
      }

      if (action === "create_chat") {
        const type = normalizeChatType(payload.type);
        const name = String(payload.name || "").trim();
        const ownerSelector = String(payload.owner || "").trim();
        const username = normalizeGroupUsername(payload.username);
        const visibility = normalizeVisibility(payload.visibility);
        const memberSelectors = Array.isArray(payload.memberSelectors)
          ? payload.memberSelectors
          : parseListValue(payload.memberSelectors);

        if (!name || !ownerSelector || !username) {
          return res.status(400).json({
            error: "Chat name, owner, and username are required.",
          });
        }

        const owner = resolveUserRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          ownerSelector,
        );
        if (!owner?.id) {
          return res.status(404).json({ error: "Owner user not found." });
        }

        const userConflict = adminGetRow("SELECT id FROM users WHERE username = ?", [
          username,
        ]);
        if (userConflict?.id) {
          return res.status(409).json({ error: "Chat username already exists." });
        }
        const chatConflict = adminGetRow(
          "SELECT id FROM chats WHERE type IN ('group', 'channel') AND group_username IN (?, ?)",
          [username, `@${username}`],
        );
        if (chatConflict?.id) {
          return res.status(409).json({ error: "Chat username already exists." });
        }

        const ownerUsername = String(owner.username || "").toLowerCase();
        const members = Array.from(
          new Map(
            memberSelectors
              .map((selector) =>
                resolveUserRow({ getRow: adminGetRow, getAll: adminGetAll }, selector),
              )
              .filter((row) => row?.id)
              .map((row) => [Number(row.id), row]),
          ).values(),
        ).filter(
          (row) => String(row?.username || "").toLowerCase() !== ownerUsername,
        );

        const inviteToken = deps.crypto.randomBytes(24).toString("hex");
        const fallbackColor =
          String(adminGetRow("SELECT color FROM users WHERE id = ?", [Number(owner.id)])?.color || "")
            .trim() || "#10b981";

        let row = null;
        adminRun("BEGIN");
        try {
          adminRun(
            `INSERT INTO chats (
              name, type, group_username, group_visibility, invite_token, created_by_user_id, group_color, allow_member_invites, group_avatar_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              name,
              type,
              username || null,
              visibility,
              inviteToken,
              Number(owner.id),
              fallbackColor,
              1,
              null,
            ],
          );
          row = adminGetRow(
            `SELECT id, name, type, group_username, group_visibility, created_by_user_id
             FROM chats
             WHERE rowid = last_insert_rowid()`,
          );
          if (!row?.id) {
            throw new Error("Failed to create chat.");
          }
          adminRun(
            "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)",
            [Number(row.id), Number(owner.id), "owner"],
          );
          members.forEach((member) => {
            adminRun(
              "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)",
              [Number(row.id), Number(member.id), "member"],
            );
          });
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }
        adminSave();

        return res.json({
          ok: true,
          result: {
            id: Number(row.id),
            type: row.type,
            name: row.name || "",
            addedMembers: members.length + 1,
          },
        });
      }

      if (action === "add_chat_members") {
        const chatSelector = String(payload.chatSelector || "").trim();
        const addAllUsers = Boolean(payload.addAllUsers);
        const rawSelectors = Array.isArray(payload.userSelectors)
          ? payload.userSelectors
          : parseListValue(payload.userSelectors);

        const chat = resolveChatRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          chatSelector,
        );
        if (!chat?.id) {
          return res.status(404).json({ error: "Chat not found." });
        }

        const users = addAllUsers
          ? adminGetAll("SELECT id, username FROM users ORDER BY id ASC")
          : Array.from(
              new Map(
                rawSelectors
                  .flatMap((selector) => parseListValue(selector))
                  .map((selector) =>
                    resolveUserRow({ getRow: adminGetRow, getAll: adminGetAll }, selector),
                  )
                  .filter((row) => row?.id)
                  .map((row) => [Number(row.id), row]),
              ).values(),
            );

        if (!users.length) {
          return res.status(404).json({ error: "No users matched." });
        }

        let addedCount = 0;
        let skippedLeftCount = 0;
        adminRun("BEGIN");
        try {
          users.forEach((user) => {
            const exists = adminGetRow(
              "SELECT 1 AS member FROM chat_members WHERE chat_id = ? AND user_id = ?",
              [Number(chat.id), Number(user.id)],
            );
            if (exists?.member) return;
            const priorLeft = adminGetRow(
              `SELECT 1 AS prior_left
               FROM chat_left_members
               WHERE chat_id = ? AND user_id = ?
               UNION
               SELECT 1 AS prior_left
               FROM chat_messages
               WHERE chat_id = ? AND user_id = ? AND body LIKE ?
               LIMIT 1`,
              [
                Number(chat.id),
                Number(user.id),
                Number(chat.id),
                Number(user.id),
                "[[system:left:%",
              ],
            );
            if (priorLeft?.prior_left) {
              skippedLeftCount += 1;
              return;
            }
            adminRun(
              "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)",
              [Number(chat.id), Number(user.id), "member"],
            );
            addedCount += 1;
          });
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }
        adminSave();

        return res.json({
          ok: true,
          result: { chatId: Number(chat.id), addedCount, skippedLeftCount },
        });
      }

      if (action === "edit_chat") {
        const chatSelector = String(payload.chatSelector || "").trim();
        const chat = resolveChatRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          chatSelector,
        );
        if (!chat?.id) {
          return res.status(404).json({ error: "Chat not found." });
        }

        const nextName =
          payload.name === undefined || payload.name === null
            ? String(chat.name || "")
            : String(payload.name || "").trim();
        const nextUsername =
          payload.username === undefined || payload.username === null
            ? normalizeGroupUsername(chat.group_username)
            : normalizeGroupUsername(payload.username);
        const nextVisibility =
          payload.visibility === undefined || payload.visibility === null
            ? normalizeVisibility(chat.group_visibility)
            : normalizeVisibility(payload.visibility);
        const nextColor =
          payload.color === undefined || payload.color === null
            ? String(chat.group_color || "").trim() || null
            : normalizeHexColor(payload.color);
        const effectiveVisibility = nextVisibility === "private" ? "private" : "public";
        if (
          effectiveVisibility !== "private" &&
          payload.allowMemberInvites !== null &&
          payload.allowMemberInvites !== undefined &&
          !payload.allowMemberInvites
        ) {
          return res.status(400).json({
            error:
              "Member invites can only be changed for private chats. Public chats always allow member invites.",
          });
        }
        const allowMemberInvites =
          effectiveVisibility === "private"
            ? payload.allowMemberInvites === null || payload.allowMemberInvites === undefined
              ? Number(chat.allow_member_invites || 0)
                ? 1
                : 0
              : payload.allowMemberInvites
                ? 1
                : 0
            : 1;

        if (payload.color !== undefined && payload.color !== null && !nextColor) {
          return res.status(400).json({ error: "Invalid color." });
        }

        if (nextUsername) {
          const userConflict = adminGetRow("SELECT id FROM users WHERE username = ?", [
            nextUsername,
          ]);
          if (userConflict?.id) {
            return res.status(409).json({ error: "Chat username already exists." });
          }
          const chatConflict = adminGetRow(
            "SELECT id FROM chats WHERE type IN ('group', 'channel') AND group_username IN (?, ?) AND id != ?",
            [nextUsername, `@${nextUsername}`, Number(chat.id)],
          );
          if (chatConflict?.id) {
            return res.status(409).json({ error: "Chat username already exists." });
          }
        }

        let nextOwner = null;
        if (payload.owner !== undefined && payload.owner !== null) {
          nextOwner = resolveUserRow(
            { getRow: adminGetRow, getAll: adminGetAll },
            payload.owner,
          );
          if (!nextOwner?.id) {
            return res.status(404).json({ error: "New owner user not found." });
          }
        }

        adminRun("BEGIN");
        try {
          adminRun(
            `UPDATE chats
             SET name = ?, group_username = ?, group_visibility = ?, group_color = ?, allow_member_invites = ?, created_by_user_id = COALESCE(?, created_by_user_id)
             WHERE id = ? AND type IN ('group', 'channel')`,
            [
              nextName || null,
              nextUsername || null,
              nextVisibility,
              nextColor,
              allowMemberInvites,
              nextOwner?.id ? Number(nextOwner.id) : null,
              Number(chat.id),
            ],
          );

          if (nextOwner?.id) {
            adminRun(
              "UPDATE chat_members SET role = 'member' WHERE chat_id = ? AND role = 'owner'",
              [Number(chat.id)],
            );
            adminRun(
              "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, 'owner')",
              [Number(chat.id), Number(nextOwner.id)],
            );
            adminRun(
              "UPDATE chat_members SET role = 'owner' WHERE chat_id = ? AND user_id = ?",
              [Number(chat.id), Number(nextOwner.id)],
            );
          }
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }
        adminSave();

        const updated = resolveChatRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          String(chat.id),
        );
        return res.json({
          ok: true,
          result: {
            id: Number(updated.id),
            type: updated.type,
            name: updated.name || "",
            owner: nextOwner?.username || null,
          },
        });
      }

      if (action === "edit_user") {
        const userSelector = String(payload.userSelector || "").trim();
        const user = resolveUserRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          userSelector,
        );
        if (!user?.id) {
          return res.status(404).json({ error: "User not found." });
        }

        const nextUsername =
          payload.username === undefined || payload.username === null
            ? String(user.username || "")
            : String(payload.username || "").trim().toLowerCase();
        const nextNickname =
          payload.nickname === undefined || payload.nickname === null
            ? user.nickname || null
            : String(payload.nickname || "").trim() || null;
        const nextAvatarUrl =
          payload.avatarUrl === undefined || payload.avatarUrl === null
            ? user.avatar_url || null
            : String(payload.avatarUrl || "").trim() || null;
        const nextStatus =
          payload.status === undefined || payload.status === null
            ? String(user.status || "online").toLowerCase()
            : String(payload.status || "").trim().toLowerCase();
        const nextColor =
          payload.color === undefined || payload.color === null
            ? String(user.color || "").trim() || null
            : normalizeHexColor(payload.color);

        if (nextUsername.length < 3) {
          return res.status(400).json({ error: "Username must be at least 3 characters." });
        }
        if (USERNAME_MAX && nextUsername.length > USERNAME_MAX) {
          return res.status(400).json({
            error: `Username must be at most ${USERNAME_MAX} characters.`,
          });
        }
        if (USERNAME_REGEX && !USERNAME_REGEX.test(nextUsername)) {
          return res.status(400).json({
            error: "Invalid username. Allowed: lowercase english letters, numbers, ., _",
          });
        }
        if (nextNickname && nextNickname.length > (NICKNAME_MAX || 0)) {
          return res.status(400).json({
            error: `Nickname must be at most ${NICKNAME_MAX} characters.`,
          });
        }
        if (!["online", "invisible"].includes(nextStatus)) {
          return res.status(400).json({ error: "Invalid status." });
        }
        if (payload.color !== undefined && !nextColor) {
          return res.status(400).json({ error: "Invalid color." });
        }

        if (nextUsername !== String(user.username || "").toLowerCase()) {
          const userConflict = adminGetRow("SELECT id FROM users WHERE username = ?", [
            nextUsername,
          ]);
          if (userConflict?.id) {
            return res.status(409).json({ error: "Username already exists." });
          }
          const chatConflict = adminGetRow(
            "SELECT id FROM chats WHERE type IN ('group', 'channel') AND group_username IN (?, ?)",
            [nextUsername, `@${nextUsername}`],
          );
          if (chatConflict?.id) {
            return res.status(409).json({ error: "Username already exists." });
          }
        }

        adminRun(
          `UPDATE users
           SET username = ?, nickname = ?, avatar_url = ?, color = ?, status = ?
           WHERE id = ?`,
          [
            nextUsername,
            nextNickname,
            nextAvatarUrl,
            nextColor,
            nextStatus,
            Number(user.id),
          ],
        );
        adminSave();

        const updated = resolveUserRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          String(user.id),
        );
        return res.json({
          ok: true,
          result: {
            id: Number(updated.id),
            username: updated.username,
            nickname: updated.nickname || null,
            color: updated.color || null,
          },
        });
      }

      if (action === "toggle_user_ban") {
        const userSelector = String(payload.userSelector || "").trim();
        const user = resolveUserRow(
          { getRow: adminGetRow, getAll: adminGetAll },
          userSelector,
        );
        if (!user?.id) {
          return res.status(404).json({ error: "User not found." });
        }

        const nextBanned = Number(user.banned || 0) ? 0 : 1;
        const sessionsRow = adminGetRow(
          "SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?",
          [Number(user.id)],
        );

        adminRun("BEGIN");
        try {
          adminRun("UPDATE users SET banned = ? WHERE id = ?", [
            nextBanned,
            Number(user.id),
          ]);
          adminRun("DELETE FROM sessions WHERE user_id = ?", [Number(user.id)]);
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }
        adminSave();

        if (nextBanned) {
          emitSseEvent(user.username, {
            type: "session_revoked",
            reason: "banned",
          });
        }

        return res.json({
          ok: true,
          result: {
            id: Number(user.id),
            username: user.username,
            banned: Boolean(nextBanned),
            sessionsExpired: Number(sessionsRow?.count || 0),
          },
        });
      }

      if (action === "vacuum_db") {
        adminRun("VACUUM");
        adminSave();
        return res.json({
          ok: true,
          result: { vacuumed: true },
        });
      }

      if (action === "generate_users") {
        const count = Math.max(
          1,
          Math.min(5000, Number(payload.count || 0) || 0),
        );
        const password = String(payload.password || "");
        const nicknamePrefix = String(payload.nicknamePrefix || "User");
        const usernamePrefix = String(payload.usernamePrefix || "user");
        const maxUsername = Math.max(3, Number(USERNAME_MAX || 16));
        const maxNickname = Math.max(3, Number(NICKNAME_MAX || 24));
        const maxPrefixLen = Math.max(1, maxUsername - 2);
        const clampPrefix = (value, maxLen) => {
          const trimmed = String(value || "").trim();
          if (!trimmed) return "";
          return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
        };

        if (!count || !password) {
          return res
            .status(400)
            .json({ error: "Count and password are required." });
        }

        const existingRows = adminGetAll("SELECT username FROM users");
        const existingGroups = adminGetAll(
          "SELECT group_username FROM chats WHERE type IN ('group', 'channel') AND group_username IS NOT NULL",
        );
        const usedUsernames = new Set(
          existingRows.map((row) => String(row.username || "").toLowerCase()),
        );
        existingGroups.forEach((row) => {
          const value = String(row.group_username || "").toLowerCase();
          if (value) usedUsernames.add(value);
        });
        const passwordHash = bcrypt.hashSync(password, 10);

        const randomToken = (length = 6) => {
          const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
          let output = "";
          for (let i = 0; i < length; i += 1) {
            output += chars[Math.floor(Math.random() * chars.length)];
          }
          return output;
        };

        let created = 0;
        adminRun("BEGIN");
        try {
          for (let i = 0; i < count; i += 1) {
            let username = "";
            do {
              const basePrefix = clampPrefix(usernamePrefix, maxPrefixLen);
              const safePrefix =
                basePrefix.length >= 1 ? basePrefix : clampPrefix("user", maxPrefixLen);
              const tokenBudget = Math.max(1, maxUsername - safePrefix.length - 1);
              const token = randomToken(Math.min(12, tokenBudget));
              username = `${safePrefix}_${token}`.toLowerCase().slice(0, maxUsername);
            } while (usedUsernames.has(username));
            usedUsernames.add(username);
            const rawNickname = `${nicknamePrefix} ${created + 1}`;
            const nickname =
              rawNickname.length > maxNickname
                ? rawNickname.slice(0, maxNickname)
                : rawNickname;
            const assignedColor = setUserColor ? setUserColor() : null;
            adminRun(
              "INSERT INTO users (username, nickname, avatar_url, color, status, password_hash, created_at, last_seen) VALUES (?, ?, NULL, ?, ?, ?, datetime('now'), datetime('now'))",
              [username, nickname, assignedColor, "online", passwordHash],
            );
            created += 1;
          }
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        adminSave();
        return res.json({ ok: true, result: { created } });
      }

      if (action === "generate_chat_messages") {
        const chatId = Number(payload.chatId || 0);
        const userA = String(payload.userA || "").trim();
        const userB = String(payload.userB || "").trim();
        const count = Math.max(1, Math.min(10000, Number(payload.count || 0) || 0));
        const daysBack = Math.max(1, Math.min(365, Number(payload.days || 7) || 7));

        if (!chatId || !userA || !userB || !count) {
          return res.status(400).json({
            error:
              "Usage: chatId, userA, userB, count, days are required.",
          });
        }

        const chatRow = adminGetRow("SELECT id FROM chats WHERE id = ?", [chatId]);
        if (!chatRow?.id) {
          return res.status(404).json({ error: "Chat not found." });
        }

        const resolveUserId = (raw) => {
          const numeric = Number(raw);
          if (Number.isFinite(numeric) && numeric > 0) {
            const row = adminGetRow("SELECT id FROM users WHERE id = ?", [numeric]);
            return row?.id ? Number(row.id) : null;
          }
          const row = adminGetRow("SELECT id FROM users WHERE username = ?", [
            String(raw || "").toLowerCase(),
          ]);
          return row?.id ? Number(row.id) : null;
        };

        const userAId = resolveUserId(userA);
        const userBId = resolveUserId(userB);
        if (!userAId || !userBId) {
          return res.status(404).json({ error: "One or both users not found." });
        }
        if (userAId === userBId) {
          return res.status(400).json({ error: "userA and userB must be different users." });
        }

        const sampleMessages = [
          "Hello there",
          "How are you doing?",
          "Sounds good",
          "I will check and reply",
          "Can you send details?",
          "Sure, one second",
          "Thanks",
          "Got it",
          "Let us do it",
          "Looks great",
          "See you soon",
          "On my way",
          "Please review this",
          "Done",
          "Perfect",
        ];
        const maxMessageChars = Math.max(1, Number(MESSAGE_MAX_CHARS || 4000));
        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const buildTimestampSchedule = (totalCount, days) => {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const nowSecondsOfDay =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
          const startDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          );
          startDay.setDate(startDay.getDate() - (days - 1));

          const perDay = new Array(days).fill(0);
          for (let i = 0; i < totalCount; i += 1) {
            perDay[i % days] += 1;
          }

          const stamps = [];
          for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
            const messagesInDay = perDay[dayIndex];
            if (!messagesInDay) continue;
            const dayStart = new Date(startDay);
            dayStart.setDate(startDay.getDate() + dayIndex);
            const isToday =
              dayStart.getFullYear() === today.getFullYear() &&
              dayStart.getMonth() === today.getMonth() &&
              dayStart.getDate() === today.getDate();
            const maxSecondOfDay = isToday
              ? Math.max(0, Math.min(86399, nowSecondsOfDay))
              : 86399;
            const seconds = [];
            for (let i = 0; i < messagesInDay; i += 1) {
              const secondOfDay = Math.floor(Math.random() * (maxSecondOfDay + 1));
              seconds.push(secondOfDay);
            }
            seconds.sort((a, b) => a - b);
            for (let i = 0; i < seconds.length; i += 1) {
              stamps.push(
                new Date(dayStart.getTime() + seconds[i] * 1000).toISOString(),
              );
            }
          }
          return stamps;
        };

        adminRun("BEGIN");
        try {
          adminRun(
            "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)",
            [chatId, userAId, "member"],
          );
          adminRun(
            "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)",
            [chatId, userBId, "member"],
          );

          const timestamps = buildTimestampSchedule(count, daysBack);
          for (let index = 0; index < count; index += 1) {
            const senderId = index % 2 === 0 ? userAId : userBId;
            const rawBody = `${pickRandom(sampleMessages)} #${index + 1}`;
            const body =
              rawBody.length > maxMessageChars
                ? rawBody.slice(0, maxMessageChars)
                : rawBody;
            adminRun(
              "INSERT INTO chat_messages (chat_id, user_id, body, created_at, read_at, read_by_user_id) VALUES (?, ?, ?, ?, NULL, NULL)",
              [
                chatId,
                senderId,
                storageEncryption.encryptText(body),
                timestamps[index],
              ],
            );
          }

          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        adminSave();
        return res.json({ ok: true, result: { created: count, chatId } });
      }

      if (action === "create_demo") {
        const payloadChatId = Number(payload.chatId || 0);
        const count = Number(payload.count || 15);
        const daysBack = Number(payload.daysBack || 5);
        const allowRecreate = Boolean(payload.allowRecreate);

        const userRow = adminGetRow(
          `SELECT id FROM users WHERE username = ?`,
          ["demo"],
        );

        let userId = Number(userRow?.id || 0);
        if (!userId) {
          adminRun(
            `INSERT INTO users (username, password_hash, nickname, status, color, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            ["demo", "demo", "Demo User", "online", "#10b981"],
          );
          userId = Number(
            adminGetRow("SELECT id FROM users WHERE username = ?", ["demo"])
              ?.id || 0,
          );
        }

        let chatId = payloadChatId;
        if (!chatId) {
          const row = adminGetRow(
            `SELECT id FROM chats WHERE name = ? ORDER BY id ASC LIMIT 1`,
            ["Songbird Demo"],
          );
          chatId = Number(row?.id || 0);
        }

        if (!chatId) {
          adminRun(
            `INSERT INTO chats (name, type, created_at)
             VALUES (?, ?, datetime('now'))`,
            ["Songbird Demo", "group"],
          );

          chatId = Number(
            adminGetRow("SELECT id FROM chats WHERE name = ?", [
              "Songbird Demo",
            ])?.id || 0,
          );
        }

        const memberRow = adminGetRow(
          `SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?`,
          [chatId, userId],
        );

        if (!memberRow?.id) {
          adminRun(
            `INSERT INTO chat_members (chat_id, user_id, role)
             VALUES (?, ?, ?)`,
            [chatId, userId, "owner"],
          );
        }

        if (!allowRecreate) {
          const exists = adminGetRow(
            `SELECT id FROM chat_messages WHERE chat_id = ? LIMIT 1`,
            [chatId],
          );
          if (exists?.id) {
            adminSave();
            return res.json({
              ok: true,
              result: {
                created: 0,
                chatId,
              },
            });
          }
        }

        const timestampSchedule = buildTimestampSchedule(count, daysBack);

        let created = 0;
        adminRun("BEGIN");
        try {
          timestampSchedule.forEach((stamp, index) => {
            adminRun(
              `INSERT INTO chat_messages (chat_id, user_id, body, created_at)
               VALUES (?, ?, ?, ?)`,
              [
                chatId,
                userId,
                storageEncryption.encryptText(`Demo message ${index + 1}`),
                stamp,
              ],
            );
            created += 1;
          });
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        adminSave();

        return res.json({ ok: true, result: { created, chatId } });
      }

      if (action === "inspect_db") {
        const kind = String(payload.kind || "all").toLowerCase();
        const limit = Math.max(
          1,
          Math.min(1000, Number(payload.limit || 25) || 25),
        );
        return res.json({
          ok: true,
          result: buildInspectSnapshot(kind, limit),
        });
      }

      if (action === "delete_files") {
        const selectors = Array.isArray(payload.selectors)
          ? payload.selectors
              .map((value) => String(value || "").trim())
              .filter(Boolean)
          : [];
        const deleteAll = selectors.length === 0;

        let targetMessageIds = [];
        let messageStoredNames = [];
        let targetAvatarUsers = [];
        let messageChatPairs = [];

        if (deleteAll) {
          targetMessageIds = adminGetAll(
            "SELECT DISTINCT message_id FROM chat_message_files ORDER BY message_id ASC",
          )
            .map((row) => Number(row.message_id))
            .filter((id) => Number.isFinite(id) && id > 0);

          if (targetMessageIds.length) {
            messageChatPairs = adminGetAll(
              `SELECT id, chat_id FROM chat_messages WHERE id IN (${targetMessageIds
                .map(() => "?")
                .join(", ")})`,
              targetMessageIds,
            ).map((row) => ({
              id: Number(row.id),
              chatId: Number(row.chat_id),
            }));
          }

          messageStoredNames = adminGetAll(
            "SELECT stored_name FROM chat_message_files",
          ).map((row) => row.stored_name);

          targetAvatarUsers = adminGetAll(
            `SELECT id, avatar_url
             FROM users
             WHERE avatar_url LIKE '/uploads/avatars/%'
                OR avatar_url LIKE '/api/uploads/avatars/%'`,
          );
        } else {
          const numericIds = selectors
            .map((value) => Number(value))
            .filter((id) => Number.isFinite(id) && id > 0);
          const named = selectors
            .map((value) => path.basename(value))
            .filter(Boolean);

          const byIdRows = numericIds.length
            ? adminGetAll(
                `SELECT id, message_id, stored_name FROM chat_message_files WHERE id IN (${numericIds
                  .map(() => "?")
                  .join(", ")})`,
                numericIds,
              )
            : [];

          const byNameRows = named.length
            ? adminGetAll(
                `SELECT id, message_id, stored_name FROM chat_message_files WHERE stored_name IN (${named
                  .map(() => "?")
                  .join(", ")})`,
                named,
              )
            : [];

          const fileRows = [...byIdRows, ...byNameRows];

          targetMessageIds = Array.from(
            new Set(
              fileRows
                .map((row) => Number(row.message_id))
                .filter((id) => Number.isFinite(id) && id > 0),
            ),
          );

          if (targetMessageIds.length) {
            messageChatPairs = adminGetAll(
              `SELECT id, chat_id FROM chat_messages WHERE id IN (${targetMessageIds
                .map(() => "?")
                .join(", ")})`,
              targetMessageIds,
            ).map((row) => ({
              id: Number(row.id),
              chatId: Number(row.chat_id),
            }));
            messageStoredNames = adminGetAll(
              `SELECT stored_name FROM chat_message_files WHERE message_id IN (${targetMessageIds
                .map(() => "?")
                .join(", ")})`,
              targetMessageIds,
            ).map((row) => row.stored_name);
          }

          if (named.length) {
            targetAvatarUsers = adminGetAll(
              `SELECT id, avatar_url
               FROM users
               WHERE avatar_url LIKE '/uploads/avatars/%'
                  OR avatar_url LIKE '/api/uploads/avatars/%'`,
            ).filter((row) =>
              named.includes(path.basename(String(row.avatar_url || ""))),
            );
          }
        }

        adminRun("BEGIN");
        try {
          if (targetMessageIds.length) {
            chunkArray(targetMessageIds, 500).forEach((chunk) => {
              const placeholders = chunk.map(() => "?").join(", ");

              adminRun(
                `DELETE FROM chat_message_files WHERE message_id IN (${placeholders})`,
                chunk,
              );

              adminRun(
                `DELETE FROM chat_messages WHERE id IN (${placeholders})`,
                chunk,
              );
            });
          }
          if (targetAvatarUsers.length) {
            chunkArray(
              targetAvatarUsers.map((row) => Number(row.id)).filter(Boolean),
              500,
            ).forEach((chunk) => {
              const placeholders = chunk.map(() => "?").join(", ");

              adminRun(
                `UPDATE users SET avatar_url = NULL WHERE id IN (${placeholders})`,
                chunk,
              );
            });
          }
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        removeStoredFileNames(messageStoredNames);
        const avatarNames = targetAvatarUsers.map((row) =>
          path.basename(String(row.avatar_url || "").trim()),
        );

        avatarNames.forEach((name) => {
          try {
            const filePath = path.join(avatarUploadRootDir, name);

            if (name && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (_) {
            // best effort cleanup
          }
        });

        adminSave();

        if (messageChatPairs.length) {
          const chatToMessageIds = new Map();
          messageChatPairs.forEach((pair) => {
            if (!Number.isFinite(pair.chatId) || !Number.isFinite(pair.id)) return;
            const list = chatToMessageIds.get(pair.chatId) || [];
            list.push(pair.id);
            chatToMessageIds.set(pair.chatId, list);
          });
          chatToMessageIds.forEach((messageIds, chatId) => {
            emitChatEvent(Number(chatId), {
              type: "chat_message_deleted",
              chatId: Number(chatId),
              messageIds,
            });
          });
        }

        return res.json({
          ok: true,
          result: {
            removedMessages: targetMessageIds.length,
            removedMessageFiles: messageStoredNames.length,
            removedAvatars: targetAvatarUsers.length,
          },
        });
      }

      if (action === "reset_db" || action === "delete_db") {
        adminRun("BEGIN");

        try {
          adminRun("DELETE FROM chat_message_files");
          adminRun("DELETE FROM chat_messages");
          adminRun("DELETE FROM hidden_chats");
          adminRun("DELETE FROM chat_members");
          adminRun("DELETE FROM required_channels");
          adminRun("DELETE FROM chats");
          adminRun("DELETE FROM sessions");
          adminRun("DELETE FROM users");
          adminRun("COMMIT");
        } catch (error) {
          adminRun("ROLLBACK");
          throw error;
        }

        removeAllMessageUploads();
        adminSave();

        return res.json({ ok: true, result: { cleared: true } });
      }

      return res.status(400).json({ error: "Unknown admin action." });
    } catch (error) {
      return res
        .status(500)
        .json({ error: error?.message || "Admin action failed." });
    }
  });
}

export { registerAdminRoutes };
