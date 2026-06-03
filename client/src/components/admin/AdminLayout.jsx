import { Moon, Refresh, ShieldCheck, Sun } from "../../icons/lucide.js";
import { ADMIN_TAB_GROUPS, ADMIN_TAB_TITLE_KEYS } from "./adminConfig.js";
import AdminLanguageToggle from "./AdminLanguageToggle.jsx";

export default function AdminLayout({
  activeTab,
  onTabChange,
  t,
  isRtl = false,
  tabTitle,
  onRefresh,
  onToggleTheme,
  isDark,
  onNavigate,
  children,
}) {
  return (
    <div
      className="flex min-h-screen w-full bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <aside className="hidden w-64 shrink-0 border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 md:block border-e">
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-bold">BirdX Admin</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">v1.0.0</p>
            </div>
          </div>
          <nav className="mt-6 flex-1 space-y-5 overflow-y-auto pe-1">
            {ADMIN_TAB_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-1">
                  {group.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-semibold transition ${
                          active
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                        }`}
                      >
                        <Icon size={17} />
                        {t(tab.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {t("admin.title")}
              </p>
              <h1 className="text-xl font-bold">
                {tabTitle || t(ADMIN_TAB_TITLE_KEYS[activeTab] || "admin.title")}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <AdminLanguageToggle />
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
              >
                <Refresh size={17} />
                {t("admin.refresh")}
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.("/chat", true)}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                {t("admin.layout.backToChat")}
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {ADMIN_TAB_GROUPS.flatMap((g) => g.tabs).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
