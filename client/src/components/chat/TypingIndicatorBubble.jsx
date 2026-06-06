/**
 * Typing Indicator Bubble — shows "Ali is typing..." with animated dots.
 * Displays the actual username(s) who are typing.
 */
export default function TypingIndicatorBubble({ typingUsers = [] }) {
  if (!typingUsers.length) return null;

  const names = typingUsers.map((u) => u.nickname || u.username);
  let label = "";
  if (names.length === 1) {
    label = `${names[0]} is typing`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing`;
  } else {
    label = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
        {/* Animated dots */}
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-[bounce_1.2s_infinite_0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-[bounce_1.2s_infinite_200ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-[bounce_1.2s_infinite_400ms]" />
        </span>
        <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
    </div>
  );
}
