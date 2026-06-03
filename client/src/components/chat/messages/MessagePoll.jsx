export default function MessagePoll({ poll, disabled = false, onVote }) {
  if (!poll?.question || !Array.isArray(poll.options)) return null;

  const totalVotes = Number(poll.totalVotes || 0);
  const myVotes = new Set(
    (Array.isArray(poll.myVotes) ? poll.myVotes : []).map((v) => Number(v)),
  );

  return (
    <div className="min-w-[14rem] max-w-full space-y-2">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        📊 {poll.question}
      </p>
      <div className="space-y-1.5">
        {poll.options.map((option, index) => {
          const count = Number(poll.counts?.[index] || 0);
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const selected = myVotes.has(index);
          return (
            <button
              key={`poll-option-${index}`}
              type="button"
              disabled={disabled}
              onClick={() => onVote?.(index)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-start text-xs transition ${
                selected
                  ? "border-emerald-400 bg-emerald-50 dark:border-emerald-400/60 dark:bg-emerald-500/15"
                  : "border-emerald-200/80 bg-white/90 hover:border-emerald-300 dark:border-emerald-500/25 dark:bg-slate-900/70"
              } disabled:opacity-60`}
            >
              <span
                className="absolute inset-y-0 start-0 bg-emerald-200/50 dark:bg-emerald-500/20"
                style={{ width: `${percent}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 dark:text-slate-100">{option}</span>
                <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                  {count} · {percent}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
        {poll.multiple ? " · multiple choice" : ""}
      </p>
    </div>
  );
}
