export const migration048AnonymousAdmin = {
  version: 48,
  up: ({ db, hasColumn }) => {
    // Allow admins to send messages anonymously (as the group/channel name)
    if (!hasColumn("chat_messages", "sent_as_anonymous")) {
      db.run("ALTER TABLE chat_messages ADD COLUMN sent_as_anonymous INTEGER NOT NULL DEFAULT 0");
    }
    // Per-group setting: allow anonymous posting by admins
    if (!hasColumn("chats", "allow_anonymous_admin")) {
      db.run("ALTER TABLE chats ADD COLUMN allow_anonymous_admin INTEGER NOT NULL DEFAULT 0");
    }
  },
};
