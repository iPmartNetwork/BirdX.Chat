export const migration038ContactRequestPolicy = {
  version: 38,
  up: ({ db, tableExists, hasColumn }) => {
    if (!tableExists("users")) return;
    if (!hasColumn("users", "contact_request_policy")) {
      db.run(
        "ALTER TABLE users ADD COLUMN contact_request_policy TEXT NOT NULL DEFAULT 'everyone'",
      );
    }
  },
};
