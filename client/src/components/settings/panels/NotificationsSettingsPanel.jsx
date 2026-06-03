import { Bell, BellOff } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

function formatDndUntilLabel(untilIso, t) {
  if (!untilIso) return "";
  const ms = Date.parse(untilIso);
  if (!Number.isFinite(ms)) return "";
  if (ms <= Date.now()) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function NotificationsSettingsPanel({
  notificationsActive,
  notificationsDisabled,
  notificationStatusLabel,
  onToggleNotifications,
  onTestPush,
  testNotificationSent,
  notificationsEnabled,
  debugLine = "",
  dndUntil = null,
  dndBusy = false,
  onSetDndUntil,
}) {
  const { t } = useLanguage();
  const dndActive =
    Boolean(dndUntil) && Number.isFinite(Date.parse(dndUntil)) && Date.parse(dndUntil) > Date.now();
  const dndLabel = dndActive ? formatDndUntilLabel(dndUntil, t) : "";
  const buttonBase =
    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-start text-sm font-semibold transition";
  const buttonHover =
    "hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_0_18px_rgba(16,185,129,0.18)] dark:hover:bg-emerald-500/10";
  const buttonTheme =
    "border-emerald-200/70 bg-white/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-slate-900/50 dark:text-emerald-200";
  const disabledTheme =
    "cursor-not-allowed opacity-60 hover:bg-transparent hover:shadow-none";
  const sentBadgeTheme =
    "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_0_14px_rgba(16,185,129,0.2)] dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-500/10";
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
              ? "bg-emerald-500 justify-end"
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

      <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-white/90 p-4 dark:border-emerald-500/30 dark:bg-slate-900/50">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          {t("settings.notifications.dndTitle")}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {dndActive && dndLabel
            ? t("settings.notifications.dndUntil", { time: dndLabel })
            : t("settings.notifications.dndOff")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: "1h", hours: 1, label: t("settings.notifications.dnd1h") },
            { key: "8h", hours: 8, label: t("settings.notifications.dnd8h") },
            { key: "24h", hours: 24, label: t("settings.notifications.dnd24h") },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={dndBusy}
              onClick={() =>
                onSetDndUntil?.(
                  new Date(Date.now() + preset.hours * 60 * 60 * 1000).toISOString(),
                )
              }
              className="rounded-full border border-emerald-200/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
            >
              {preset.label}
            </button>
          ))}
          {dndActive ? (
            <button
              type="button"
              disabled={dndBusy}
              onClick={() => onSetDndUntil?.(null)}
              className="rounded-full border border-rose-200/80 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              {t("settings.notifications.dndClear")}
            </button>
          ) : null}
        </div>
      </div>

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
                : `${testButtonBase} bg-emerald-500 text-white hover:bg-emerald-400`
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
