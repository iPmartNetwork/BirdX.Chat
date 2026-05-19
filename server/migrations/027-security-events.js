export const migration027SecurityEvents = {
  version: 27,
  up: ({ db }) => {
    db.run(`
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

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_security_events_created_at
      ON security_events(created_at)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_security_events_type
      ON security_events(type)
    `);
  },
};
