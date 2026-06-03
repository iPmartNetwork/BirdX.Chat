import { useEffect, useMemo, useState } from "react";
import { Close, Clock12 } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ScheduleMessageModal({
  open,
  initialBody = "",
  onClose,
  onSchedule,
  busy = false,
}) {
  const { t } = useLanguage();
  const defaultWhen = useMemo(() => {
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setSeconds(0, 0);
    return toLocalInputValue(next);
  }, [open]);
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultWhen);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setBody(String(initialBody || "").trim());
    setScheduledAt(defaultWhen);
    setError("");
  }, [open, initialBody, defaultWhen]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = String(body || "").trim();
    if (!trimmed) {
      setError(t("chat.schedule.bodyRequired"));
      return;
    }
    const iso = new Date(scheduledAt).toISOString();
    if (!Number.isFinite(Date.parse(iso)) || Date.parse(iso) <= Date.now()) {
      setError(t("chat.schedule.timeInvalid"));
      return;
    }
    setError("");
    try {
      await onSchedule?.({ body: trimmed, scheduledAt: iso });
      onClose?.();
    } catch (err) {
      setError(err?.message || t("chat.schedule.failed"));
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-emerald-100/70 bg-white p-6 shadow-xl dark:border-emerald-500/30 dark:bg-slate-950"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-emerald-800 dark:text-emerald-200">
            <Clock12 size={18} />
            {t("chat.schedule.title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
            aria-label={t("chat.cancel")}
          >
            <Close size={18} />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t("chat.schedule.hint")}
        </p>

        <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("chat.schedule.message")}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-none rounded-2xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/50 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
            dir="auto"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("chat.schedule.when")}
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            className="mt-1.5 w-full rounded-2xl border border-emerald-200/80 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/50 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        {error ? (
          <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("chat.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? t("chat.saving") : t("chat.schedule.confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}
