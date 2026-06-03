import { Database, Download, Lock, Phone, User, Users } from "../../icons/lucide.js";

export function AdminOverviewExtras({
  t,
  tf,
  stats,
  backups,
  systemHealth,
  securitySummary,
  analyticsSummary,
  latestAudit,
  onTabChange,
  onQuickBackup,
  StatCard,
}) {
  const alerts = [];
  if ((securitySummary?.failedLogins24h || 0) > 10) {
    alerts.push(t("admin.dashboard.alertFailedLogins"));
  }
  if ((systemHealth?.disk?.percent || 0) >= 80) {
    alerts.push(t("admin.dashboard.alertDisk"));
  }
  if (!backups?.length) {
    alerts.push(t("admin.dashboard.alertNoBackup"));
  }

  return (
    <div className="space-y-5">
      {alerts.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">
            {t("admin.dashboard.alerts")}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-100">
            {alerts.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-sm font-bold">{t("admin.dashboard.today")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("admin.analytics.messagesToday")}
            value={analyticsSummary?.messagesToday || 0}
            icon={Database}
          />
          <StatCard
            label={t("admin.analytics.callsToday")}
            value={analyticsSummary?.callsToday || 0}
            icon={Phone}
          />
          <StatCard
            label={t("admin.analytics.newToday")}
            value={analyticsSummary?.newUsersToday || 0}
            icon={User}
          />
          <StatCard
            label={t("admin.analytics.onlineNow")}
            value={analyticsSummary?.onlineNow || stats?.users?.recentlyActive || 0}
            icon={Users}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
          <h2 className="text-sm font-bold">{t("admin.dashboard.quickActions")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTabChange("broadcast")}
              className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200"
            >
              {t("admin.tab.broadcast")}
            </button>
            <button
              type="button"
              onClick={() => onTabChange("users")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10"
            >
              {t("admin.tab.users")}
            </button>
            <button
              type="button"
              onClick={() => onTabChange("calls")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10"
            >
              {t("admin.tab.calls")}
            </button>
            <button
              type="button"
              onClick={onQuickBackup}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10"
            >
              {t("admin.dashboard.createBackup")}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t("admin.dashboard.recentAudit")}</h2>
            <button
              type="button"
              onClick={() => onTabChange("audit")}
              className="text-xs font-bold text-emerald-600"
            >
              {t("admin.dashboard.viewAll")}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {(latestAudit || []).length ? (
              latestAudit.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 px-3 py-2 text-xs dark:border-white/10"
                >
                  <p className="font-semibold">{item.action}</p>
                  <p className="text-slate-500">
                    @{item.actor_username || "system"} · {item.created_at}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{t("admin.noData")}</p>
            )}
          </div>
        </section>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="CPU"
          value={`${systemHealth?.cpu?.percent || 0}%`}
          detail={systemHealth?.cpu?.status || "—"}
          icon={Lock}
        />
        <StatCard
          label={t("admin.monitor.memory")}
          value={`${systemHealth?.memory?.percent || 0}%`}
          detail={systemHealth?.memory?.usedLabel || "—"}
          icon={Database}
        />
        <StatCard
          label={t("admin.stats.backups")}
          value={backups?.length || 0}
          detail={t("admin.stats.backupsDetail")}
          icon={Download}
        />
      </section>
    </div>
  );
}
