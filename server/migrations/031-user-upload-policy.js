export const migration031UserUploadPolicy = {
  version: 31,
  up: ({ db, tableExists, hasColumn }) => {
    if (!tableExists("users")) return;

    if (!hasColumn("users", "file_upload_disabled")) {
      db.run("ALTER TABLE users ADD COLUMN file_upload_disabled INTEGER DEFAULT 0");
    }

    if (!hasColumn("users", "file_upload_max_size_bytes")) {
      db.run("ALTER TABLE users ADD COLUMN file_upload_max_size_bytes INTEGER DEFAULT NULL");
    }
  },
};
