import { useState, useEffect, useCallback } from "react";
import { Pin, ChevronDown, ChevronUp, Close } from "../../icons/lucide.js";
import { fetchPinnedMessages } from "../../api/chatApi.js";

/**
 * Pinned Message Bar — shows pinned messages at the top of the chat window.
 * Like Telegram: shows one pinned message at a time with navigation arrows.
 */
export default function PinnedMessageBar({ chatId, onNavigateToMessage }) {
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const loadPinned = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await fetchPinnedMessages(chatId);
      const data = await res.json();
      if (data.ok && data.messages?.length) {
        setPinnedMessages(data.messages);
        setCurrentIndex(0);
        setDismissed(false);
      } else {
        setPinnedMessages([]);
      }
    } catch {
      setPinnedMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    loadPinned();
  }, [loadPinned]);

  // Listen for pin/unpin events to refresh
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.chatId === chatId) loadPinned();
    };
    window.addEventListener("birdx:pin-updated", handler);
    return () => window.removeEventListener("birdx:pin-updated", handler);
  }, [chatId, loadPinned]);

  if (!pinnedMessages.length || dismissed) return null;

  const current = pinnedMessages[currentIndex] || pinnedMessages[0];
  const hasMultiple = pinnedMessages.length > 1;

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50/80 px-3 py-2 dark:border-white/5 dark:bg-amber-900/10">
      <Pin size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <button
        type="button"
        onClick={() => onNavigateToMessage?.(current)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
          {current?.body || "Pinned message"}
        </p>
      </button>
      {hasMultiple ? (
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-slate-400">
            {currentIndex + 1}/{pinnedMessages.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : pinnedMessages.length - 1))}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
            aria-label="Previous pin"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => (i < pinnedMessages.length - 1 ? i + 1 : 0))}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
            aria-label="Next pin"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
        aria-label="Dismiss"
      >
        <Close size={12} />
      </button>
    </div>
  );
}
