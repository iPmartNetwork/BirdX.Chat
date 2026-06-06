import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Close, Settings, Clock12, User, File } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { getAvatarInitials } from "../../utils/avatarInitials.js";
import { formatTime } from "../../utils/chatFormat.js";
import { searchMessagesInChat } from "../../api/chatApi.js";

function HighlightText({ text, highlight }) {
  if (!highlight || !text) return <>{text}</>;
  const parts = String(text).split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase()
          ? <mark key={i} className="bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200 rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

/**
 * Search Modal — advanced message search with filters.
 * Supports: text query, from user, has files, date range.
 */
export default function SearchModal({ chatId, members = [], open, onClose, onNavigateToMessage }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [fromUserId, setFromUserId] = useState("");
  const [hasFiles, setHasFiles] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setTotal(0);
      setSearched(false);
      setShowFilters(false);
    }
  }, [open]);

  const doSearch = useCallback(async () => {
    if (!chatId) return;
    const q = query.trim();
    if (!q && !fromUserId && !hasFiles && !dateFrom && !dateTo) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchMessagesInChat({
        chatId,
        q: q || undefined,
        fromUserId: fromUserId || undefined,
        hasFiles: hasFiles === "true" ? true : hasFiles === "false" ? false : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 50,
      });
      const data = await res.json();
      if (data.ok) {
        setResults(data.messages || []);
        setTotal(data.total || 0);
      }
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [chatId, query, fromUserId, hasFiles, dateFrom, dateTo]);

  // Debounced search on query change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch();
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, fromUserId, hasFiles, dateFrom, dateTo, doSearch, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-16 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-950 border border-slate-200 dark:border-white/10 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.searchMessages") || "Search messages..."}
            className="h-8 flex-1 bg-transparent text-sm outline-none dark:text-white"
          />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
              showFilters ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
            aria-label="Toggle filters"
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Close search"
          >
            <Close size={16} />
          </button>
        </div>

        {/* Filters panel */}
        {showFilters ? (
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10 grid gap-2 grid-cols-2">
            {/* From user */}
            <label className="block">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <User size={12} /> From
              </span>
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Anyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nickname || m.username}
                  </option>
                ))}
              </select>
            </label>

            {/* Has files */}
            <label className="block">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <File size={12} /> Files
              </span>
              <select
                value={hasFiles}
                onChange={(e) => setHasFiles(e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Any</option>
                <option value="true">With files</option>
                <option value="false">Text only</option>
              </select>
            </label>

            {/* Date from */}
            <label className="block">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <Clock12 size={12} /> From date
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>

            {/* Date to */}
            <label className="block">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <Clock12 size={12} /> To date
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
          </div>
        ) : null}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Searching...</p>
          ) : searched && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              {t("chat.searchNoResults") || "No messages found."}
            </p>
          ) : (
            <>
              {searched && total > 0 ? (
                <p className="px-4 pt-2 text-[10px] text-slate-400">
                  {total} result{total !== 1 ? "s" : ""}
                </p>
              ) : null}
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {results.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => onNavigateToMessage?.(msg)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: msg.color || "#10b981" }}
                    >
                      {getAvatarInitials(msg.nickname || msg.username)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {msg.nickname || msg.username}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                        <HighlightText text={msg.body} highlight={query.trim()} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
