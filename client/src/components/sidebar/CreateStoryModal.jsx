import { useState, useRef } from "react";
import { Close, Send } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const BACKGROUND_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ef4444",
  "#f97316", "#eab308", "#ec4899", "#06b6d4",
  "#1e293b", "#0f172a", "#7c3aed", "#059669",
];

/**
 * Create Story Modal — allows creating text, image, or video stories.
 */
export default function CreateStoryModal({ open, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("text"); // text | media
  const [body, setBody] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "";
    setMediaFile(file);
    setMediaType(mime);
    setMediaPreview(URL.createObjectURL(file));
    setMode("media");
  };

  const handleSubmit = async () => {
    if (sending) return;
    setSending(true);
    try {
      if (mode === "text") {
        if (!body.trim()) return;
        await onSubmit?.({ type: "text", body: body.trim(), backgroundColor });
      } else if (mediaFile) {
        // For media stories, we pass the file for upload
        await onSubmit?.({
          type: mediaType.startsWith("video/") ? "video" : "image",
          body: body.trim(),
          mediaFile,
          mediaType,
        });
      }
      // Reset
      setBody("");
      setMediaFile(null);
      setMediaPreview("");
      setMode("text");
      onClose?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-950 border border-slate-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {t("stories.createStory") || "Create Story"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <Close size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-slate-100 dark:border-white/10">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`flex-1 py-2 text-xs font-semibold transition ${mode === "text" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-slate-500"}`}
          >
            {t("stories.text") || "Text"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 py-2 text-xs font-semibold transition ${mode === "media" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-slate-500"}`}
          >
            {t("stories.photoVideo") || "Photo / Video"}
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === "text" ? (
            <>
              {/* Text preview */}
              <div
                className="flex min-h-[200px] items-center justify-center rounded-xl p-6 text-center"
                style={{ backgroundColor }}
              >
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("stories.writeSomething") || "Write something..."}
                  className="w-full resize-none bg-transparent text-center text-lg font-bold text-white placeholder-white/60 outline-none"
                  rows={4}
                  maxLength={500}
                />
              </div>

              {/* Color picker */}
              <div className="mt-3 flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBackgroundColor(color)}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      backgroundColor === color
                        ? "border-white shadow-lg ring-2 ring-emerald-400"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Media preview */}
              {mediaPreview ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-black">
                  {mediaType.startsWith("video/") ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="max-h-[300px] max-w-full rounded-xl"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Story preview"
                      className="max-h-[300px] max-w-full rounded-xl object-contain"
                    />
                  )}
                </div>
              ) : (
                <div
                  className="flex min-h-[200px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <p className="text-sm text-slate-400">
                    {t("stories.tapToSelect") || "Tap to select photo or video"}
                  </p>
                </div>
              )}

              {/* Caption */}
              <input
                type="text"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("stories.addCaption") || "Add a caption..."}
                className="mt-3 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                maxLength={200}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            {t("common.cancel") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || (mode === "text" && !body.trim()) || (mode === "media" && !mediaFile)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
          >
            <Send size={14} />
            {t("stories.share") || "Share"}
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
