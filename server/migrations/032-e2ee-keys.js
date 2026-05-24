/**
 * Migration 032: End-to-End Encryption key storage
 *
 * Stores user identity keys, signed prekeys, and one-time prekeys
 * for the X3DH key agreement protocol.
 */
export const migration032E2eeKeys = {
  version: 32,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS e2ee_identity_keys (
        user_id INTEGER PRIMARY KEY,
        public_key TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS e2ee_signed_prekeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_id INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        signature TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_e2ee_signed_prekeys_user
      ON e2ee_signed_prekeys(user_id)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS e2ee_one_time_prekeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        key_id INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_e2ee_one_time_prekeys_user
      ON e2ee_one_time_prekeys(user_id, used)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS e2ee_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        peer_user_id INTEGER NOT NULL,
        session_data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (peer_user_id) REFERENCES users (id),
        UNIQUE(user_id, peer_user_id)
      )
    `);
  },
};
