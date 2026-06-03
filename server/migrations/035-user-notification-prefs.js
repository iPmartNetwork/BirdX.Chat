export const migration035UserNotificationPrefs = {
  version: 35,
  up: ({ db, tableExists, hasColumn }) => {
    if (!tableExists("users")) return;

    if (!hasColumn("users", "dnd_until")) {
      db.run("ALTER TABLE users ADD COLUMN dnd_until TEXT");
    }
    if (!hasColumn("users", "notifications_paused")) {
      db.run(
        "ALTER TABLE users ADD COLUMN notifications_paused INTEGER NOT NULL DEFAULT 0",
      );
    }
  },
};
