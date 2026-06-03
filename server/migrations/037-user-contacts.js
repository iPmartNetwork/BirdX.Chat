export const migration037UserContacts = {
  version: 37,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS contact_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT,
        UNIQUE(from_user_id, to_user_id),
        CHECK(from_user_id != to_user_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS user_contacts (
        user_id INTEGER NOT NULL,
        contact_user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, contact_user_id),
        CHECK(user_id != contact_user_id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_contact_requests_to_status
      ON contact_requests(to_user_id, status)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_contact_requests_from_status
      ON contact_requests(from_user_id, status)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_contacts_user
      ON user_contacts(user_id)
    `);
  },
};
