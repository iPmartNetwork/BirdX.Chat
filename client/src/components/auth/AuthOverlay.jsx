import { LoaderCircle } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function AuthOverlay({ isLogin, show }) {
  const { t } = useLanguage();
  if (!show || !isLogin) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/88 backdrop-blur-sm dark:bg-slate-950/88">
      <LoaderCircle className="h-12 w-12 animate-spin text-emerald-500" />
      <p className="text-sm font-semibold text-slate-900 dark:text-emerald-100">
        {t("auth.signingIn")}
      </p>
    </div>
  );
}
