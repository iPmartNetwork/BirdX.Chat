import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import {
  cancelScheduledMessage,
  fetchScheduledMessages,
} from "../../../api/chatApi.js";
import { Clock12, Trash } from "../../../icons/lucide.js";

function formatScheduledAt(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}

export default function ScheduledMessagesPanel({ user }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadItems = useCallback(async () => {
    if (!user?.username) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetchScheduledMessages(user.username);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || t("chat.schedule.failed"));
      }
      setItems(Array.isArray(data?.scheduled) ? data.scheduled : []);
    } catch (loadErr) {
      setError(loadErr?.message || t("chat.schedule.failed"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t, user?.username]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleCancel = async (messageId) => {
    if (!user?.username || !messageId) return;
    setBusyId(messageId);
    setError("");
    try {
      const res = await cancelScheduledMessage({
        username: user.username,
        messageId,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || t("chat.schedule.failed"));
      }
      setItems((prev) => prev.filter((item) => Number(item.id) !== Number(messageId)));
    } catch (cancelErr) {
      setError(cancelErr?.message || t("chat.schedule.failed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {t("chat.schedule.listTitle")}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("chat.schedule.listHint")}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400">
          {t("chat.schedule.listEmpty")}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-emerald-200/70 bg-white/90 p-3 dark:border-emerald-500/25 dark:bg-slate-950/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {item.chat_name || t("chat.unnamed")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                    <Clock12 size={12} />
                    {formatScheduledAt(item.scheduled_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => handleCancel(item.id)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  aria-label={t("chat.schedule.cancel")}
                >
                  <Trash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
