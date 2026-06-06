/**
 * Message Formatting Toolbar — adds bold, italic, code, quote formatting.
 * Works with a textarea ref to wrap selected text in markdown syntax.
 */
export default function FormattingToolbar({ inputRef, onTextChange }) {
  const wrapSelection = (prefix, suffix = prefix) => {
    const input = inputRef?.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const selected = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = `${before}${prefix}${selected || "text"}${suffix}${after}`;
    onTextChange?.(newText);
    // Restore cursor after formatting marks
    setTimeout(() => {
      const cursorPos = selected
        ? start + prefix.length + selected.length + suffix.length
        : start + prefix.length;
      input.focus();
      input.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected || "text").length,
      );
    }, 0);
  };

  const buttons = [
    { label: "B", title: "Bold", action: () => wrapSelection("**") },
    { label: "I", title: "Italic", action: () => wrapSelection("_") },
    { label: "<>", title: "Code", action: () => wrapSelection("`") },
    { label: "❝", title: "Quote", action: () => wrapSelection("\n> ", "\n") },
    { label: "~~", title: "Strikethrough", action: () => wrapSelection("~~") },
  ];

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-100 px-2 py-1 dark:border-white/10">
      {buttons.map((btn) => (
        <button
          key={btn.title}
          type="button"
          onClick={btn.action}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
          title={btn.title}
          aria-label={btn.title}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
