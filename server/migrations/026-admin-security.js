export const migration026AdminSecurity = {
  version: 26,
  up: ({ db, tableExists, hasColumn }) => {
    if (tableExists("sessions")) {
      if (!hasColumn("sessions", "ip_address")) {
        db.run("ALTER TABLE sessions ADD COLUMN ip_address TEXT");
      }
      if (!hasColumn("sessions", "user_agent")) {
        db.run("ALTER TABLE sessions ADD COLUMN user_agent TEXT");
      }
    }

    if (tableExists("admin_audit_logs")) {
      if (!hasColumn("admin_audit_logs", "ip_address")) {
        db.run("ALTER TABLE admin_audit_logs ADD COLUMN ip_address TEXT");
      }
      if (!hasColumn("admin_audit_logs", "user_agent")) {
        db.run("ALTER TABLE admin_audit_logs ADD COLUMN user_agent TEXT");
      }
      if (!hasColumn("admin_audit_logs", "success")) {
        db.run("ALTER TABLE admin_audit_logs ADD COLUMN success INTEGER NOT NULL DEFAULT 1");
      }
    }
  },
};
