export const migration047ChatFolders = {
  version: 47,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_folder_items (
        folder_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        PRIMARY KEY (folder_id, chat_id),
        FOREIGN KEY (folder_id) REFERENCES chat_folders(id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_chat_folders_user ON chat_folders(user_id)",
    );
  },
};
