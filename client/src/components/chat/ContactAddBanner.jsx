import { LoaderCircle, UserPlus } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

function formatTemplate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`,
  );
}

export default function ContactAddBanner({
  visible = false,
  peerName = "",
  status = null,
  busy = false,
  onSendRequest,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
}) {
  const { t } = useLanguage();
  const tf = (key, vars) => formatTemplate(t(key), vars);
  if (!visible || !status || status.isContact) return null;

  const incomingId = Number(status.incomingRequestId || 0);
  const outgoingId = Number(status.outgoingRequestId || 0);

  return (
    <div className="border-b border-emerald-200/80 bg-emerald-50/90 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <UserPlus size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {incomingId
                ? tf("contacts.banner.incomingTitle", { name: peerName })
                : outgoingId
                  ? t("contacts.banner.outgoingTitle")
                  : tf("contacts.banner.addTitle", { name: peerName })}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {incomingId
                ? t("contacts.banner.incomingHint")
                : outgoingId
                  ? t("contacts.banner.outgoingHint")
                  : t("contacts.banner.addHint")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {incomingId ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAcceptRequest?.(incomingId)}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
                {t("contacts.banner.accept")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRejectRequest?.(incomingId)}
                className="inline-flex h-9 items-center rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10 disabled:opacity-60"
              >
                {t("contacts.banner.decline")}
              </button>
            </>
          ) : outgoingId ? (
            <>
              <span className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200">
                {t("contacts.banner.pending")}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancelRequest?.(outgoingId)}
                className="inline-flex h-9 items-center rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10 disabled:opacity-60"
              >
                {t("contacts.banner.cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSendRequest?.()}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {t("contacts.banner.addButton")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
