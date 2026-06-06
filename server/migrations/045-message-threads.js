export const migration045MessageThreads = {
  version: 45,
  up: ({ db, hasColumn }) => {
    // thread_root_id: if set, this message belongs to a thread under that root message
    if (!hasColumn("chat_messages", "thread_root_id")) {
      db.run("ALTER TABLE chat_messages ADD COLUMN thread_root_id INTEGER");
    }
    // thread_reply_count: cached count of replies in this thread (only on root messages)
    if (!hasColumn("chat_messages", "thread_reply_count")) {
      db.run("ALTER TABLE chat_messages ADD COLUMN thread_reply_count INTEGER NOT NULL DEFAULT 0");
    }
    // thread_last_reply_at: timestamp of last reply (for sorting threads)
    if (!hasColumn("chat_messages", "thread_last_reply_at")) {
      db.run("ALTER TABLE chat_messages ADD COLUMN thread_last_reply_at TEXT");
    }
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_messages_thread_root ON chat_messages(thread_root_id) WHERE thread_root_id IS NOT NULL",
    );
  },
};
