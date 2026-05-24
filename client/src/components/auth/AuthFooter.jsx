export default function AuthFooter({ isLogin, canSignup, onSwitchMode }) {
  if (!canSignup) return null;
  return (
    <div className="mt-4 space-y-2 rounded-2xl border border-indigo-100/70 bg-indigo-50/70 p-3 text-xs text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-900/40 dark:text-indigo-200 sm:mt-6 sm:space-y-3 sm:p-4 sm:text-sm">
      <p className="font-semibold">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
      </p>
      <button
        type="button"
        onClick={onSwitchMode}
        className="mt-2 w-full rounded-2xl border border-indigo-300 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-400 hover:shadow-[0_0_18px_rgba(99,102,241,0.24)] dark:border-indigo-500/40 dark:bg-slate-900/60 dark:text-indigo-200 sm:px-4 sm:py-2 sm:text-sm"
      >
        {isLogin ? "Create new account" : "Back to sign in"}
      </button>
    </div>
  );
}
