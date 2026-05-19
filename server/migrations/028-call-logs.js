export const migration028CallLogs = {
  version: 28,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        room_id TEXT NOT NULL,
        call_type TEXT NOT NULL DEFAULT 'voice',
        status TEXT NOT NULL DEFAULT 'ringing',
        caller_user_id INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
        ended_at DATETIME,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        end_reason TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS call_log_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_log_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'participant',
        status TEXT NOT NULL DEFAULT 'invited',
        joined_at DATETIME,
        left_at DATETIME,
        UNIQUE(call_log_id, user_id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_call_logs_chat_started
      ON call_logs(chat_id, started_at)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_call_logs_room_status
      ON call_logs(room_id, status)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_call_log_participants_call
      ON call_log_participants(call_log_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_call_log_participants_user
      ON call_log_participants(user_id)
    `);
  },
};
