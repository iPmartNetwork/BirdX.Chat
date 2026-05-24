import { createPortal } from "react-dom";

export default function LeaveGroupModal({
  open,
  onClose,
  onConfirm,
  isChannel = false,
}) {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-rose-100/70 bg-white p-6 shadow-xl dark:border-rose-500/30 dark:bg-slate-950">
        <h3 className="text-lg font-semibold text-rose-600 dark:text-rose-300">
          {isChannel ? "Leave channel" : "Leave group"}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {isChannel
            ? "Are you sure you want to leave this channel?"
            : "Are you sure you want to leave this group?"}
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:shadow-[0_0_14px_rgba(59,130,246,0.2)] dark:border-blue-500/30 dark:bg-slate-950 dark:text-blue-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:shadow-[0_0_14px_rgba(244,63,94,0.2)] dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200"
          >
            Leave
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
