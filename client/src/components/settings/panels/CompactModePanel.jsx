import { useState, useEffect } from "react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

const COMPACT_MODE_KEY = "birdx-compact-mode";

/**
 * Compact Mode Settings Panel — toggle between normal and compact message display.
 * Compact mode: smaller avatars, less spacing, inline names.
 */
export default function CompactModePanel() {
  const { t } = useLanguage();
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COMPACT_MODE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COMPACT_MODE_KEY, compact ? "1" : "0");
    // Toggle class on body for CSS-based compact mode
    document.body.classList.toggle("compact-mode", compact);
  }, [compact]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white">
        {t("settings.compactMode") || "Compact Mode"}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t("settings.compactModeHint") || "Reduce spacing and avatar sizes to show more messages at once."}
      </p>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={compact}
          onChange={(e) => setCompact(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          {t("settings.enableCompactMode") || "Enable compact mode"}
        </span>
      </label>

      {/* Preview */}
      <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
        <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">Preview</p>
        <div className={`space-y-${compact ? "1" : "3"}`}>
          <div className="flex items-start gap-2">
            <div className={`shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold ${compact ? "h-5 w-5 text-[9px]" : "h-8 w-8"}`}>
              A
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Ali</span>
              {compact ? <span className="ml-1 text-[10px] text-slate-400">10:30</span> : null}
              <p className={`text-slate-600 dark:text-slate-300 ${compact ? "text-xs" : "text-sm mt-0.5"}`}>
                سلام! چطوری؟
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className={`shrink-0 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold ${compact ? "h-5 w-5 text-[9px]" : "h-8 w-8"}`}>
              B
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Behzad</span>
              {compact ? <span className="ml-1 text-[10px] text-slate-400">10:31</span> : null}
              <p className={`text-slate-600 dark:text-slate-300 ${compact ? "text-xs" : "text-sm mt-0.5"}`}>
                خوبم ممنون 🙏
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to read compact mode state.
 */
export function useCompactMode() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COMPACT_MODE_KEY) === "1";
}
