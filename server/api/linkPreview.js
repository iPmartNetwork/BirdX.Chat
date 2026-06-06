import { fetchLinkPreview } from "../lib/linkPreview.js";

function registerLinkPreviewRoutes(app, deps) {
  const { requireSession } = deps;

  // Cache previews in memory (simple LRU-like map)
  const previewCache = new Map();
  const CACHE_MAX = 500;
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  app.get("/api/link-preview", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const url = req.query.url?.toString()?.trim();
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ error: "Valid URL is required." });
    }

    // Check cache
    const cached = previewCache.get(url);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json({ ok: true, preview: cached.data });
    }

    try {
      const preview = await fetchLinkPreview(url);
      if (!preview) {
        return res.json({ ok: true, preview: null });
      }

      // Cache it
      if (previewCache.size >= CACHE_MAX) {
        const oldestKey = previewCache.keys().next().value;
        previewCache.delete(oldestKey);
      }
      previewCache.set(url, { data: preview, fetchedAt: Date.now() });

      return res.json({ ok: true, preview });
    } catch {
      return res.json({ ok: true, preview: null });
    }
  });
}

export { registerLinkPreviewRoutes };
