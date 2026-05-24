import { Bell, BellOff } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

export function NotificationsSettingsPanel({
  notificationsActive,
  notificationsDisabled,
  notificationStatusLabel,
  onToggleNotifications,
  onTestPush,
  testNotificationSent,
  notificationsEnabled,
  debugLine = "",
}) {
  const { t } = useLanguage();
  const buttonBase =
    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-start text-sm font-semibold transition";
  const buttonHover =
    "hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-[0_0_18px_rgba(99,102,241,0.18)] dark:hover:bg-indigo-500/10";
  const buttonTheme =
    "border-indigo-200/70 bg-white/90 text-indigo-700 dark:border-indigo-500/30 dark:bg-slate-900/50 dark:text-indigo-200";
  const disabledTheme =
    "cursor-not-allowed opacity-60 hover:bg-transparent hover:shadow-none";
  const sentBadgeTheme =
    "inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-[0_0_14px_rgba(99,102,241,0.2)] dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-indigo-500/10";
  const testButtonBase =
    "inline-flex h-7 min-w-[56px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold leading-none transition";
  const showDebug =
    typeof window !== "undefined" &&
    window.localStorage?.getItem("sb-debug-push") === "1";

  return (
    <>
      <button
        type="button"
        onClick={onToggleNotifications}
        disabled={notificationsDisabled}
        role="switch"
        aria-checked={notificationsActive}
        className={`${buttonBase} ${buttonTheme} ${buttonHover} ${
          notificationsDisabled ? disabledTheme : ""
        }`}
      >
        <span className="flex items-center gap-3">
          {notificationsActive ? (
            <Bell size={18} className="icon-anim-sway" />
          ) : (
            <BellOff size={18} className="icon-anim-sway" />
          )}
          {t("settings.notifications.enable")}
        </span>
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition ${
            notificationsActive
              ? "bg-indigo-500 justify-end"
              : "bg-slate-300 dark:bg-slate-700 justify-start"
          }`}
        >
          <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition" />
        </span>
      </button>
      {notificationsDisabled ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {notificationStatusLabel}
        </p>
      ) : null}
      {showDebug && debugLine ? (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {debugLine}
        </p>
      ) : null}

      <div
        className={`mt-4 ${buttonBase} ${buttonTheme} ${
          notificationsDisabled || !notificationsEnabled
            ? disabledTheme
            : buttonHover
        }`}
      >
        <span>{t("settings.notifications.testNotification")}</span>
        <button
          type="button"
          onClick={onTestPush}
          disabled={
            notificationsDisabled ||
            !notificationsEnabled ||
            testNotificationSent
          }
          className={
            notificationsDisabled || !notificationsEnabled
              ? `${testButtonBase} cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500`
              : testNotificationSent
                ? `${testButtonBase} ${sentBadgeTheme} cursor-not-allowed`
                : `${testButtonBase} bg-indigo-500 text-white hover:bg-indigo-400`
          }
        >
          {testNotificationSent
            ? t("settings.notifications.sent")
            : t("settings.notifications.test")}
        </button>
      </div>
    </>
  );
}
