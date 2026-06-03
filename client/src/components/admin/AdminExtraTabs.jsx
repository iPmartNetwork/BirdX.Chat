import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminCalls,
  updateAdminModerationReport,
  fetchAdminModerationReports,
  fetchAdminServerSettings,
  updateAdminServerSettings,
  adminModerationReportAction,
} from "../../api/chatApi.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import AdminModerationActionModal from "./AdminModerationActionModal.jsx";
import { AdminSkeleton } from "./AdminSkeleton.jsx";
import { useAdminToast } from "./AdminToast.jsx";

async function readJson(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

export function AdminCallsTab() {
  const { t } = useLanguage();
  const showToast = useAdminToast();
  const [calls, setCalls] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readJson(
        await fetchAdminCalls({ query, status, page, pageSize: 25 }),
      );
      setCalls(data.calls || []);
      setPagination(data.pagination || null);
    } catch (err) {
      showToast(err?.message || t("admin.common.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [page, query, showToast, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t("admin.calls.search")}
          className="h-10 min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950"
        >
          <option value="">{t("admin.calls.allStatuses")}</option>
          <option value="ended">ended</option>
          <option value="ringing">ringing</option>
          <option value="active">active</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="h-10 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white"
        >
          {t("admin.refresh")}
        </button>
      </div>
      {loading ? <AdminSkeleton rows={6} /> : null}
      {!loading ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-start">{t("admin.calls.chat")}</th>
                <th className="px-4 py-3 text-start">{t("admin.calls.caller")}</th>
                <th className="px-4 py-3 text-start">{t("admin.calls.type")}</th>
                <th className="px-4 py-3 text-start">{t("admin.calls.status")}</th>
                <th className="px-4 py-3 text-start">{t("admin.calls.duration")}</th>
                <th className="px-4 py-3 text-start">{t("admin.calls.started")}</th>
              </tr>
            </thead>
            <tbody>
              {calls.length ? (
                calls.map((call) => (
                  <tr key={call.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{call.chatName || `#${call.chatId}`}</p>
                      <p className="text-xs text-slate-500">{call.chatType}</p>
                    </td>
                    <td className="px-4 py-3">@{call.callerUsername || "—"}</td>
                    <td className="px-4 py-3">{call.callType}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{call.durationSeconds}s</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{call.startedAt || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {t("admin.noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {pagination?.totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="px-2 py-1 text-sm">
            {page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminModerationTab() {
  const { t } = useLanguage();
  const showToast = useAdminToast();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readJson(
        await fetchAdminModerationReports({ status, page, pageSize: 25 }),
      );
      setReports(data.reports || []);
    } catch (err) {
      showToast(err?.message || t("admin.common.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [page, showToast, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id, nextStatus) => {
    try {
      await readJson(await updateAdminModerationReport(id, { status: nextStatus }));
      showToast(t("admin.moderation.updated"));
      await load();
    } catch (err) {
      showToast(err?.message || t("admin.actionFailed"), "error");
    }
  };

  const runModerationAction = async ({ adminPassword }) => {
    if (!pendingAction) return;
    setActionBusy(true);
    try {
      const data = await readJson(
        await adminModerationReportAction(pendingAction.report.id, {
          action: pendingAction.action,
          adminPassword,
        }),
      );
      if (data.banned && data.messageDeleted) {
        showToast(t("admin.moderation.actionSuccess.banAndDelete"));
      } else if (data.banned) {
        showToast(t("admin.moderation.actionSuccess.ban"));
      } else if (data.messageDeleted) {
        showToast(t("admin.moderation.actionSuccess.delete"));
      } else {
        showToast(t("admin.moderation.updated"));
      }
      setPendingAction(null);
      await load();
    } catch (err) {
      showToast(err?.message || t("admin.actionFailed"), "error");
    } finally {
      setActionBusy(false);
    }
  };

  const reasonLabel = (reason) => {
    const key = `admin.moderation.reason.${reason}`;
    const label = t(key);
    return label === key ? reason : label;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["pending", "reviewed", "dismissed", "all"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${
              status === item
                ? "bg-emerald-500 text-white"
                : "border border-slate-200 dark:border-white/10"
            }`}
          >
            {t(`admin.moderation.status.${item}`)}
          </button>
        ))}
      </div>
      {loading ? <AdminSkeleton rows={5} /> : null}
      {!loading ? (
        <div className="space-y-3">
          {reports.length ? (
            reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-slate-500">
                      {reasonLabel(report.reason)} · {t(`admin.moderation.status.${report.status}`)}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {report.chatName || `#${report.chatId}`} · @{report.authorUsername || "?"}
                    </p>
                    <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
                      {report.messagePreview || "—"}
                    </p>
                    {report.details ? (
                      <p className="mt-2 text-xs text-slate-500">{report.details}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">
                      {t("admin.moderation.reportedBy")} @{report.reporterUsername} ·{" "}
                      {report.createdAt}
                    </p>
                  </div>
                  {report.status === "pending" ? (
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(report.id, "reviewed")}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        {t("admin.moderation.reviewed")}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(report.id, "dismissed")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10"
                      >
                        {t("admin.moderation.dismiss")}
                      </button>
                      {report.authorUserId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({ report, action: "ban_author" })
                          }
                          className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 dark:border-amber-500/30 dark:text-amber-200"
                        >
                          {t("admin.moderation.banAuthor")}
                        </button>
                      ) : null}
                      {report.messageId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({ report, action: "delete_message" })
                          }
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                        >
                          {t("admin.moderation.deleteMessage")}
                        </button>
                      ) : null}
                      {report.authorUserId && report.messageId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({ report, action: "ban_and_delete" })
                          }
                          className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          {t("admin.moderation.banAndDelete")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
              {t("admin.moderation.empty")}
            </p>
          )}
        </div>
      ) : null}
      <AdminModerationActionModal
        action={pendingAction?.action}
        report={pendingAction?.report}
        busy={actionBusy}
        onClose={() => setPendingAction(null)}
        onConfirm={runModerationAction}
      />
    </div>
  );
}

export function AdminServerTab() {
  const { t } = useLanguage();
  const showToast = useAdminToast();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    maintenanceMode: false,
    maintenanceMessage: "",
    accountCreation: true,
    fileUpload: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readJson(await fetchAdminServerSettings());
      setSettings(data.settings || {});
      setForm({
        maintenanceMode: Boolean(data.settings?.maintenanceMode),
        maintenanceMessage: String(data.settings?.maintenanceMessage || ""),
        accountCreation: Boolean(data.settings?.accountCreation),
        fileUpload: Boolean(data.settings?.fileUpload),
      });
    } catch (err) {
      showToast(err?.message || t("admin.common.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await readJson(await updateAdminServerSettings(form));
      setSettings((prev) => ({ ...prev, ...data.settings }));
      showToast(t("admin.server.saved"));
    } catch (err) {
      showToast(err?.message || t("admin.actionFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminSkeleton rows={4} />;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">
          {t("admin.server.maintenanceTitle")}
        </h2>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(e) => setForm((prev) => ({ ...prev, maintenanceMode: e.target.checked }))}
          />
          {t("admin.server.maintenanceMode")}
        </label>
        <textarea
          value={form.maintenanceMessage}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, maintenanceMessage: e.target.value }))
          }
          placeholder={t("admin.server.maintenancePlaceholder")}
          className="mt-3 min-h-[80px] w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-slate-950"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-sm font-bold">{t("admin.server.featuresTitle")}</h2>
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{t("admin.server.accountCreation")}</span>
            <input
              type="checkbox"
              checked={form.accountCreation}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, accountCreation: e.target.checked }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{t("admin.server.fileUpload")}</span>
            <input
              type="checkbox"
              checked={form.fileUpload}
              onChange={(e) => setForm((prev) => ({ ...prev, fileUpload: e.target.checked }))}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("admin.server.envHint")}</p>
        <p className="mt-1 text-xs text-slate-500">
          {t("admin.server.messageLimit")}: {settings?.messageMaxChars || 0} ·{" "}
          {t("admin.server.groupCallMode")}: {settings?.groupCallMode || "mesh"}
        </p>
      </section>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? t("admin.common.working") : t("admin.server.save")}
      </button>
    </div>
  );
}
