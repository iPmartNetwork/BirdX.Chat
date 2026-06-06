export const migration049ChatWallpaper = {
  version: 49,
  up: ({ db, hasColumn }) => {
    // Per-user chat wallpaper settings
    if (!hasColumn("user_chat_settings", "wallpaper_url")) {
      db.run("ALTER TABLE user_chat_settings ADD COLUMN wallpaper_url TEXT");
    }
    // Global wallpaper preference
    if (!hasColumn("users", "chat_wallpaper")) {
      db.run("ALTER TABLE users ADD COLUMN chat_wallpaper TEXT");
    }
  },
};
