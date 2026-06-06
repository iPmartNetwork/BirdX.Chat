import { MessageSquare } from "../../../icons/lucide.js";

/**
 * Thread Badge — shows reply count on messages that have thread replies.
 * Displayed below the message bubble. Clicking opens the thread panel.
 */
export default function ThreadBadge({ replyCount = 0, lastReplyAt, onClick }) {
  if (!replyCount) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
      aria-label={`${replyCount} thread replies`}
    >
      <MessageSquare size={12} />
      <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
    </button>
  );
}
