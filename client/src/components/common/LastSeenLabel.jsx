/**
 * Last Seen Label — shows "online", "last seen X minutes ago", etc.
 * More informative than just a green/gray dot.
 */
export default function LastSeenLabel({ status, lastSeen, className = "" }) {
  const isOnline = status === "online";

  if (isOnline) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 ${className}`}>
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        online
      </span>
    );
  }

  const label = formatLastSeen(lastSeen);

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 ${className}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
      {label}
    </span>
  );
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return "offline";
  const now = Date.now();
  const seen = new Date(lastSeen).getTime();
  if (isNaN(seen)) return "offline";

  const diffMs = now - seen;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "last seen just now";
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  if (diffHr < 24) return `last seen ${diffHr}h ago`;
  if (diffDays < 7) return `last seen ${diffDays}d ago`;
  return "last seen long ago";
}
