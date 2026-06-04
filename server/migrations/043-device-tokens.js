export const migration043DeviceTokens = {
  version: 43,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL DEFAULT 'android',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)",
    );
  },
};
