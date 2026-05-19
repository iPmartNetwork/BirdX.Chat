export const migration030RequiredChannels = {
  version: 30,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS required_channels (
        chat_id INTEGER PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      )
    `);

    db.run(
      "CREATE INDEX IF NOT EXISTS idx_required_channels_enabled ON required_channels(enabled)",
    );
  },
};
