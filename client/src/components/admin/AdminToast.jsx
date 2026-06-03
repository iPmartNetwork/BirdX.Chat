import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AdminToastContext = createContext(null);

export function AdminToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, variant = "success") => {
    const text = String(message || "").trim();
    if (!text) return;
    setToast({ message: text, variant });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          className={`fixed bottom-5 z-[100] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl start-5 ${
            toast.variant === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(AdminToastContext);
  return ctx?.showToast || (() => {});
}
