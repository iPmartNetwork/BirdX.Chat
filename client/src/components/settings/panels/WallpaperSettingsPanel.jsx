import { useState } from "react";
import { Check } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

const PRESET_WALLPAPERS = [
  { id: "none", label: "Default", value: "", preview: "bg-white dark:bg-slate-950" },
  { id: "gradient-1", label: "Ocean", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", preview: "bg-gradient-to-br from-indigo-400 to-purple-500" },
  { id: "gradient-2", label: "Sunset", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", preview: "bg-gradient-to-br from-pink-300 to-rose-500" },
  { id: "gradient-3", label: "Forest", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", preview: "bg-gradient-to-br from-sky-400 to-cyan-300" },
  { id: "gradient-4", label: "Night", value: "linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 100%)", preview: "bg-gradient-to-br from-slate-900 to-indigo-950" },
  { id: "gradient-5", label: "Mint", value: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)", preview: "bg-gradient-to-br from-lime-200 to-emerald-300" },
  { id: "gradient-6", label: "Warm", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", preview: "bg-gradient-to-br from-orange-100 to-orange-300" },
  { id: "pattern-1", label: "Dots", value: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)", preview: "bg-slate-50 dark:bg-slate-900" },
];

/**
 * Wallpaper Settings Panel — choose chat background wallpaper.
 */
export default function WallpaperSettingsPanel({ currentWallpaper, onSelect }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(currentWallpaper || "");

  const handleSelect = (wallpaper) => {
    setSelected(wallpaper.value);
    onSelect?.(wallpaper.value);
    // Save to localStorage
    if (typeof window !== "undefined") {
      window.localStorage.setItem("birdx-chat-wallpaper", wallpaper.value);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white">
        {t("settings.wallpaper") || "Chat Wallpaper"}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t("settings.wallpaperHint") || "Choose a background for your chat conversations."}
      </p>
      <div className="grid grid-cols-4 gap-3">
        {PRESET_WALLPAPERS.map((wp) => (
          <button
            key={wp.id}
            type="button"
            onClick={() => handleSelect(wp)}
            className={`relative h-20 w-full overflow-hidden rounded-xl border-2 transition ${
              selected === wp.value
                ? "border-emerald-500 ring-2 ring-emerald-200"
                : "border-slate-200 dark:border-white/10"
            } ${wp.preview}`}
            aria-label={wp.label}
          >
            {selected === wp.value ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Check size={16} className="text-white" />
              </div>
            ) : null}
            <span className="absolute bottom-1 left-1 text-[9px] font-medium text-white drop-shadow">
              {wp.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
