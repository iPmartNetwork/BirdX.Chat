import { useEffect, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { updateProfileUiPrefs } from "../../../api/chatApi.js";
import { applyAccentTheme, previewAccentTheme } from "../../../utils/accentTheme.js";

const PRESET_ACCENTS = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

export function ThemeSettingsPanel({ user, onUserUpdate, onClose, variant = "desktop" }) {
  const { t } = useLanguage();
  const [accent, setAccent] = useState(user?.uiAccentColor || "#10b981");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const isMobile = variant === "mobile";

  useEffect(() => {
    setAccent(user?.uiAccentColor || "#10b981");
    applyAccentTheme(user?.uiAccentColor);
  }, [user?.uiAccentColor]);

  const previewAccent = (value) => {
    previewAccentTheme(value);
  };

  const handleSave = async () => {
    if (!user?.username) return;
    setBusy(true);
    setStatus("");
    try {
      const data = await updateProfileUiPrefs({
        username: user.username,
        uiAccentColor: accent,
      });
      const saved = data?.uiAccentColor || accent;
      applyAccentTheme(saved, "#10b981", { persist: true });
      onUserUpdate?.({
        ...user,
        uiAccentColor: saved,
      });
      setStatus(t("settings.theme.saved"));
    } catch (error) {
      applyAccentTheme(user?.uiAccentColor, "#10b981", { persist: true });
      setAccent(user?.uiAccentColor || "#10b981");
      setStatus(error?.message || t("settings.theme.error"));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!user?.username) return;
    setBusy(true);
    setStatus("");
    try {
      const data = await updateProfileUiPrefs({
        username: user.username,
        uiAccentColor: null,
      });
      setAccent("#10b981");
      applyAccentTheme(null);
      onUserUpdate?.({ ...user, uiAccentColor: data?.uiAccentColor || null });
      setStatus(t("settings.theme.reset"));
    } catch (error) {
      setStatus(error?.message || t("settings.theme.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={isMobile ? "space-y-4" : "space-y-5"}>
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {t("settings.theme.title")}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("settings.theme.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESET_ACCENTS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => {
              setAccent(color);
              previewAccent(color);
            }}
            className={`h-10 w-10 rounded-full border-2 transition ${
              accent === color
                ? "border-slate-900 dark:border-white"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t("settings.theme.custom")}
        <input
          type="color"
          value={accent || "#10b981"}
          onChange={(event) => {
            setAccent(event.target.value);
            previewAccent(event.target.value);
          }}
          className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-950"
        />
      </label>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t("settings.theme.previewHint")}
      </p>

      {status ? (
        <p
          className={`text-sm font-medium ${
            status === t("settings.theme.saved") || status === t("settings.theme.reset")
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-rose-600 dark:text-rose-300"
          }`}
        >
          {status}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {t("settings.theme.save")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleReset()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-white/10"
        >
          {t("settings.theme.resetButton")}
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-white/10"
          >
            {t("settings.close")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
