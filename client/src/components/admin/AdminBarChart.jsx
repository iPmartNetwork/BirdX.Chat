export default function AdminBarChart({ items = [], colorClass = "bg-emerald-500", maxBars = 15 }) {
  const rows = Array.isArray(items) ? items.slice(-maxBars) : [];
  const max = Math.max(1, ...rows.map((item) => Number(item.count || item.value || 0)));

  if (!rows.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">—</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((item) => {
        const value = Number(item.count ?? item.value ?? 0);
        const label = item.day || item.label || "";
        return (
          <div key={`${label}-${value}`} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">
              {label}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-end text-xs font-bold">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
