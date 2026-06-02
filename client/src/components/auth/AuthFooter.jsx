import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function AuthFooter({ isLogin, canSignup, onSwitchMode }) {
  const { t } = useLanguage();
  if (!canSignup) return null;

  return (
    <div className="mt-5 space-y-2 rounded-2xl border border-emerald-100/80 bg-emerald-50/60 p-3.5 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-100 sm:mt-6 sm:space-y-3 sm:p-4 sm:text-sm">
      <p className="font-semibold">
        {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}
      </p>
      <button
        type="button"
        onClick={onSwitchMode}
        className="mt-2 w-full rounded-2xl border border-emerald-300/80 bg-white/90 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-500/15 dark:border-emerald-500/40 dark:bg-slate-900/70 dark:text-emerald-100 sm:px-4 sm:text-sm"
      >
        {isLogin ? t("auth.createNewAccount") : t("auth.backToSignIn")}
      </button>
    </div>
  );
}
