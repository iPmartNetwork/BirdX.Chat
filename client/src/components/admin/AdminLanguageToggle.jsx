import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function AdminLanguageToggle({ className = "" }) {
  const { t, language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <div
      className={`inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-[10px] font-semibold dark:border-white/10 dark:bg-slate-950 sm:text-xs ${className}`}
      role="group"
      aria-label={t("settings.language")}
    >
      {supportedLanguages.map((item) => {
        const active = language === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLanguage(item.code)}
            className={`rounded-full px-2.5 py-1 transition sm:px-3 ${
              active
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                : "text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-200"
            }`}
            aria-pressed={active}
          >
            {item.code === "fa" ? "فا" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
