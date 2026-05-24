import { Check, Globe } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

export function LanguageSettingsPanel({ onClose, variant = "desktop" }) {
  const {
    currentLanguage,
    language,
    setLanguage,
    supportedLanguages,
    t,
  } = useLanguage();
  const isMobile = variant === "mobile";

  return (
    <div
      className={`${isMobile ? "space-y-3 text-xs" : "space-y-4 text-sm"} text-slate-600 dark:text-slate-300`}
    >
      <div className="rounded-2xl border border-indigo-200/70 bg-white/90 p-4 dark:border-indigo-500/30 dark:bg-slate-900/50">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
            <Globe size={18} className="icon-anim-sway" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-indigo-700 dark:text-indigo-200">
              {t("settings.language.current")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {currentLanguage.nativeName} /{" "}
              {currentLanguage.dir === "rtl"
                ? t("settings.language.rtl")
                : t("settings.language.ltr")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
          {t("settings.language.interface")}
        </p>
        {supportedLanguages.map((item) => {
          const active = item.code === language;
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => setLanguage(item.code)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start transition ${
                active
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400/70 dark:bg-indigo-500/15 dark:text-indigo-100"
                  : "border-indigo-200/70 bg-white/90 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-indigo-500/10"
              }`}
              lang={item.htmlLang}
              dir={item.dir}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {item.code === "fa"
                    ? t("settings.language.persian")
                    : t("settings.language.english")}
                </span>
                <span className="mt-0.5 block text-xs opacity-75">
                  {item.nativeName} /{" "}
                  {item.dir === "rtl"
                    ? t("settings.language.rtl")
                    : t("settings.language.ltr")}
                </span>
              </span>
              {active ? <Check size={17} className="shrink-0" /> : null}
            </button>
          );
        })}
      </div>

      <p className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-400">
        {t("settings.language.saved")} / {t("settings.language.note")}
      </p>

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
        >
          {t("settings.done")}
        </button>
      </div>
    </div>
  );
}
