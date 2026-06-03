import { Chat, Phone, Settings } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function MobileTabMenu({
  hidden,
  mobileTab,
  onChats,
  onCalls,
  onSettings,
}) {
  const { t } = useLanguage();

  const tabClass = (active) =>
    `relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
      active ? "text-white" : "text-emerald-700 dark:text-emerald-200"
    }`;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-10 px-4 sm:px-6 md:hidden ${
        hidden ? "hidden" : ""
      }`}
      style={{
        paddingBottom:
          "max(0.5rem, calc(env(safe-area-inset-bottom) + var(--vv-bottom-offset, 0px) + 0.5rem))",
      }}
    >
      <div className="mx-auto mb-2 flex max-w-sm items-center justify-between rounded-3xl border border-slate-300/90 bg-white/95 p-2 shadow-lg shadow-emerald-500/10 backdrop-blur-none dark:border-emerald-500/35 dark:bg-slate-900/95 md:backdrop-blur">
        <button type="button" onClick={onChats} className={tabClass(mobileTab === "chats")}>
          {mobileTab === "chats" ? (
            <span className="absolute inset-0 rounded-2xl bg-emerald-500" />
          ) : null}
          <span className="relative z-10">
            <Chat className="icon-anim-bob" />
          </span>
          <span className="relative z-10">{t("chat.chats")}</span>
        </button>
        <button type="button" onClick={onCalls} className={tabClass(mobileTab === "calls")}>
          {mobileTab === "calls" ? (
            <span className="absolute inset-0 rounded-2xl bg-emerald-500" />
          ) : null}
          <span className="relative z-10">
            <Phone className="icon-anim-bob" />
          </span>
          <span className="relative z-10">{t("calls.title")}</span>
        </button>
        <button type="button" onClick={onSettings} className={tabClass(mobileTab === "settings")}>
          {mobileTab === "settings" ? (
            <span className="absolute inset-0 rounded-2xl bg-emerald-500" />
          ) : null}
          <span className="relative z-10">
            <Settings className="icon-anim-spin-dir" />
          </span>
          <span className="relative z-10">{t("settings.title")}</span>
        </button>
      </div>
    </div>
  );
}
