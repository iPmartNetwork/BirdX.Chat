function registerChatFolderRoutes(app, deps) {
  const { requireSession, adminGetAll, adminRun, adminSave, adminGetRow } = deps;

  app.get("/api/folders", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const folders = adminGetAll(
      "SELECT id, name, icon, sort_order, created_at FROM chat_folders WHERE user_id = ? ORDER BY sort_order ASC, id ASC",
      [session.id],
    );
    const result = folders.map((f) => {
      const items = adminGetAll("SELECT chat_id FROM chat_folder_items WHERE folder_id = ?", [f.id]);
      return { ...f, chatIds: items.map((i) => Number(i.chat_id)) };
    });
    return res.json({ ok: true, folders: result });
  });

  app.post("/api/folders", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const { name, icon, chatIds } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Name is required." });
    adminRun(
      "INSERT INTO chat_folders (user_id, name, icon, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM chat_folders WHERE user_id = ?))",
      [session.id, name.trim(), icon || null, session.id],
    );
    const folder = adminGetRow("SELECT id FROM chat_folders WHERE user_id = ? ORDER BY id DESC LIMIT 1", [session.id]);
    if (folder?.id && Array.isArray(chatIds)) {
      chatIds.forEach((chatId) => {
        adminRun("INSERT OR IGNORE INTO chat_folder_items (folder_id, chat_id) VALUES (?, ?)", [folder.id, Number(chatId)]);
      });
    }
    adminSave();
    return res.json({ ok: true, folderId: folder?.id });
  });

  app.patch("/api/folders/:id", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const folderId = Number(req.params.id || 0);
    const { name, icon, chatIds } = req.body || {};
    if (!folderId) return res.status(400).json({ error: "Folder id required." });
    const existing = adminGetRow("SELECT id FROM chat_folders WHERE id = ? AND user_id = ?", [folderId, session.id]);
    if (!existing) return res.status(404).json({ error: "Folder not found." });
    if (name) adminRun("UPDATE chat_folders SET name = ? WHERE id = ?", [name.trim(), folderId]);
    if (icon !== undefined) adminRun("UPDATE chat_folders SET icon = ? WHERE id = ?", [icon || null, folderId]);
    if (Array.isArray(chatIds)) {
      adminRun("DELETE FROM chat_folder_items WHERE folder_id = ?", [folderId]);
      chatIds.forEach((chatId) => {
        adminRun("INSERT OR IGNORE INTO chat_folder_items (folder_id, chat_id) VALUES (?, ?)", [folderId, Number(chatId)]);
      });
    }
    adminSave();
    return res.json({ ok: true });
  });

  app.delete("/api/folders/:id", (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const folderId = Number(req.params.id || 0);
    adminRun("DELETE FROM chat_folder_items WHERE folder_id = ?", [folderId]);
    adminRun("DELETE FROM chat_folders WHERE id = ? AND user_id = ?", [folderId, session.id]);
    adminSave();
    return res.json({ ok: true });
  });
}

export { registerChatFolderRoutes };
