export const migration041UserTotp = {
  version: 41,
  up: ({ db, tableExists }) => {
    if (tableExists("user_totp")) return;
    db.run(`
      CREATE TABLE user_totp (
        user_id INTEGER PRIMARY KEY,
        secret TEXT NOT NULL,
        backup_codes TEXT DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },
};
