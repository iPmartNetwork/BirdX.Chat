import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function AdminModerationActionModal({ action, report, onClose, onConfirm, busy }) {
  const { t, tf } = useLanguage();
  const [adminPassword, setAdminPassword] = useState("");

  if (!action || !report) return null;

  const titleKey = `admin.moderation.action.${action}.title`;
  const bodyKey = `admin.moderation.action.${action}.body`;
  const confirmKey = `admin.moderation.action.${action}.confirm`;

  return (
    <div className="fixed inset-0 z-[510] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-lg font-bold">{t(titleKey)}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {tf(bodyKey, {
            user: report.authorUsername ? `@${report.authorUsername}` : "?",
            chat: report.chatName || `#${report.chatId}`,
          })}
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase text-slate-500">
            {t("admin.common.adminPassword")}
          </span>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
            autoFocus
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            {t("admin.common.cancel")}
          </button>
          <button
            type="button"
            disabled={!adminPassword.trim() || busy}
            onClick={() => onConfirm({ adminPassword: adminPassword.trim() })}
            className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("admin.common.working") : t(confirmKey)}
          </button>
        </div>
      </section>
    </div>
  );
}
