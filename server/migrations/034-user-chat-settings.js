export const migration034UserChatSettings = {
  version: 34,
  up: ({ db, tableExists, hasColumn }) => {
    if (!tableExists("users") || !tableExists("chats")) return;

    db.run(`
      CREATE TABLE IF NOT EXISTS user_chat_settings (
        user_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        pinned_at TEXT,
        archived_at TEXT,
        mute_until TEXT,
        notify_mode TEXT NOT NULL DEFAULT 'all',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, chat_id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      )
    `);

    db.run(
      "CREATE INDEX IF NOT EXISTS idx_user_chat_settings_user_pinned ON user_chat_settings(user_id, pinned_at)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_user_chat_settings_user_archived ON user_chat_settings(user_id, archived_at)",
    );

    if (tableExists("chat_mutes") && tableExists("user_chat_settings")) {
      db.run(`
        INSERT OR IGNORE INTO user_chat_settings (user_id, chat_id, mute_until, updated_at)
        SELECT user_id, chat_id, NULL, datetime('now')
        FROM chat_mutes
        WHERE muted = 1
      `);
    }

    if (tableExists("scheduled_messages")) return;

    db.run(`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT,
        FOREIGN KEY (chat_id) REFERENCES chats (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status, scheduled_at)",
    );
  },
};
