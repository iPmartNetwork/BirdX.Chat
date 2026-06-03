export function AdminSkeleton({ rows = 4 }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-16 rounded-2xl border border-slate-200/80 bg-slate-100 dark:border-white/10 dark:bg-white/5"
        />
      ))}
    </div>
  );
}

export function AdminStatSkeleton({ count = 4 }) {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-24 rounded-2xl border border-slate-200/80 bg-slate-100 dark:border-white/10 dark:bg-white/5"
        />
      ))}
    </div>
  );
}
