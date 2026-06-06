/**
 * Read Receipt — visual indicator (single tick = sent, double tick = delivered, blue = read)
 * Like WhatsApp/Telegram tick system.
 */
export default function ReadReceipt({ status = "sent", className = "" }) {
  // status: "sending" | "sent" | "delivered" | "read"

  if (status === "sending") {
    return (
      <span className={`inline-flex text-slate-300 dark:text-slate-600 ${className}`} title="Sending">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
        </svg>
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span className={`inline-flex text-slate-400 dark:text-slate-500 ${className}`} title="Sent">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span className={`inline-flex text-slate-400 dark:text-slate-500 ${className}`} title="Delivered">
        <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
          <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 5.5L9.5 10L19 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  // read — blue double tick
  return (
    <span className={`inline-flex text-sky-500 ${className}`} title="Read">
      <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
        <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5.5L9.5 10L19 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}
