/**
 * v2: admin 2FA step-up, user accent theme, group E2EE keys, optional SFU config key.
 */
export const migration036V2Platform = {
  version: 36,
  up: ({ db, hasColumn, tableExists }) => {
    if (!hasColumn("sessions", "admin_2fa_verified_at")) {
      db.run("ALTER TABLE sessions ADD COLUMN admin_2fa_verified_at TEXT");
    }
    if (!hasColumn("users", "ui_accent_color")) {
      db.run("ALTER TABLE users ADD COLUMN ui_accent_color TEXT");
    }
    if (!hasColumn("chats", "group_e2ee_enabled")) {
      db.run("ALTER TABLE chats ADD COLUMN group_e2ee_enabled INTEGER NOT NULL DEFAULT 0");
    }
    if (!tableExists("group_e2ee_keys")) {
      db.run(`
        CREATE TABLE IF NOT EXISTS group_e2ee_keys (
          chat_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          wrapped_key TEXT NOT NULL,
          key_generation INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (chat_id, user_id),
          FOREIGN KEY (chat_id) REFERENCES chats (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_group_e2ee_keys_chat ON group_e2ee_keys(chat_id)",
      );
    }
  },
};
