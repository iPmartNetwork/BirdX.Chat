function registerStoryRoutes(app, deps) {
  const {
    requireSession,
    createStory,
    listActiveStories,
    getStoriesByUser,
    viewStory,
    getStoryViewers,
    deleteStory,
    findUserByUsername,
    emitSseEvent,
  } = deps;

  // List all active (non-expired) stories
  app.get("/api/stories", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const stories = listActiveStories(session.id);
    // Group by user
    const grouped = {};
    stories.forEach((story) => {
      const uid = Number(story.user_id);
      if (!grouped[uid]) {
        grouped[uid] = {
          userId: uid,
          username: story.username,
          nickname: story.nickname,
          avatarUrl: story.avatar_url,
          color: story.color,
          stories: [],
        };
      }
      grouped[uid].stories.push({
        id: Number(story.id),
        type: story.type,
        body: story.body,
        mediaUrl: story.media_url,
        mediaType: story.media_type,
        backgroundColor: story.background_color,
        fontStyle: story.font_style,
        createdAt: story.created_at,
        expiresAt: story.expires_at,
        viewCount: Number(story.view_count || 0),
        viewed: Boolean(story.viewed),
      });
    });
    return res.json({ ok: true, users: Object.values(grouped) });
  });

  // Get stories by a specific user
  app.get("/api/stories/user/:username", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const username = String(req.params.username || "").toLowerCase();
    if (!username) return res.status(400).json({ error: "Username is required." });
    const user = findUserByUsername(username);
    if (!user) return res.status(404).json({ error: "User not found." });
    const stories = getStoriesByUser(user.id);
    return res.json({ ok: true, stories });
  });

  // Create a new story
  app.post("/api/stories", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const { type, body, mediaUrl, mediaType, backgroundColor, fontStyle, durationSeconds } = req.body || {};
    const storyId = createStory(session.id, {
      type: type || "text",
      body,
      mediaUrl,
      mediaType,
      backgroundColor,
      fontStyle,
      durationSeconds,
    });
    if (!storyId) {
      return res.status(500).json({ error: "Failed to create story." });
    }
    return res.json({ ok: true, storyId });
  });

  // Mark story as viewed
  app.post("/api/stories/:id/view", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const storyId = Number(req.params.id || 0);
    if (!storyId) return res.status(400).json({ error: "Story id is required." });
    viewStory(storyId, session.id);
    return res.json({ ok: true });
  });

  // Get viewers of own story
  app.get("/api/stories/:id/viewers", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const storyId = Number(req.params.id || 0);
    if (!storyId) return res.status(400).json({ error: "Story id is required." });
    const viewers = getStoryViewers(storyId);
    return res.json({ ok: true, viewers });
  });

  // Delete own story
  app.delete("/api/stories/:id", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const storyId = Number(req.params.id || 0);
    if (!storyId) return res.status(400).json({ error: "Story id is required." });
    deleteStory(storyId, session.id);
    return res.json({ ok: true });
  });
}

export { registerStoryRoutes };
