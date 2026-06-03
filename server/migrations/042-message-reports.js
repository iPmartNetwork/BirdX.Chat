export const migration042MessageReports = {
  version: 42,
  up: ({ db, tableExists }) => {
    if (tableExists("message_reports")) return;
    db.run(`
      CREATE TABLE message_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        reporter_user_id INTEGER NOT NULL,
        reason TEXT NOT NULL DEFAULT 'other',
        details TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by_user_id INTEGER,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_message_reports_status
      ON message_reports(status, created_at)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_message_reports_message
      ON message_reports(message_id)
    `);
  },
};
