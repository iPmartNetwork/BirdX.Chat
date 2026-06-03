import { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const REASONS = ["spam", "abuse", "illegal", "other"];

export default function ReportMessageModal({ open, messagePreview, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("other");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const handleSubmit = async () => {
    setBusy(true);
    setError("");
    try {
      await onSubmit?.({ reason, details: details.trim() });
      setReason("other");
      setDetails("");
      onClose?.();
    } catch (err) {
      setError(err?.message || t("chat.reportMessageFailed"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-950">
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">
          {t("chat.reportMessage")}
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t("chat.reportMessageHint")}
        </p>
        {messagePreview ? (
          <p className="mt-3 line-clamp-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
            {messagePreview}
          </p>
        ) : null}
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase text-slate-500">
            {t("chat.reportReason")}
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
          >
            {REASONS.map((item) => (
              <option key={item} value={item}>
                {t(`chat.reportReason.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-bold uppercase text-slate-500">
            {t("chat.reportDetails")}
          </span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("chat.reportDetailsPlaceholder")}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
          />
        </label>
        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              onClose?.();
            }}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            {t("admin.common.cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("admin.common.working") : t("chat.reportSubmit")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
