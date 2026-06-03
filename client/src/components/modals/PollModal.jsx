import { useState } from "react";
import { createPortal } from "react-dom";
import { Close, Plus } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function PollModal({ open, busy = false, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);

  if (!open || typeof document === "undefined") return null;

  const handleClose = () => {
    setQuestion("");
    setOptions(["", ""]);
    setMultiple(false);
    onClose?.();
  };

  const handleSubmit = () => {
    const trimmedQuestion = String(question || "").trim();
    const trimmedOptions = options.map((opt) => String(opt || "").trim()).filter(Boolean);
    if (!trimmedQuestion || trimmedOptions.length < 2) return;
    onSubmit?.({
      question: trimmedQuestion,
      options: trimmedOptions,
      multiple,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-200/80 bg-white p-5 shadow-2xl dark:border-emerald-500/25 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {t("chat.poll.title")}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Close size={16} />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("chat.poll.question")}
          </span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={300}
            className="h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-emerald-500/30 dark:bg-slate-900"
            placeholder={t("chat.poll.questionPlaceholder")}
          />
        </label>

        <div className="mt-4 space-y-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("chat.poll.options")}
          </span>
          {options.map((option, index) => (
            <input
              key={`poll-option-input-${index}`}
              value={option}
              onChange={(event) => {
                const next = options.slice();
                next[index] = event.target.value;
                setOptions(next);
              }}
              maxLength={120}
              className="h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-emerald-500/30 dark:bg-slate-900"
              placeholder={`${t("chat.poll.option")} ${index + 1}`}
            />
          ))}
          {options.length < 10 ? (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200"
            >
              <Plus size={14} />
              {t("chat.poll.addOption")}
            </button>
          ) : null}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(event) => setMultiple(event.target.checked)}
          />
          {t("chat.poll.multiple")}
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-emerald-500/30 dark:text-slate-200"
          >
            {t("chat.cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
          >
            {t("chat.poll.send")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
