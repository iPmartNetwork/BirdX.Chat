export const migration033DmPrivacy = {
  version: 33,
  up: ({ db, hasColumn }) => {
    if (!hasColumn("users", "dm_policy")) {
      db.run(`
        ALTER TABLE users
        ADD COLUMN dm_policy TEXT NOT NULL DEFAULT 'acquaintances'
      `);
    }

    if (!hasColumn("chats", "dm_status")) {
      db.run(`
        ALTER TABLE chats
        ADD COLUMN dm_status TEXT NOT NULL DEFAULT 'active'
      `);
    }

    if (!hasColumn("chats", "dm_initiator_user_id")) {
      db.run(`
        ALTER TABLE chats
        ADD COLUMN dm_initiator_user_id INTEGER
      `);
    }

    if (!hasColumn("chats", "dm_resolved_at")) {
      db.run(`
        ALTER TABLE chats
        ADD COLUMN dm_resolved_at TEXT
      `);
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        blocker_user_id INTEGER NOT NULL,
        blocked_user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (blocker_user_id, blocked_user_id),
        FOREIGN KEY (blocker_user_id) REFERENCES users (id),
        FOREIGN KEY (blocked_user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
      ON user_blocks(blocked_user_id)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS dm_rejections (
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (from_user_id, to_user_id),
        FOREIGN KEY (from_user_id) REFERENCES users (id),
        FOREIGN KEY (to_user_id) REFERENCES users (id)
      )
    `);
  },
};
