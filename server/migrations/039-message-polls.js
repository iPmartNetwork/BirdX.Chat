export const migration039MessagePolls = {
  version: 39,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS message_polls (
        message_id INTEGER PRIMARY KEY,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        multiple INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS message_poll_votes (
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        option_index INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (message_id, user_id, option_index)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_poll_votes_message
      ON message_poll_votes(message_id)
    `);
  },
};
