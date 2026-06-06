export const migration046Stories = {
  version: 46,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        body TEXT,
        media_url TEXT,
        media_type TEXT,
        background_color TEXT,
        font_style TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 86400,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL DEFAULT (datetime('now', '+1 day')),
        view_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS story_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        viewer_user_id INTEGER NOT NULL,
        viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(story_id, viewer_user_id),
        FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
        FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, created_at DESC)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id)",
    );
  },
};
