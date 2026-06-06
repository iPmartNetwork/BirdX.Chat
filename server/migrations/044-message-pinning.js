export const migration044MessagePinning = {
  version: 44,
  up: ({ db, hasColumn }) => {
    if (!hasColumn("chat_messages", "pinned_at")) {
      db.run("ALTER TABLE chat_messages ADD COLUMN pinned_at TEXT");
    }
    if (!hasColumn("chat_messages", "pinned_by_user_id")) {
      db.run("ALTER TABLE chat_messages ADD COLUMN pinned_by_user_id INTEGER");
    }
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_pinned_messages ON chat_messages(chat_id, pinned_at) WHERE pinned_at IS NOT NULL",
    );
  },
};
