import logo from "../../assets/birdx-logo.svg";
import { Moon, Sun } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function AuthHeader({
  isLogin,
  isDark,
  themeToggleAnimating,
  onToggleTheme,
}) {
  const { t, language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <div className="relative text-center">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2">
        <div
          className="inline-flex rounded-full border border-emerald-200/80 bg-white/90 p-0.5 text-[10px] font-semibold dark:border-emerald-500/25 dark:bg-slate-950/80 sm:text-xs"
          role="group"
          aria-label={t("auth.language")}
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

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/80 bg-white/90 text-emerald-700 transition hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-slate-950/80 dark:text-emerald-200 sm:h-9 sm:w-9"
          aria-label={t("auth.toggleTheme")}
        >
          {isDark ? (
            <Sun
              key="theme-sun"
              size={18}
              className={`icon-anim-spin-dir ${
                themeToggleAnimating ? "icon-theme-enter-sun" : ""
              }`}
            />
          ) : (
            <Moon
              key="theme-moon"
              size={18}
              className={`icon-anim-spin-left ${
                themeToggleAnimating ? "icon-theme-enter-moon" : ""
              }`}
            />
          )}
        </button>
      </div>

      <div className="mx-auto mt-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white shadow-lg shadow-emerald-500/15 dark:border-emerald-500/20 dark:from-emerald-950/60 dark:to-slate-900 sm:mt-11 sm:h-16 sm:w-16">
        <img src={logo} alt="" className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden />
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-300 sm:text-xs">
        {t("auth.brand")}
      </p>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {isLogin ? t("auth.welcome") : t("auth.joinTitle")}
      </h1>

      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
        {isLogin ? t("auth.subtitle") : t("auth.joinSubtitle")}
      </p>
    </div>
  );
}
