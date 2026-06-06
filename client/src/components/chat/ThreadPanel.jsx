import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { getAvatarInitials } from "../../utils/avatarInitials.js";
import { formatTime } from "../../utils/chatFormat.js";

/**
 * Thread Panel — shows replies to a specific message in a side panel.
 * Opens when user clicks "View thread" or "Reply in thread" on a message.
 */
export default function ThreadPanel({
  rootMessage,
  replies = [],
  replyCount = 0,
  loading = false,
  onClose,
  onSendReply,
  currentUser,
}) {
  const { t } = useLanguage();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  const handleSend = useCallback(async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSendReply?.(text);
      setReplyText("");
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }, [replyText, sending, onSendReply]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!rootMessage) return null;

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950 md:w-[360px]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="Close thread"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {t("chat.thread") || "Thread"}
          </h3>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </p>
        </div>
      </div>

      {/* Root message */}
      <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {getAvatarInitials(rootMessage.nickname || rootMessage.username)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {rootMessage.nickname || rootMessage.username}
            </p>
            <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">
              {rootMessage.body}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {formatTime(rootMessage.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Replies list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-center text-xs text-slate-400">Loading...</p>
        ) : replies.length === 0 ? (
          <p className="text-center text-xs text-slate-400">
            {t("chat.threadEmpty") || "No replies yet. Start the conversation!"}
          </p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {getAvatarInitials(reply.nickname || reply.username)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {reply.nickname || reply.username}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatTime(reply.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">
                  {reply.body}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply input */}
      <div className="border-t border-slate-200 px-3 py-2 dark:border-white/10">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.threadReplyPlaceholder") || "Reply in thread..."}
            className="h-9 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            disabled={sending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-40"
            aria-label="Send reply"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
