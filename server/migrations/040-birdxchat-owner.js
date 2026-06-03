export const migration040BirdxchatOwner = {
  version: 40,
  up: ({ db, tableExists, hasColumn }) => {
    if (!tableExists("users") || !hasColumn("users", "role")) return;
    db.run(
      `UPDATE users
       SET role = 'owner', banned = 0
       WHERE lower(username) = 'birdxchat'
         AND lower(trim(COALESCE(role, 'user'))) = 'user'`,
    );
  },
};
