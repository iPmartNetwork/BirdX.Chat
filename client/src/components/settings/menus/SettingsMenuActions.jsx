import {
  Bell,
  Bookmark,
  Database,
  Globe,
  Info,
  LogOut,
  Rocket,
  ShieldCheck,
  User,
} from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { ThemeButton } from "../common/ThemeButton.jsx";

export function SettingsMenuActions({
  variant = "popover",
  setSettingsPanel,
  isDark,
  toggleTheme,
  setIsDark,
  handleLogout,
  _notificationsOn,
  _notificationsDisabled,
  _notificationStatusLabel,
  _onToggleNotifications,
  onOpenNotifications,
  onOpenSavedMessages,
  onOpenAdmin,
  showAdminPanel = false,
  onOpenWhatsNew,
}) {
  const { t } = useLanguage();
  const isMobile = variant === "mobile";
  const buttonBase = isMobile
    ? "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-start text-base font-medium"
    : "flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-start text-sm";
  const accentHover =
    "text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 hover:shadow-[0_0_18px_rgba(59,130,246,0.22)] dark:text-blue-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10";

  return (
    <>
      <button
        type="button"
        onClick={() => setSettingsPanel("profile")}
        className={`${buttonBase} ${accentHover}`}
      >
        <User size={18} className="icon-anim-sway" />
        {t("settings.profile")}
      </button>
      <button
        type="button"
        onClick={() => setSettingsPanel("security")}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <ShieldCheck size={18} className="icon-anim-sway" />
        {t("settings.security")}
      </button>
      <button
        type="button"
        onClick={() => setSettingsPanel("data")}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <Database size={18} className="icon-anim-sway" />
        {t("settings.data")}
      </button>
      <button
        type="button"
        onClick={() => setSettingsPanel("language")}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <Globe size={18} className="icon-anim-sway" />
        {t("settings.language")}
      </button>
      <button
        type="button"
        onClick={() => onOpenSavedMessages?.()}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <Bookmark size={18} className="icon-anim-sway" />
        {t("settings.savedMessages")}
      </button>
      <button
        type="button"
        onClick={onOpenNotifications}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <Bell size={18} className="icon-anim-sway" />
        {t("settings.notifications")}
      </button>
      {showAdminPanel ? (
        <button
          type="button"
          onClick={() => onOpenAdmin?.()}
          className={`mt-1 ${buttonBase} ${accentHover}`}
        >
          <ShieldCheck size={18} className="icon-anim-sway" />
          {t("settings.adminPanel")}
        </button>
      ) : null}
      <ThemeButton
        isDark={isDark}
        toggleTheme={toggleTheme}
        setIsDark={setIsDark}
        thick={isMobile}
      />
      <button
        type="button"
        onClick={() => onOpenWhatsNew?.()}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <Rocket size={18} className="icon-anim-sway" />
        {t("settings.whatsNew")}
      </button>
      <button
        type="button"
        onClick={() => setSettingsPanel("about")}
        className={`mt-1 ${buttonBase} ${accentHover}`}
      >
        <Info size={18} className="icon-anim-sway" />
        {t("settings.about")}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        className={`mt-2 ${buttonBase} text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.18)] dark:text-rose-300 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10`}
      >
        <LogOut size={18} className="icon-anim-slide" />
        {t("settings.logout")}
      </button>
    </>
  );
}
