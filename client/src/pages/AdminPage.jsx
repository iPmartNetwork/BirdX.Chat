import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addAdminChatMember,
  bulkAdminChats,
  bulkAdminUsers,
  createAdminBackup,
  createAdminBot,
  createAdminScheduledMessage,
  createAdminWebhook,
  deleteAdminBackup,
  deleteAdminBot,
  deleteAdminChat,
  deleteAdminChatMember,
  deleteAdminFile,
  deleteAdminScheduledMessage,
  deleteAdminWebhook,
  deleteAdminUser,
  deleteAdminUserSession,
  deleteAdminUserSessions,
  fetchAdminAnalytics,
  fetchAdminAuditLogs,
  fetchAdminBackups,
  fetchAdminBots,
  fetchAdminBranding,
  fetchAdminChatDetail,
  fetchAdminChats,
  fetchAdminFiles,
  fetchAdminOverview,
  fetchAdminRequiredChannels,
  fetchAdminScheduledMessages,
  fetchAdminSecuritySummary,
  fetchAdminSettings,
  fetchAdminSystemHealth,
  fetchAdminUserActivity,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchAdminWebhooks,
  fetchAdminMe,
  verifyAdmin2fa,
  getAdminBackupDownloadUrl,
  getAdminExportUrl,
  resetAdminUserPassword,
  sendAdminBroadcast,
  testAdminWebhook,
  updateAdminBot,
  updateAdminBranding,
  updateAdminChatMember,
  updateAdminChatSettings,
  updateAdminRequiredChannels,
  updateAdminUser,
  updateAdminWebhook,
} from "../api/chatApi.js";
import {
  Ban,
  Chat,
  Database,
  Download,
  File,
  Globe,
  Lock,
  Moon,
  Pencil,
  Refresh,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash,
  User,
  UserPlus,
  Users,
} from "../icons/lucide.js";
import AdminLayout from "../components/admin/AdminLayout.jsx";
import AdminLanguageToggle from "../components/admin/AdminLanguageToggle.jsx";
import AdminBarChart from "../components/admin/AdminBarChart.jsx";
import {
  AdminCallsTab,
  AdminModerationTab,
  AdminServerTab,
} from "../components/admin/AdminExtraTabs.jsx";
import { AdminOverviewExtras } from "../components/admin/AdminOverviewExtras.jsx";
import { AdminToastProvider, useAdminToast } from "../components/admin/AdminToast.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { userHasAdminAccess } from "../utils/adminAccess.js";

export default function AdminPage(props) {
  return (
    <AdminToastProvider>
      <AdminPageContent {...props} />
    </AdminToastProvider>
  );
}

const PAGE_SIZE = 25;
const ADMIN_ROLE_OPTIONS = ["owner", "admin", "moderator", "support", "user"];
const CHAT_ROLE_OPTIONS = ["owner", "admin", "moderator", "member"];

function formatI18nTemplate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`,
  );
}

function formatStorageBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function exportAnalyticsCsv(analytics) {
  const lines = ["day,messages,calls,files"];
  const messageMap = new Map(
    (analytics.messagesPerDay || []).map((row) => [row.day, row.count]),
  );
  const callMap = new Map(
    (analytics.callsPerDay || []).map((row) => [row.day, row.count]),
  );
  const fileMap = new Map(
    (analytics.filesPerDay || []).map((row) => [row.day, row.count]),
  );
  const days = new Set([
    ...messageMap.keys(),
    ...callMap.keys(),
    ...fileMap.keys(),
  ]);
  [...days].sort().forEach((day) => {
    lines.push(
      `${day},${messageMap.get(day) || 0},${callMap.get(day) || 0},${fileMap.get(day) || 0}`,
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `birdx-analytics-${analytics.period || 30}d.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readJsonResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950 dark:text-white">
            {value}
          </p>
          {detail ? (
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {detail}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Icon size={20} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ResourceMeter({ label, percent = 0, detail, status = "healthy", icon: Icon }) {
  const value = Math.max(0, Math.min(100, Number(percent || 0)));
  const color =
    status === "critical"
      ? "bg-rose-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold">{Math.round(value)}%</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        {Icon ? <Icon className="text-emerald-500" size={22} /> : null}
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </section>
  );
}

function formatDuration(seconds = 0) {
  const value = Math.max(0, Number(seconds || 0));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function EmptyState({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400">
      {text}
    </div>
  );
}

function Pager({ pagination, onPage }) {
  const { t, tf } = useLanguage();
  if (!pagination || Number(pagination.totalPages || 1) <= 1) return null;
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950">
      <span className="font-medium text-slate-500 dark:text-slate-400">
        {tf("admin.pager.summary", { page, totalPages, total: pagination.total || 0 })}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-white/10"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-white/10"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ActionModal({ action, onClose, onConfirm, busy }) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  if (!action) return null;
  const needsInput = action.inputLabel;
  const needsAdminPassword = Boolean(action.requiresPassword);
  const canSubmit =
    (!needsInput || value.length >= (action.minLength || 1)) &&
    (!needsAdminPassword || adminPassword.length >= 1);
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">{action.title}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{action.body}</p>
        {needsInput ? (
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {action.inputLabel}
            </span>
            <input
              type={action.inputType || "text"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900"
              autoFocus
            />
          </label>
        ) : null}
        {needsAdminPassword ? (
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {t("admin.common.adminPassword")}
            </span>
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900"
              autoFocus={!needsInput}
            />
          </label>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
          >
            {t("admin.common.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => onConfirm({ value, adminPassword })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              action.danger ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {busy ? t("admin.common.working") : action.confirmLabel || t("admin.common.confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}

function UserDetailDrawer({ detail, onClose, onRevokeSession, onRevokeAllSessions, onUpdateUploadPolicy, userActivity, onLoadActivity }) {
  const { t } = useLanguage();
  const tf = useCallback(
    (key, vars = {}) => formatI18nTemplate(t(key), vars),
    [t],
  );
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-[420] bg-slate-950/40 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <header className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {t("admin.common.userDetail")}
              </p>
              <h2 className="mt-1 text-xl font-bold">{detail.user.nickname || detail.user.username}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">@{detail.user.username}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10"
            >
              {t("admin.common.close")}
            </button>
          </div>
        </header>
        <div className="app-scroll flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label={t("admin.stats.messages")} value={detail.stats.messages} icon={Database} />
            <StatCard label={t("admin.stats.chats")} value={detail.stats.chats} icon={Chat} />
            <StatCard label={t("admin.stats.files")} value={detail.stats.files} detail={detail.stats.storageLabel} icon={File} />
            <StatCard label={t("admin.common.sessions")} value={detail.stats.sessions} icon={Lock} />
          </div>

          {/* Enhanced: Last activity & devices */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">{t("admin.common.activityDevices")}</h3>
              <button
                type="button"
                onClick={() => onLoadActivity?.(detail.user)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10"
              >
                {t("admin.common.loadActivity")}
              </button>
            </div>
            {userActivity ? (
              <div className="mt-3 space-y-3">
                {userActivity.devices?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t("admin.userDetail.devices")}</p>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {userActivity.devices.map((device, idx) => (
                        <div key={idx} className="py-2 text-sm">
                          <p className="truncate font-medium">{device.user_agent || t("admin.common.unknownDevice")}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{tf("admin.userDetail.ipMeta", { ip: device.ip_address || "-", lastSeen: device.last_seen || "-" })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {userActivity.recentMessages?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t("admin.userDetail.recentMessages")}</p>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {userActivity.recentMessages.map((msg) => (
                        <div key={msg.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium">{msg.chat_name || `${msg.chat_type} #${msg.chat_id}`}</p>
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{msg.created_at}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{msg.body || t("admin.userDetail.emptyBody")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {userActivity.loginHistory?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t("admin.userDetail.loginHistory")}</p>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {userActivity.loginHistory.map((entry, idx) => (
                        <div key={idx} className="py-2 text-sm">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {tf("admin.userDetail.loginMeta", { time: entry.created_at, ip: entry.ip_address || "-" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{t("admin.userDetail.activityHint")}</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">{t("admin.userDetail.activeSessions")}</h3>
              <button
                type="button"
                onClick={() => onRevokeAllSessions(detail.user)}
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 dark:border-rose-500/30"
              >
                {t("admin.userDetail.logoutAll")}
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
              {detail.sessions.length ? (
                detail.sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold">{tf("admin.userDetail.session", { id: session.id })}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tf("admin.userDetail.sessionMeta", { created: session.created_at, lastSeen: session.last_seen })}
                      </p>
                      <p className="mt-1 max-w-sm truncate text-xs text-slate-400 dark:text-slate-500">
                        IP {session.ip_address || "-"} / {session.user_agent || "-"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRevokeSession(detail.user, session)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                    >
                      {t("admin.userDetail.revoke")}
                    </button>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-slate-500">{t("admin.userDetail.noSessions")}</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-sm font-bold">{t("admin.userDetail.uploadPolicy")}</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("admin.userDetail.fileUploads")}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {detail.user.fileUploadDisabled ? t("admin.userDetail.uploadDisabled") : t("admin.userDetail.uploadEnabled")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateUploadPolicy(detail.user, { fileUploadDisabled: !detail.user.fileUploadDisabled })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    detail.user.fileUploadDisabled
                      ? "border-emerald-200 text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-300"
                      : "border-rose-200 text-rose-600 dark:border-rose-500/30 dark:text-rose-300"
                  }`}
                >
                  {detail.user.fileUploadDisabled ? t("admin.userDetail.enableUpload") : t("admin.userDetail.disableUpload")}
                </button>
              </div>
              <div>
                <p className="text-sm font-medium">{t("admin.userDetail.maxFileSize")}</p>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  {detail.user.fileUploadMaxSizeBytes
                    ? tf("admin.userDetail.customSize", { size: Math.round(detail.user.fileUploadMaxSizeBytes / (1024 * 1024)) })
                    : t("admin.userDetail.serverDefaultSize")}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={String(detail.user.fileUploadMaxSizeBytes || "")}
                    onChange={(e) => {
                      const value = Number(e.target.value) || null;
                      onUpdateUploadPolicy(detail.user, { fileUploadMaxSizeBytes: value });
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">{t("admin.userDetail.serverDefaultOption")}</option>
                    <option value="104857600">100 MB</option>
                    <option value="262144000">250 MB</option>
                    <option value="524288000">500 MB</option>
                    <option value="1073741824">1 GB</option>
                    <option value="2147483648">2 GB</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-sm font-bold">{t("admin.userDetail.recentChats")}</h3>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
              {detail.chats.length ? (
                detail.chats.map((chat) => (
                  <div key={chat.id} className="py-3 text-sm">
                    <p className="font-semibold">{chat.name || `${chat.type} #${chat.id}`}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tf("admin.userDetail.chatMeta", { type: chat.type, role: chat.role, count: chat.message_count })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-slate-500">{t("admin.userDetail.noChats")}</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ChatDetailDrawer({
  detail,
  onClose,
  onSaveSettings,
  onAddMember,
  onChangeMemberRole,
  onRemoveMember,
}) {
  const { t } = useLanguage();
  const initialChat = detail?.chat || {};
  const [visibility, setVisibility] = useState(initialChat.group_visibility || "public");
  const [username, setUsername] = useState(initialChat.group_username || "");
  const [allowInvites, setAllowInvites] = useState(Boolean(initialChat.allow_member_invites));
  const [memberUsername, setMemberUsername] = useState("");
  const [memberRole, setMemberRole] = useState("admin");

  if (!detail) return null;
  const chat = detail.chat || {};
  return (
    <div className="fixed inset-0 z-[430] bg-slate-950/40 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <header className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {t("admin.chatDetail.title")}
              </p>
              <h2 className="mt-1 text-xl font-bold">{chat.name || `${chat.type} #${chat.id}`}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {chat.type} / {chat.group_visibility || "public"} / {chat.group_username || t("admin.chatDetail.noUsername")}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">
              {t("admin.common.close")}
            </button>
          </div>
        </header>
        <div className="app-scroll flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label={t("admin.common.members")} value={detail.stats?.members || 0} icon={Users} />
            <StatCard label={t("admin.common.admins")} value={detail.stats?.admins || 0} icon={ShieldCheck} />
            <StatCard label={t("admin.stats.messages")} value={detail.stats?.messages || 0} icon={Database} />
            <StatCard label={t("admin.stats.files")} value={detail.stats?.files || 0} icon={File} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[140px] flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.chatDetail.visibility")}</span>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950">
                  <option value="public">{t("admin.chatDetail.public")}</option>
                  <option value="private">{t("admin.chatDetail.private")}</option>
                </select>
              </label>
              <label className="min-w-[180px] flex-[2]">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.chatDetail.publicUsername")}</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="channelname" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" />
              </label>
              <label className="flex min-w-[160px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">
                <input type="checkbox" checked={allowInvites} onChange={(event) => setAllowInvites(event.target.checked)} />
                {t("admin.chatDetail.inviteLinks")}
              </label>
              <button type="button" onClick={() => onSaveSettings({ groupVisibility: visibility, groupUsername: username, allowMemberInvites: allowInvites })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">
                <Pencil size={15} />{t("admin.chatDetail.save")}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[180px] flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.chatDetail.username")}</span>
                <input value={memberUsername} onChange={(event) => setMemberUsername(event.target.value)} placeholder="username" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" />
              </label>
              <label className="min-w-[150px]">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.chatDetail.role")}</span>
                <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950">
                  {CHAT_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => onAddMember({ username: memberUsername, role: memberRole })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">
                <UserPlus size={15} />{t("admin.chatDetail.addMember")}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-sm font-bold">{t("admin.chatDetail.members")}</h3>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
              {Array.isArray(detail.members) && detail.members.length ? detail.members.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{member.nickname || member.username}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">@{member.username} / {member.status || "offline"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={member.role} onChange={(event) => onChangeMemberRole(member, event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold dark:border-white/10 dark:bg-slate-950">
                      {CHAT_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <button type="button" onClick={() => onRemoveMember(member)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30">
                      <Trash size={14} />{t("admin.chatDetail.remove")}
                    </button>
                  </div>
                </div>
              )) : <p className="py-3 text-sm text-slate-500">{t("admin.chatDetail.noMembers")}</p>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function AdminPageContent({ user, isDark, onToggleTheme, onNavigate }) {
  const { t, isRtl } = useLanguage();
  const showToast = useAdminToast();
  const tf = useCallback((key, vars = {}) => formatI18nTemplate(t(key), vars), [t]);
  const adminAct = useCallback(
    (key, vars = {}, extra = {}) => ({
      title: tf(`admin.actions.${key}.title`, vars),
      body: tf(`admin.actions.${key}.body`, vars),
      confirmLabel:
        (extra.confirmKey ? t(`admin.actions.${extra.confirmKey}.confirm`) : null) ||
        t(`admin.actions.${key}.confirm`) ||
        t("admin.common.confirm"),
      inputLabel: extra.inputKey ? t(`admin.actions.${key}.${extra.inputKey}`) : extra.inputLabel,
      ...extra,
    }),
    [t, tf],
  );
  const exportTypes = useMemo(
    () => [
      { type: "users", labelKey: "admin.export.users", descKey: "admin.export.usersDesc", icon: Users },
      { type: "chats", labelKey: "admin.export.chats", descKey: "admin.export.chatsDesc", icon: Chat },
      { type: "files", labelKey: "admin.export.files", descKey: "admin.export.filesDesc", icon: File },
      { type: "audit", labelKey: "admin.export.audit", descKey: "admin.export.auditDesc", icon: ShieldCheck },
    ],
    [],
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [requiredChannels, setRequiredChannels] = useState([]);
  const [availableRequiredChannels, setAvailableRequiredChannels] = useState([]);
  const [selectedRequiredChannelIds, setSelectedRequiredChannelIds] = useState([]);
  const [backups, setBackups] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [securitySummary, setSecuritySummary] = useState(null);
  const [userPagination, setUserPagination] = useState(null);
  const [chatPagination, setChatPagination] = useState(null);
  const [filePagination, setFilePagination] = useState(null);
  const [auditPagination, setAuditPagination] = useState(null);
  const [userFilters, setUserFilters] = useState({ query: "", role: "", status: "", sort: "newest", page: 1 });
  const [chatFilters, setChatFilters] = useState({ query: "", type: "", visibility: "", sort: "newest", page: 1 });
  const [fileFilters, setFileFilters] = useState({ query: "", kind: "", page: 1 });
  const [auditFilters, setAuditFilters] = useState({ action: "", actor: "", targetType: "", page: 1 });
  const [userDetail, setUserDetail] = useState(null);
  const [chatDetail, setChatDetail] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [broadcastRole, setBroadcastRole] = useState("");
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [schedChatId, setSchedChatId] = useState("");
  const [schedBody, setSchedBody] = useState("");
  const [schedAt, setSchedAt] = useState("");
  const [branding, setBranding] = useState(null);
  const [brandingForm, setBrandingForm] = useState({ appName: "", primaryColor: "", accentColor: "", logoUrl: "", welcomeMessage: "", footerText: "" });
  const [webhooks, setWebhooks] = useState([]);
  const [webhookForm, setWebhookForm] = useState({ name: "", url: "", secret: "", events: [] });
  const [availableWebhookEvents, setAvailableWebhookEvents] = useState([]);
  const [bots, setBots] = useState([]);
  const [botForm, setBotForm] = useState({ name: "", permissions: [] });
  const [availableBotPermissions, setAvailableBotPermissions] = useState([]);
  const [newBotToken, setNewBotToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [admin2fa, setAdmin2fa] = useState({
    loading: true,
    required: false,
    verified: true,
    totpEnabled: false,
  });
  const [admin2faToken, setAdmin2faToken] = useState("");
  const [admin2faError, setAdmin2faError] = useState("");

  const isAdmin = userHasAdminAccess(user);
  const admin2faBlocked =
    isAdmin && admin2fa.required && !admin2fa.verified && !admin2fa.loading;

  const withPageSize = (params) => ({ ...params, pageSize: PAGE_SIZE });

  const loadOverview = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminOverview());
    setOverview(data);
  }, []);

  const loadSystemHealth = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminSystemHealth());
    setSystemHealth(data.system || null);
  }, []);

  const loadSecuritySummary = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminSecuritySummary());
    setSecuritySummary(data.security || null);
  }, []);

  const loadUsers = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminUsers(withPageSize(userFilters)));
    setUsers(Array.isArray(data.users) ? data.users : []);
    setUserPagination(data.pagination || null);
  }, [userFilters]);

  const loadChats = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminChats(withPageSize(chatFilters)));
    setChats(Array.isArray(data.chats) ? data.chats : []);
    setChatPagination(data.pagination || null);
  }, [chatFilters]);

  const loadFiles = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminFiles(withPageSize(fileFilters)));
    setFiles(Array.isArray(data.files) ? data.files : []);
    setFilePagination(data.pagination || null);
  }, [fileFilters]);

  const loadAudit = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminAuditLogs(withPageSize(auditFilters)));
    setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
    setAuditPagination(data.pagination || null);
  }, [auditFilters]);

  const loadSettings = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminSettings());
    setSettings(data.settings || null);
  }, []);

  const loadRequiredChannels = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminRequiredChannels());
    const required = Array.isArray(data.requiredChannels) ? data.requiredChannels : [];
    setRequiredChannels(required);
    setAvailableRequiredChannels(
      Array.isArray(data.availableChannels) ? data.availableChannels : [],
    );
    setSelectedRequiredChannelIds(
      required.map((channel) => Number(channel.chat_id || channel.id)).filter(Boolean),
    );
  }, []);

  const loadBackups = useCallback(async () => {
    const data = await readJsonResponse(await fetchAdminBackups());
    setBackups(Array.isArray(data.backups) ? data.backups : []);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAdmin2fa((prev) => ({ ...prev, loading: false }));
      return;
    }
    (async () => {
      try {
        const data = await readJsonResponse(await fetchAdminMe());
        setAdmin2fa({
          loading: false,
          required: Boolean(data?.admin2fa?.required),
          verified: Boolean(data?.admin2fa?.verified),
          totpEnabled: Boolean(data?.admin2fa?.totpEnabled),
        });
      } catch (err) {
        setAdmin2fa((prev) => ({ ...prev, loading: false, verified: false }));
        setError(err?.message || t("admin.common.loadFailed"));
      }
    })();
  }, [isAdmin, t]);

  const loadAll = useCallback(async () => {
    if (!isAdmin || admin2faBlocked) return;
    setLoading(true);
    setError("");
    const tasks = [
      ["overview", loadOverview],
      ["system", loadSystemHealth],
      ["security", loadSecuritySummary],
      ["users", loadUsers],
      ["chats", loadChats],
      ["files", loadFiles],
      ["audit", loadAudit],
      ["settings", loadSettings],
      ["required channels", loadRequiredChannels],
      ["backups", loadBackups],
    ];
    const results = await Promise.allSettled(tasks.map(([, loader]) => loader()));
    const failed = results
      .map((result, index) =>
        result.status === "rejected"
          ? `${tasks[index][0]}: ${result.reason?.message || "failed"}`
          : "",
      )
      .filter(Boolean);
    if (failed.length && failed.length === tasks.length) {
      const firstReason = failed[0] || "";
      if (/2fa|two-factor/i.test(firstReason)) {
        setError(t("admin.2fa.requiredForPanel"));
      } else if (/403|admin access/i.test(firstReason)) {
        setError(t("admin.common.accessDenied"));
      } else {
        setError(t("admin.common.loadFailed"));
      }
    } else {
      setError("");
      if (failed.length) {
        console.warn("[admin] partial load failed:", failed.join(" | "));
      }
    }
    setLoading(false);
  }, [
    isAdmin,
    admin2faBlocked,
    loadAudit,
    loadBackups,
    loadChats,
    loadFiles,
    loadOverview,
    loadRequiredChannels,
    loadSecuritySummary,
    loadSettings,
    loadSystemHealth,
    loadUsers,
  ]);

  useEffect(() => {
    if (admin2fa.loading || admin2faBlocked) return;
    void loadAll();
  }, [admin2fa.loading, admin2faBlocked, loadAll]);

  const loadAnalyticsSummary = useCallback(async () => {
    try {
      const data = await readJsonResponse(await fetchAdminAnalytics({ days: 1 }));
      setAnalyticsSummary(data.summary || null);
    } catch {
      setAnalyticsSummary(null);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "overview" || admin2faBlocked || loading) return;
    void loadAnalyticsSummary();
  }, [activeTab, admin2faBlocked, loadAnalyticsSummary, loading]);

  const loadAnalytics = useCallback(async (days = analyticsDays) => {
    setAnalyticsLoading(true);
    try {
      const data = await readJsonResponse(await fetchAdminAnalytics({ days }));
      setAnalytics(data);
    } catch (err) {
      setError(err?.message || t("admin.analytics.loadFailed"));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDays, t]);

  useEffect(() => {
    if (activeTab !== "analytics" || admin2faBlocked) return;
    void loadAnalytics(analyticsDays);
  }, [activeTab, admin2faBlocked, analyticsDays, loadAnalytics]);

  useEffect(() => {
    if (activeTab === "users") void loadUsers().catch((err) => setError(err.message));
  }, [activeTab, loadUsers]);
  useEffect(() => {
    if (activeTab === "chats") void loadChats().catch((err) => setError(err.message));
  }, [activeTab, loadChats]);
  useEffect(() => {
    if (activeTab === "files") void loadFiles().catch((err) => setError(err.message));
  }, [activeTab, loadFiles]);
  useEffect(() => {
    if (activeTab === "audit") void loadAudit().catch((err) => setError(err.message));
  }, [activeTab, loadAudit]);
  useEffect(() => {
    if (activeTab !== "maintenance") return;
    void loadSettings().catch((err) => setError(err.message));
    void loadRequiredChannels().catch((err) => setError(err.message));
    void loadBackups().catch((err) => setError(err.message));
  }, [activeTab, loadBackups, loadRequiredChannels, loadSettings]);
  useEffect(() => {
    if (activeTab !== "monitor") return undefined;
    void loadSystemHealth().catch((err) => setError(err.message));
    void loadSecuritySummary().catch((err) => setError(err.message));
    const timer = window.setInterval(() => {
      void loadSystemHealth().catch(() => {});
      void loadSecuritySummary().catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, [activeTab, loadSecuritySummary, loadSystemHealth]);

  const runAction = async (key, handler, refresh = loadAll) => {
    setBusyKey(key);
    setError("");
    try {
      await handler();
      await refresh();
      showToast(t("admin.common.done"));
    } catch (err) {
      setError(err?.message || t("admin.actionFailed"));
      showToast(err?.message || t("admin.actionFailed"), "error");
    } finally {
      setBusyKey("");
      setAction(null);
    }
  };

  const openUserDetail = async (item) => {
    setBusyKey(`detail-${item.id}`);
    setError("");
    try {
      const data = await readJsonResponse(await fetchAdminUserDetail(item.id));
      setUserDetail(data);
    } catch (err) {
      setError(err?.message || t("admin.errors.userDetail"));
    } finally {
      setBusyKey("");
    }
  };

  const loadChatDetail = useCallback(async (chatId) => {
    const data = await readJsonResponse(await fetchAdminChatDetail(chatId));
    setChatDetail(data);
    return data;
  }, []);

  const openChatDetail = async (item) => {
    if (!["group", "channel"].includes(String(item.type || "").toLowerCase())) {
      setError(t("admin.errors.chatDetailOnly"));
      return;
    }
    setBusyKey(`chat-detail-${item.id}`);
    setError("");
    try {
      await loadChatDetail(item.id);
    } catch (err) {
      setError(err?.message || t("admin.errors.chatDetail"));
    } finally {
      setBusyKey("");
    }
  };

  const confirmAction = (nextAction) => setAction(nextAction);
  const stats = overview?.stats || {};
  const chatTotal = useMemo(
    () => Object.values(stats.chats || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    [stats.chats],
  );
  const selectedRequiredChannelSet = useMemo(
    () => new Set(selectedRequiredChannelIds.map((id) => Number(id)).filter(Boolean)),
    [selectedRequiredChannelIds],
  );
  const toggleRequiredChannel = (chatId) => {
    const id = Number(chatId || 0);
    if (!id) return;
    setSelectedRequiredChannelIds((prev) =>
      prev.map(Number).includes(id)
        ? prev.filter((item) => Number(item) !== id)
        : [...prev, id],
    );
  };

  if (!isAdmin) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="absolute end-4 top-4">
          <AdminLanguageToggle />
        </div>
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
          <ShieldCheck className="mx-auto text-amber-500" size={34} />
          <h1 className="mt-3 text-xl font-bold">{t("admin.access.title")}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("admin.access.body")}
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("/chat", true)}
            className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            {t("admin.access.back")}
          </button>
        </section>
      </div>
    );
  }

  if (admin2faBlocked) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="absolute end-4 top-4">
          <AdminLanguageToggle />
        </div>
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Lock size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t("admin.2fa.title")}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {admin2fa.totpEnabled
                  ? t("admin.2fa.enterCode")
                  : t("admin.2fa.enableFirst")}
              </p>
            </div>
          </div>
          {admin2fa.totpEnabled ? (
            <form
              className="mt-5 space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setAdmin2faError("");
                try {
                  await readJsonResponse(
                    await verifyAdmin2fa({ token: admin2faToken.trim() }),
                  );
                  setAdmin2fa((prev) => ({ ...prev, verified: true }));
                  setAdmin2faToken("");
                } catch (err) {
                  setAdmin2faError(err?.message || t("admin.2fa.verifyFailed"));
                }
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={admin2faToken}
                onChange={(event) => setAdmin2faToken(event.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg font-semibold tracking-widest dark:border-white/10 dark:bg-slate-950"
              />
              {admin2faError ? (
                <p className="text-sm font-medium text-rose-600">{admin2faError}</p>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
              >
                {t("admin.2fa.verifyButton")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate?.("/chat", true)}
              className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold dark:border-white/10"
            >
              {t("admin.2fa.openSettings")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate?.("/chat", true)}
            className="mt-3 w-full text-sm font-semibold text-slate-500"
          >
            {t("admin.access.back")}
          </button>
        </section>
      </div>
    );
  }

  return (
    <>
      <AdminLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        t={t}
        isRtl={isRtl}
        onRefresh={() => void loadAll()}
        onToggleTheme={onToggleTheme}
        isDark={isDark}
        onNavigate={onNavigate}
      >
          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {error}
            </div>
          ) : null}
          {loading ? <EmptyState text={t("admin.loading")} /> : null}

          {!loading && activeTab === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t("admin.stats.users")} value={stats.users?.total || 0} detail={tf("admin.stats.usersDetail", { admins: stats.users?.admins || 0, banned: stats.users?.banned || 0 })} icon={Users} />
                <StatCard label={t("admin.stats.chats")} value={chatTotal} detail={tf("admin.stats.chatsDetail", { groups: stats.chats?.group || 0, channels: stats.chats?.channel || 0 })} icon={Chat} />
                <StatCard label={t("admin.stats.messages")} value={stats.messages || 0} detail={t("admin.stats.messagesDetail")} icon={Database} />
                <StatCard label={t("admin.stats.files")} value={stats.files?.total || 0} detail={stats.files?.label || "0 B"} icon={File} />
              </div>
              <AdminOverviewExtras
                t={t}
                tf={tf}
                stats={stats}
                backups={backups}
                systemHealth={systemHealth}
                securitySummary={securitySummary}
                analyticsSummary={analyticsSummary}
                latestAudit={auditLogs.slice(0, 5)}
                onTabChange={setActiveTab}
                onQuickBackup={() =>
                  confirmAction({
                    title: t("admin.dashboard.createBackup"),
                    body: t("admin.dashboard.createBackupConfirm"),
                    confirmLabel: t("admin.common.confirm"),
                    requiresPassword: true,
                    run: async ({ adminPassword }) => {
                      const data = await readJsonResponse(await createAdminBackup({ adminPassword }));
                      setBackups(data.backups || []);
                    },
                    refresh: loadBackups,
                  })
                }
                StatCard={StatCard}
              />
            </div>
          ) : null}

          {!loading && activeTab === "calls" ? <AdminCallsTab /> : null}
          {!loading && activeTab === "moderation" ? <AdminModerationTab /> : null}
          {!loading && activeTab === "server" ? <AdminServerTab /> : null}

          {!loading && activeTab === "monitor" ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <ResourceMeter
                  label="CPU"
                  percent={systemHealth?.cpu?.percent || 0}
                  detail={`${systemHealth?.cpu?.cores || 0} cores / ${systemHealth?.cpu?.model || "unknown CPU"}`}
                  status={systemHealth?.cpu?.status}
                  icon={Globe}
                />
                <ResourceMeter
                  label={t("admin.monitor.memory")}
                  percent={systemHealth?.memory?.percent || 0}
                  detail={`${systemHealth?.memory?.usedLabel || "0 B"} of ${systemHealth?.memory?.totalLabel || "0 B"}`}
                  status={systemHealth?.memory?.status}
                  icon={Database}
                />
                <ResourceMeter
                  label={t("admin.monitor.disk")}
                  percent={systemHealth?.disk?.percent || 0}
                  detail={`${systemHealth?.disk?.usedLabel || "0 B"} of ${systemHealth?.disk?.totalLabel || "0 B"}`}
                  status={systemHealth?.disk?.status}
                  icon={File}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t("admin.monitor.uptime")} value={formatDuration(systemHealth?.runtime?.uptimeSeconds || 0)} detail={tf("admin.monitor.systemUptime", { duration: formatDuration(systemHealth?.runtime?.systemUptimeSeconds || 0) })} icon={Refresh} />
                <StatCard label={t("admin.monitor.runtime")} value={systemHealth?.runtime?.nodeVersion || "-"} detail={`${systemHealth?.runtime?.platform || "-"} / ${systemHealth?.runtime?.arch || "-"}`} icon={Settings} />
                <StatCard label={t("admin.monitor.database")} value={systemHealth?.services?.database?.sizeLabel || "0 B"} detail={systemHealth?.services?.database?.exists ? t("admin.monitor.dbFound") : t("admin.monitor.dbMissing")} icon={Database} />
                <StatCard label={t("admin.monitor.uploads")} value={systemHealth?.services?.uploads?.sizeLabel || "0 B"} detail={`${systemHealth?.services?.backups?.count || 0} backups stored`} icon={Download} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                  <h2 className="text-sm font-bold">{t("admin.monitor.securitySummary")}</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <StatCard label={t("admin.monitor.failedLogins")} value={securitySummary?.failedLogins24h || 0} detail={t("admin.monitor.last24h")} icon={Lock} />
                    <StatCard label={t("admin.monitor.bannedLogins")} value={securitySummary?.bannedLogins24h || 0} detail={t("admin.monitor.last24h")} icon={Ban} />
                    <StatCard label={t("admin.monitor.failedReauth")} value={securitySummary?.failedReauth24h || 0} detail={t("admin.monitor.adminPasswordChecks")} icon={ShieldCheck} />
                    <StatCard label={t("admin.monitor.sensitiveActions")} value={securitySummary?.sensitiveActions24h || 0} detail={`${securitySummary?.activeAdminSessions || 0} admin sessions`} icon={Settings} />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t("admin.monitor.topIps")}</h3>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {securitySummary?.topIps?.length ? securitySummary.topIps.map((item) => (
                        <div key={item.ip} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="font-semibold">{item.ip}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{item.count}</span>
                        </div>
                      )) : <p className="py-3 text-sm text-slate-500">{t("admin.monitor.noSecurityDay")}</p>}
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                  <h2 className="text-sm font-bold">{t("admin.monitor.recentSecurity")}</h2>
                  <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                    {securitySummary?.recentEvents?.length ? securitySummary.recentEvents.map((event) => (
                      <div key={`event-${event.id}`} className="py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold">{event.type}</p>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{event.created_at}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          @{event.username || "-"} / IP {event.ip_address || "-"}
                        </p>
                      </div>
                    )) : <EmptyState text={t("admin.monitor.noSecurityEvents")} />}
                  </div>
                </section>
              </div>

              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">{t("admin.monitor.sensitiveActions")}</h2>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                  {securitySummary?.recentSensitiveActions?.length ? securitySummary.recentSensitiveActions.map((item) => (
                    <div key={`sensitive-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-bold">
                          {item.action}
                          {!item.success ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{t("admin.audit.failed")}</span> : null}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tf("admin.monitor.auditMeta", { actor: item.actor_username || t("admin.common.system"), targetType: item.target_type || "-", targetId: item.target_id || "-", ip: item.ip_address || "-" })}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.created_at}</span>
                    </div>
                  )) : <EmptyState text={t("admin.monitor.noSensitiveActions")} />}
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "users" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_140px_140px_160px_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input value={userFilters.query} onChange={(event) => setUserFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))} placeholder={t("admin.common.searchUsers")} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900" />
                </div>
                <select value={userFilters.role} onChange={(event) => setUserFilters((prev) => ({ ...prev, role: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">{t("admin.users.allRoles")}</option>
                  {ADMIN_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select value={userFilters.status} onChange={(event) => setUserFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">{t("admin.users.allStatus")}</option>
                  <option value="active">{t("admin.users.statusActive")}</option>
                  <option value="banned">{t("admin.users.statusBanned")}</option>
                  <option value="recent">{t("admin.users.statusRecent")}</option>
                </select>
                <select value={userFilters.sort} onChange={(event) => setUserFilters((prev) => ({ ...prev, sort: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="newest">{t("admin.users.sortNewest")}</option>
                  <option value="username">{t("admin.users.sortUsername")}</option>
                  <option value="messages">{t("admin.users.sortMessages")}</option>
                  <option value="chats">{t("admin.users.sortChats")}</option>
                  <option value="last_seen">{t("admin.users.sortLastSeen")}</option>
                </select>
                <button type="button" onClick={() => void loadUsers()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">{t("admin.common.apply")}</button>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
                {selectedUserIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-amber-50 px-4 py-2 dark:border-white/10 dark:bg-amber-500/10">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-200">{tf("admin.common.selected", { count: selectedUserIds.length })}</span>
                    <button type="button" onClick={() => setSelectedUserIds([])} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold dark:border-white/10">{t("admin.common.clear")}</button>
                    <button
                      type="button"
                      onClick={() => confirmAction(adminAct("bulkBan", { count: selectedUserIds.length }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminUsers({ action: "ban", ids: selectedUserIds, adminPassword })); setSelectedUserIds([]); }, refresh: loadUsers }))}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                    ><Ban size={13} />{t("admin.common.ban")}</button>
                    <button
                      type="button"
                      onClick={() => confirmAction(adminAct("bulkUnban", { count: selectedUserIds.length }, { requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminUsers({ action: "unban", ids: selectedUserIds, adminPassword })); setSelectedUserIds([]); }, refresh: loadUsers }))}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10"
                    ><User size={13} />{t("admin.common.unban")}</button>
                    <button
                      type="button"
                      onClick={() => confirmAction(adminAct("bulkDeleteUsers", { count: selectedUserIds.length }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminUsers({ action: "delete", ids: selectedUserIds, adminPassword })); setSelectedUserIds([]); }, refresh: loadUsers }))}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                    ><Trash size={13} />{t("admin.common.delete")}</button>
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={users.length > 0 && selectedUserIds.length === users.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds(users.map((u) => u.id));
                              } else {
                                setSelectedUserIds([]);
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-500"
                          />
                        </th>
                        <th className="px-4 py-3">{t("admin.users.colUser")}</th>
                        <th className="px-4 py-3">{t("admin.users.colRole")}</th>
                        <th className="px-4 py-3">{t("admin.users.colStatus")}</th>
                        <th className="px-4 py-3">{t("admin.users.colActivity")}</th>
                        <th className="px-4 py-3 text-right">{t("admin.users.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                      {users.map((item) => (
                        <tr key={item.id} className={selectedUserIds.includes(item.id) ? "bg-emerald-50/50 dark:bg-emerald-500/5" : ""}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds((prev) => [...prev, item.id]);
                                } else {
                                  setSelectedUserIds((prev) => prev.filter((id) => id !== item.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => void openUserDetail(item)} className="flex items-center gap-3 text-left">
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"><User size={17} /></span>
                              <span>
                                <span className="block font-semibold">{item.nickname || item.username}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">@{item.username}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={item.role}
                              onChange={(event) => {
                                const nextRole = event.target.value;
                                confirmAction(adminAct("changeRole", { username: item.username, role: nextRole }, {
                                  requiresPassword: true,
                                  run: async ({ adminPassword }) =>
                                    readJsonResponse(await updateAdminUser(item.id, { role: nextRole, adminPassword })),
                                  refresh: loadUsers,
                                }));
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold dark:border-white/10 dark:bg-slate-900"
                            >
                              {ADMIN_ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            {item.envAdmin ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">{t("admin.common.envBadge")}</span> : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.banned ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>
                              {item.banned ? t("admin.users.statusBanned") : t("admin.users.statusActive")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{tf("admin.users.activityCount", { chats: item.chat_count, messages: item.message_count })}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => void openUserDetail(item)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold dark:border-white/10">{t("admin.users.detail")}</button>
                              <button type="button" onClick={() => confirmAction(adminAct(item.banned ? "unbanUser" : "banUser", { username: item.username }, { danger: !item.banned, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await updateAdminUser(item.id, { banned: !item.banned, adminPassword })), refresh: loadUsers }))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold dark:border-white/10"><Ban size={14} />{item.banned ? t("admin.common.unban") : t("admin.common.ban")}</button>
                              <button type="button" onClick={() => confirmAction(adminAct("resetPassword", { username: item.username }, { inputKey: "input", inputType: "password", minLength: 6, requiresPassword: true, run: async ({ value, adminPassword }) => readJsonResponse(await resetAdminUserPassword(item.id, { password: value, adminPassword })), refresh: loadUsers }))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold dark:border-white/10"><Lock size={14} />{t("admin.common.password")}</button>
                              <button type="button" onClick={() => confirmAction(adminAct("deleteUser", { username: item.username }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await deleteAdminUser(item.id, { adminPassword })), refresh: loadUsers }))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-semibold text-rose-600 dark:border-rose-500/30"><Trash size={14} />{t("admin.common.delete")}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pager pagination={userPagination} onPage={(page) => setUserFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "chats" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_140px_140px_160px_auto]">
                <input value={chatFilters.query} onChange={(event) => setChatFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))} placeholder={t("admin.common.searchChats")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900" />
                <select value={chatFilters.type} onChange={(event) => setChatFilters((prev) => ({ ...prev, type: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">{t("admin.chats.allTypes")}</option><option value="dm">{t("admin.chats.typeDm")}</option><option value="group">{t("admin.chats.typeGroup")}</option><option value="channel">{t("admin.chats.typeChannel")}</option><option value="saved">{t("admin.chats.typeSaved")}</option>
                </select>
                <select value={chatFilters.visibility} onChange={(event) => setChatFilters((prev) => ({ ...prev, visibility: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">{t("admin.chats.anyVisibility")}</option><option value="public">{t("admin.chatDetail.public")}</option><option value="private">{t("admin.chatDetail.private")}</option>
                </select>
                <select value={chatFilters.sort} onChange={(event) => setChatFilters((prev) => ({ ...prev, sort: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="newest">{t("admin.chats.sortNewest")}</option><option value="name">{t("admin.chats.sortName")}</option><option value="members">{t("admin.chats.sortMembers")}</option><option value="messages">{t("admin.chats.sortMessages")}</option>
                </select>
                <button type="button" onClick={() => void loadChats()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">{t("admin.common.apply")}</button>
              </div>
              {selectedChatIds.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-200">{tf("admin.common.selected", { count: selectedChatIds.length })}</span>
                  <button type="button" onClick={() => setSelectedChatIds([])} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold dark:border-white/10">{t("admin.common.clear")}</button>
                  <button
                    type="button"
                    onClick={() => confirmAction(adminAct("bulkDeleteChats", { count: selectedChatIds.length }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminChats({ action: "delete", ids: selectedChatIds, adminPassword })); setSelectedChatIds([]); }, refresh: loadChats }))}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                  ><Trash size={13} />{t("admin.common.deleteAll")}</button>
                </div>
              ) : null}
              <div className="grid gap-3">
                {chats.length ? chats.map((chat) => (
                  <section key={chat.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950 ${selectedChatIds.includes(chat.id) ? "ring-2 ring-emerald-400/50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedChatIds.includes(chat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChatIds((prev) => [...prev, chat.id]);
                          } else {
                            setSelectedChatIds((prev) => prev.filter((id) => id !== chat.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-500"
                      />
                      <div>
                        <p className="font-bold">{chat.name || `${chat.type} #${chat.id}`}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{tf("admin.chats.meta", { type: chat.type, visibility: chat.group_visibility || t("admin.chatDetail.private"), username: chat.group_username || t("admin.maintenance.noPublicUsername"), members: chat.member_count, messages: chat.message_count })}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {["group", "channel"].includes(String(chat.type || "").toLowerCase()) ? (
                        <button type="button" onClick={() => void openChatDetail(chat)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-white/10"><Pencil size={15} />{t("admin.users.detail")}</button>
                      ) : null}
                      <button type="button" onClick={() => confirmAction(adminAct("deleteChat", { id: chat.id }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await deleteAdminChat(chat.id, { adminPassword })), refresh: loadChats }))} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-600 dark:border-rose-500/30"><Trash size={15} />{t("admin.common.deleteChat")}</button>
                    </div>
                  </section>
                )) : <EmptyState text={t("admin.common.noChats")} />}
              </div>
              <Pager pagination={chatPagination} onPage={(page) => setChatFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "files" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_140px_auto]">
                <input value={fileFilters.query} onChange={(event) => setFileFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))} placeholder={t("admin.common.searchFiles")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900" />
                <select value={fileFilters.kind} onChange={(event) => setFileFilters((prev) => ({ ...prev, kind: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">{t("admin.files.allKinds")}</option><option value="image">{t("admin.files.kindImage")}</option><option value="video">{t("admin.files.kindVideo")}</option><option value="audio">{t("admin.files.kindAudio")}</option><option value="file">{t("admin.files.kindFile")}</option>
                </select>
                <button type="button" onClick={() => void loadFiles()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">{t("admin.common.apply")}</button>
              </div>
              <div className="grid gap-3">
                {files.length ? files.map((file) => (
                  <section key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                    <div className="min-w-0"><p className="truncate font-bold">{file.original_name || file.stored_name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{file.size_label} / {file.mime_type || file.kind || "file"} / @{file.owner_username || "unknown"}</p></div>
                    <button type="button" onClick={() => confirmAction(adminAct("deleteFile", { name: file.original_name || file.stored_name }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await deleteAdminFile(file.id, { adminPassword })), refresh: loadFiles }))} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-600 dark:border-rose-500/30"><Trash size={15} />{t("admin.common.delete")}</button>
                  </section>
                )) : <EmptyState text={t("admin.common.noFiles")} />}
              </div>
              <Pager pagination={filePagination} onPage={(page) => setFileFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "broadcast" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">{t("admin.broadcast.title")}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t("admin.broadcast.hint")}
                </p>
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.broadcast.target")}</span>
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                      >
                        <option value="all">{t("admin.broadcast.targetAll")}</option>
                        <option value="online">{t("admin.broadcast.targetOnline")}</option>
                        <option value="role">{t("admin.broadcast.targetRole")}</option>
                      </select>
                    </label>
                    {broadcastTarget === "role" ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.broadcast.role")}</span>
                        <select
                          value={broadcastRole}
                          onChange={(e) => setBroadcastRole(e.target.value)}
                          className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                        >
                          <option value="">{t("admin.broadcast.selectRole")}</option>
                          {ADMIN_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("admin.broadcast.message")}</span>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      rows={4}
                      placeholder={t("admin.broadcast.placeholder")}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {tf("admin.common.characters", { count: broadcastMessage.length })}
                    </span>
                    <button
                      type="button"
                      disabled={!broadcastMessage.trim()}
                      onClick={() =>
                        confirmAction({
                          ...adminAct("sendBroadcast"),
                          body: tf("admin.actions.sendBroadcast.body"),
                          requiresPassword: true,
                          run: async ({ adminPassword }) => {
                            const data = await readJsonResponse(
                              await sendAdminBroadcast({
                                message: broadcastMessage,
                                targetGroup: broadcastTarget,
                                targetRole: broadcastRole,
                                adminPassword,
                              }),
                            );
                            setBroadcastResult(data);
                            setBroadcastMessage("");
                          },
                          refresh: () => Promise.resolve(),
                        })
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Globe size={16} />{t("admin.broadcast.send")}
                    </button>
                  </div>
                </div>
                {broadcastResult ? (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {tf("admin.broadcast.delivered", { delivered: broadcastResult.delivered, total: broadcastResult.total })}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "export" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">{t("admin.export.title")}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t("admin.export.hint")}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {exportTypes.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.type} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <Icon size={18} className="text-emerald-500" />
                          <p className="text-sm font-bold">{t(item.labelKey)}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(item.descKey)}</p>
                        <div className="mt-3 flex gap-2">
                          <a
                            href={getAdminExportUrl(item.type, "csv")}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-white/10"
                          >
                            <Download size={13} />{t("admin.export.formatCsv")}
                          </a>
                          <a
                            href={getAdminExportUrl(item.type, "json")}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-white/10"
                          >
                            <Download size={13} />{t("admin.export.formatJson")}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "analytics" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold">{t("admin.analytics.title")}</h2>
                <div className="flex items-center gap-2">
                  <select value={analyticsDays} onChange={(e) => setAnalyticsDays(Number(e.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                    <option value={7}>{tf("admin.analytics.days", { count: 7 })}</option>
                    <option value={14}>{tf("admin.analytics.days", { count: 14 })}</option>
                    <option value={30}>{tf("admin.analytics.days", { count: 30 })}</option>
                    <option value={60}>{tf("admin.analytics.days", { count: 60 })}</option>
                    <option value={90}>{tf("admin.analytics.days", { count: 90 })}</option>
                  </select>
                  <button type="button" onClick={() => void loadAnalytics(analyticsDays)} className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-white/10">{t("admin.refresh")}</button>
                  {analytics ? (
                    <button type="button" onClick={() => exportAnalyticsCsv(analytics)} className="h-9 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">{t("admin.exportCsv")}</button>
                  ) : null}
                </div>
              </div>
              {analyticsLoading ? <EmptyState text={t("admin.analytics.loading")} /> : null}
              {!analyticsLoading && analytics ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    <StatCard label={t("admin.analytics.totalUsers")} value={analytics.summary?.totalUsers || 0} icon={Users} />
                    <StatCard label={t("admin.analytics.newToday")} value={analytics.summary?.newUsersToday || 0} icon={UserPlus} />
                    <StatCard label={t("admin.analytics.onlineNow")} value={analytics.summary?.onlineNow || 0} icon={Globe} />
                    <StatCard label={t("admin.analytics.totalMessages")} value={analytics.summary?.totalMessages || 0} icon={Database} />
                    <StatCard label={t("admin.analytics.messagesToday")} value={analytics.summary?.messagesToday || 0} icon={Chat} />
                    <StatCard label={t("admin.analytics.activeToday")} value={analytics.summary?.activeUsersToday || 0} icon={User} />
                    <StatCard label={t("admin.analytics.totalCalls")} value={analytics.summary?.totalCalls || 0} icon={Globe} />
                    <StatCard label={t("admin.analytics.callsToday")} value={analytics.summary?.callsToday || 0} icon={Globe} />
                    <StatCard label={t("admin.analytics.storageUsed")} value={formatStorageBytes(analytics.summary?.storageBytes || 0)} icon={File} />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                      <h3 className="text-sm font-bold">{tf("admin.analytics.userGrowth", { days: analyticsDays })}</h3>
                      <div className="mt-3">
                        <AdminBarChart items={analytics.userGrowth || []} colorClass="bg-emerald-500" />
                      </div>
                    </section>
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                      <h3 className="text-sm font-bold">{tf("admin.analytics.messagesPerDay", { days: analyticsDays })}</h3>
                      <div className="mt-3">
                        <AdminBarChart items={analytics.messagesPerDay || []} colorClass="bg-indigo-500" />
                      </div>
                    </section>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                      <h3 className="text-sm font-bold">{tf("admin.analytics.callsPerDay", { days: analyticsDays })}</h3>
                      <div className="mt-3">
                        <AdminBarChart items={analytics.callsPerDay || []} colorClass="bg-sky-500" />
                      </div>
                    </section>
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                      <h3 className="text-sm font-bold">{tf("admin.analytics.filesPerDay", { days: analyticsDays })}</h3>
                      <div className="mt-3">
                        <AdminBarChart items={analytics.filesPerDay || []} colorClass="bg-violet-500" />
                      </div>
                    </section>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                      <h3 className="text-sm font-bold">{t("admin.analytics.hourlyActivity")}</h3>
                      <div className="mt-3 flex items-end gap-1" style={{ height: "80px" }}>
                        {Array.from({ length: 24 }, (_, h) => {
                          const item = analytics.hourlyActivity?.find((a) => a.hour === h);
                          const count = item?.count || 0;
                          const max = Math.max(1, ...(analytics.hourlyActivity || []).map((a) => a.count));
                          const height = Math.max(4, (count / max) * 72);
                          return <div key={h} title={`${h}:00 — ${count}`} className="flex-1 rounded-t bg-amber-400 dark:bg-amber-500" style={{ height: `${height}px` }} />;
                        })}
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
                    </section>
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                      <h3 className="text-sm font-bold">{t("admin.analytics.topUsers")}</h3>
                      <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                        {analytics.topUsers?.length ? analytics.topUsers.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                              <span className="font-semibold">{item.nickname || item.username}</span>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">{tf("admin.analytics.messagesCount", { count: item.message_count })}</span>
                          </div>
                        )) : <p className="text-sm text-slate-500">{t("admin.noData")}</p>}
                      </div>
                    </section>
                  </div>
                  <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                    <h3 className="text-sm font-bold">{t("admin.analytics.topChats")}</h3>
                    <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                      {analytics.topChats?.length ? analytics.topChats.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                            <span className="font-semibold">{item.name || `${item.type} #${item.id}`}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{item.type}</span>
                          </div>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">{tf("admin.analytics.messagesCount", { count: item.message_count })}</span>
                        </div>
                      )) : <p className="text-sm text-slate-500">{t("admin.noData")}</p>}
                    </div>
                  </section>
                </div>
              ) : !analyticsLoading ? <EmptyState text={t("admin.analytics.empty")} /> : null}
            </div>
          ) : null}

          {!loading && activeTab === "scheduled" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">{t("admin.scheduled.title")}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("admin.scheduled.hint")}</p>
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-500">{t("admin.scheduled.targetChat")}</span>
                      <input value={schedChatId} onChange={(e) => setSchedChatId(e.target.value)} placeholder={t("admin.scheduled.searchChat")} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                      {chats.length > 0 && schedChatId !== "" ? (
                        <div className="mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
                          {chats.filter((c) => !schedChatId || String(c.id).includes(schedChatId) || (c.name || "").toLowerCase().includes(schedChatId.toLowerCase()) || (c.group_username || "").toLowerCase().includes(schedChatId.toLowerCase())).slice(0, 10).map((c) => (
                            <button key={c.id} type="button" onClick={() => setSchedChatId(String(c.id))} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 ${String(c.id) === schedChatId ? "bg-emerald-50 font-bold dark:bg-emerald-500/10" : ""}`}>
                              <span className="truncate">{c.name || `${c.type} #${c.id}`}</span>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">#{c.id} {c.type}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-500">{t("admin.scheduled.sendAt")}</span>
                      <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <input value={schedBody} onChange={(e) => setSchedBody(e.target.value)} placeholder={t("admin.scheduled.messagePlaceholder")} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                    <button type="button" disabled={!schedChatId || !schedBody || !schedAt} onClick={async () => { try { await readJsonResponse(await createAdminScheduledMessage({ chatId: Number(schedChatId), body: schedBody, scheduledAt: new Date(schedAt).toISOString() })); setSchedBody(""); setSchedAt(""); const data = await readJsonResponse(await fetchAdminScheduledMessages()); setScheduledMessages(data.messages || []); } catch (err) { setError(err?.message || t("admin.scheduled.scheduleFailed")); } }} className="h-10 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white disabled:opacity-50">{t("admin.scheduled.schedule")}</button>
                  </div>
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">{t("admin.scheduled.pending")}</h3>
                  <button type="button" onClick={async () => { try { const data = await readJsonResponse(await fetchAdminScheduledMessages()); setScheduledMessages(data.messages || []); } catch (err) { setError(err?.message || t("admin.scheduled.loadFailed")); } }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10"><Refresh size={13} />{t("admin.refresh")}</button>
                </div>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                  {scheduledMessages.length ? scheduledMessages.map((msg) => (
                    <div key={msg.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold">{tf("admin.scheduled.chatRow", { id: msg.chat_id, time: msg.scheduled_at })}</p>
                        <p className="mt-1 max-w-md truncate text-xs text-slate-500 dark:text-slate-400">{msg.body}</p>
                      </div>
                      <button type="button" onClick={async () => { try { await readJsonResponse(await deleteAdminScheduledMessage(msg.id)); setScheduledMessages((prev) => prev.filter((m) => m.id !== msg.id)); } catch (err) { setError(err?.message || t("admin.scheduled.deleteFailed")); } }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"><Trash size={13} />{t("admin.scheduled.cancel")}</button>
                    </div>
                  )) : <EmptyState text={t("admin.scheduled.empty")} />}
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "branding" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">{t("admin.branding.title")}</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("admin.branding.hint")}</p>
                  </div>
                  <button type="button" onClick={async () => { try { const data = await readJsonResponse(await fetchAdminBranding()); setBranding(data.branding || {}); setBrandingForm(data.branding || { appName: "", primaryColor: "", accentColor: "", logoUrl: "", welcomeMessage: "", footerText: "" }); } catch (err) { setError(err?.message || t("admin.branding.loadFailed")); } }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10">{t("admin.common.load")}</button>
                </div>
                {branding !== null ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-bold uppercase text-slate-500">{t("admin.branding.appName")}</span>
                        <input value={brandingForm.appName || ""} onChange={(e) => setBrandingForm((p) => ({ ...p, appName: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase text-slate-500">{t("admin.branding.logo")}</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input value={brandingForm.logoUrl || ""} onChange={(e) => setBrandingForm((p) => ({ ...p, logoUrl: e.target.value }))} placeholder={t("admin.branding.logoPlaceholder")} className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                          <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:border-emerald-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                            <Download size={14} />{t("admin.common.upload")}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBrandingForm((p) => ({ ...p, logoUrl: reader.result })); reader.readAsDataURL(file); e.target.value = ""; }} />
                          </label>
                        </div>
                        {brandingForm.logoUrl ? <img src={brandingForm.logoUrl} alt={t("admin.branding.logoPreview")} className="mt-2 h-12 w-12 rounded-lg border border-slate-200 object-contain dark:border-white/10" /> : null}
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase text-slate-500">{t("admin.branding.primaryColor")}</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input type="color" value={brandingForm.primaryColor || "#10b981"} onChange={(e) => setBrandingForm((p) => ({ ...p, primaryColor: e.target.value }))} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 p-1 dark:border-white/10" />
                          <input value={brandingForm.primaryColor || ""} onChange={(e) => setBrandingForm((p) => ({ ...p, primaryColor: e.target.value }))} placeholder="#10b981" className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                          <div className="h-8 w-8 rounded-full border border-slate-200 dark:border-white/10" style={{ backgroundColor: brandingForm.primaryColor || "#10b981" }} />
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase text-slate-500">{t("admin.branding.accentColor")}</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input type="color" value={brandingForm.accentColor || "#6366f1"} onChange={(e) => setBrandingForm((p) => ({ ...p, accentColor: e.target.value }))} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 p-1 dark:border-white/10" />
                          <input value={brandingForm.accentColor || ""} onChange={(e) => setBrandingForm((p) => ({ ...p, accentColor: e.target.value }))} placeholder="#6366f1" className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                          <div className="h-8 w-8 rounded-full border border-slate-200 dark:border-white/10" style={{ backgroundColor: brandingForm.accentColor || "#6366f1" }} />
                        </div>
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-500">{t("admin.branding.welcomeMessage")}</span>
                      <textarea value={brandingForm.welcomeMessage || ""} onChange={(e) => setBrandingForm((p) => ({ ...p, welcomeMessage: e.target.value }))} rows={2} placeholder={t("admin.branding.welcomePlaceholder")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-slate-500">{t("admin.branding.footerText")}</span>
                      <input value={brandingForm.footerText || ""} onChange={(e) => setBrandingForm((p) => ({ ...p, footerText: e.target.value }))} placeholder={t("admin.branding.footerPlaceholder")} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                    </label>
                    <button type="button" onClick={() => confirmAction(adminAct("saveBranding", {}, { requiresPassword: true, run: async ({ adminPassword }) => { const data = await readJsonResponse(await updateAdminBranding({ ...brandingForm, adminPassword })); setBranding(data.branding || {}); setBrandingForm(data.branding || {}); }, refresh: () => Promise.resolve() }))} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white"><Pencil size={15} />{t("admin.actions.saveBranding.confirm")}</button>
                  </div>
                ) : <EmptyState text={t("admin.branding.empty")} />}
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "webhooks" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">{t("admin.webhooks.createTitle")}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("admin.webhooks.createHint")}</p>
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={webhookForm.name} onChange={(e) => setWebhookForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("admin.webhooks.namePlaceholder")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                    <input value={webhookForm.url} onChange={(e) => setWebhookForm((p) => ({ ...p, url: e.target.value }))} placeholder={t("admin.webhooks.urlPlaceholder")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                  </div>
                  <input value={webhookForm.secret} onChange={(e) => setWebhookForm((p) => ({ ...p, secret: e.target.value }))} placeholder={t("admin.webhooks.secretPlaceholder")} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">{t("admin.webhooks.events")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableWebhookEvents.map((ev) => (
                        <label key={ev} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10">
                          <input type="checkbox" checked={webhookForm.events.includes(ev)} onChange={(e) => setWebhookForm((p) => ({ ...p, events: e.target.checked ? [...p.events, ev] : p.events.filter((x) => x !== ev) }))} />
                          {ev}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="button" disabled={!webhookForm.name || !webhookForm.url || !webhookForm.events.length} onClick={async () => { try { await readJsonResponse(await createAdminWebhook(webhookForm)); setWebhookForm({ name: "", url: "", secret: "", events: [] }); const data = await readJsonResponse(await fetchAdminWebhooks()); setWebhooks(data.webhooks || []); } catch (err) { setError(err?.message || t("admin.common.genericFailed")); } }} className="h-10 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white disabled:opacity-50">{t("admin.webhooks.create")}</button>
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">{t("admin.webhooks.activeTitle")}</h3>
                  <button type="button" onClick={async () => { try { const data = await readJsonResponse(await fetchAdminWebhooks()); setWebhooks(data.webhooks || []); setAvailableWebhookEvents(data.availableEvents || []); } catch (err) { setError(err?.message || t("admin.common.genericFailed")); } }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10"><Refresh size={13} />{t("admin.common.load")}</button>
                </div>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                  {webhooks.length ? webhooks.map((wh) => (
                    <div key={wh.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold">{wh.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${wh.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{wh.enabled ? t("admin.webhooks.statusActive") : t("admin.webhooks.statusDisabled")}</span></p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{wh.url}</p>
                        <p className="text-xs text-slate-400">{Array.isArray(wh.events) ? wh.events.join(", ") : ""} {wh.last_status ? `/ ${tf("admin.webhooks.lastStatus", { status: wh.last_status })}` : ""}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={async () => { try { const data = await readJsonResponse(await testAdminWebhook(wh.id)); setError(data.ok ? "" : data.error || t("admin.webhooks.testFailed")); const r = await readJsonResponse(await fetchAdminWebhooks()); setWebhooks(r.webhooks || []); } catch (err) { setError(err?.message || t("admin.webhooks.testFailed")); } }} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10">{t("admin.common.test")}</button>
                        <button type="button" onClick={async () => { try { await readJsonResponse(await updateAdminWebhook(wh.id, { enabled: !wh.enabled })); const data = await readJsonResponse(await fetchAdminWebhooks()); setWebhooks(data.webhooks || []); } catch (err) { setError(err?.message || t("admin.common.genericFailed")); } }} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10">{wh.enabled ? t("admin.common.disable") : t("admin.common.enable")}</button>
                        <button type="button" onClick={() => confirmAction(adminAct("deleteWebhook", { name: wh.name }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await deleteAdminWebhook(wh.id, { adminPassword })); const data = await readJsonResponse(await fetchAdminWebhooks()); setWebhooks(data.webhooks || []); }, refresh: () => Promise.resolve() }))} className="h-8 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"><Trash size={13} /></button>
                      </div>
                    </div>
                  )) : <EmptyState text={t("admin.webhooks.empty")} />}
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "bots" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">{t("admin.bots.createTitle")}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("admin.bots.createHint")}</p>
                <div className="mt-4 space-y-3">
                  <input value={botForm.name} onChange={(e) => setBotForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("admin.bots.namePlaceholder")} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">{t("admin.bots.permissions")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableBotPermissions.map((perm) => (
                        <label key={perm} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10">
                          <input type="checkbox" checked={botForm.permissions.includes(perm)} onChange={(e) => setBotForm((p) => ({ ...p, permissions: e.target.checked ? [...p.permissions, perm] : p.permissions.filter((x) => x !== perm) }))} />
                          {perm}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="button" disabled={!botForm.name || !botForm.permissions.length} onClick={async () => { try { const data = await readJsonResponse(await createAdminBot(botForm)); setNewBotToken(data.token || ""); setBotForm({ name: "", permissions: [] }); const r = await readJsonResponse(await fetchAdminBots()); setBots(r.bots || []); } catch (err) { setError(err?.message || t("admin.common.genericFailed")); } }} className="h-10 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white disabled:opacity-50">{t("admin.bots.create")}</button>
                </div>
                {newBotToken ? (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-200">{t("admin.bots.tokenCreated")}</p>
                    <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs font-mono dark:bg-slate-900">{newBotToken}</code>
                  </div>
                ) : null}
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">{t("admin.bots.activeTitle")}</h3>
                  <button type="button" onClick={async () => { try { const data = await readJsonResponse(await fetchAdminBots()); setBots(data.bots || []); setAvailableBotPermissions(data.availablePermissions || []); } catch (err) { setError(err?.message || t("admin.common.genericFailed")); } }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10"><Refresh size={13} />{t("admin.common.load")}</button>
                </div>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                  {bots.length ? bots.map((bot) => (
                    <div key={bot.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold">{bot.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${bot.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{bot.enabled ? t("admin.webhooks.statusActive") : t("admin.webhooks.statusDisabled")}</span></p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tf("admin.bots.tokenLine", { token: bot.token, permissions: Array.isArray(bot.permissions) ? bot.permissions.join(", ") : "" })}</p>
                        {bot.last_used_at ? <p className="text-xs text-slate-400">{tf("admin.bots.lastUsed", { at: bot.last_used_at })}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={async () => { try { await readJsonResponse(await updateAdminBot(bot.id, { enabled: !bot.enabled })); const data = await readJsonResponse(await fetchAdminBots()); setBots(data.bots || []); } catch (err) { setError(err?.message || t("admin.common.genericFailed")); } }} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10">{bot.enabled ? t("admin.common.disable") : t("admin.common.enable")}</button>
                        <button type="button" onClick={() => confirmAction(adminAct("deleteBot", { name: bot.name }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await deleteAdminBot(bot.id, { adminPassword })); const data = await readJsonResponse(await fetchAdminBots()); setBots(data.bots || []); }, refresh: () => Promise.resolve() }))} className="h-8 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"><Trash size={13} /></button>
                      </div>
                    </div>
                  )) : <EmptyState text={t("admin.bots.empty")} />}
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <h3 className="text-sm font-bold">{t("admin.bots.docsTitle")}</h3>
                <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p><code className="rounded bg-slate-100 px-1 dark:bg-white/10">POST /api/bot/send-message</code> — Send a message to a chat <span className="text-slate-400">(send_message)</span></p>
                  <p><code className="rounded bg-slate-100 px-1 dark:bg-white/10">GET /api/bot/chats</code> — List all chats <span className="text-slate-400">(read_chats)</span></p>
                  <p><code className="rounded bg-slate-100 px-1 dark:bg-white/10">GET /api/bot/chats/:id/messages</code> — Read chat messages <span className="text-slate-400">(read_messages)</span></p>
                  <p><code className="rounded bg-slate-100 px-1 dark:bg-white/10">GET /api/bot/users</code> — List all users <span className="text-slate-400">(read_users)</span></p>
                  <p className="mt-2 text-slate-400">Header: <code className="rounded bg-slate-100 px-1 dark:bg-white/10">Authorization: Bearer bx_...</code></p>
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "audit" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_180px_150px_auto]">
                <input value={auditFilters.action} onChange={(event) => setAuditFilters((prev) => ({ ...prev, action: event.target.value, page: 1 }))} placeholder={t("admin.audit.actionFilter")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                <input value={auditFilters.actor} onChange={(event) => setAuditFilters((prev) => ({ ...prev, actor: event.target.value, page: 1 }))} placeholder={t("admin.audit.actorFilter")} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                <select value={auditFilters.targetType} onChange={(event) => setAuditFilters((prev) => ({ ...prev, targetType: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">{t("admin.audit.allTargets")}</option><option value="user">{t("admin.audit.targetUser")}</option><option value="chat">{t("admin.audit.targetChat")}</option><option value="file">{t("admin.audit.targetFile")}</option><option value="backup">{t("admin.audit.targetBackup")}</option><option value="session">{t("admin.audit.targetSession")}</option>
                </select>
                <button type="button" onClick={() => void loadAudit()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">{t("admin.common.apply")}</button>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {auditLogs.length ? auditLogs.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="font-bold">
                          {log.action}
                          {!log.success ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{t("admin.audit.failed")}</span> : null}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tf("admin.audit.meta", { actor: log.actor_username || t("admin.common.system"), targetType: log.target_type || "-", targetId: log.target_id || "-", ip: log.ip_address || "-" })}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{log.created_at}</span>
                    </div>
                  )) : <EmptyState text={t("admin.audit.empty")} />}
                </div>
              </div>
              <Pager pagination={auditPagination} onPage={(page) => setAuditFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "maintenance" ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t("admin.maintenance.accountCreation")} value={settings?.accountCreation ? t("admin.common.enabled") : t("admin.common.disabled")} detail={t("admin.maintenance.accountCreationDetail")} icon={Settings} />
                <StatCard label={t("admin.maintenance.messageLimit")} value={settings?.messageMaxChars || 0} detail={t("admin.maintenance.messageLimitDetail")} icon={Database} />
                <StatCard label={t("admin.maintenance.storageEncryption")} value={settings?.storageEncryption ? t("admin.common.enabled") : t("admin.common.disabled")} detail={t("admin.maintenance.storageEncryptionDetail")} icon={Lock} />
                <StatCard label={t("admin.maintenance.requiredChannels")} value={requiredChannels.length} detail={t("admin.maintenance.requiredChannelsDetail")} icon={Chat} />
              </div>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">{t("admin.maintenance.requiredChannels")}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("admin.maintenance.requiredHintAuto")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction(adminAct("saveRequiredChannels", {}, {
                          requiresPassword: true,
                          run: async ({ adminPassword }) => {
                            await readJsonResponse(
                              await updateAdminRequiredChannels({
                                chatIds: selectedRequiredChannelIds,
                                adminPassword,
                              }),
                            );
                          },
                          refresh: loadRequiredChannels,
                        }))
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white"
                    >
                      <Pencil size={16} />{t("admin.maintenance.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction({
                          ...adminAct("saveRequiredApply"),
                          confirmLabel: t("admin.maintenance.saveApply"),
                          requiresPassword: true,
                          run: async ({ adminPassword }) => {
                            await readJsonResponse(
                              await updateAdminRequiredChannels({
                                chatIds: selectedRequiredChannelIds,
                                applyNow: true,
                                adminPassword,
                              }),
                            );
                          },
                          refresh: loadRequiredChannels,
                        })
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                    >
                      <UserPlus size={16} />{t("admin.maintenance.saveApply")}
                    </button>
                  </div>
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
                  {availableRequiredChannels.length ? availableRequiredChannels.map((channel) => {
                    const checked = selectedRequiredChannelSet.has(Number(channel.id));
                    return (
                      <label key={channel.id} className="flex cursor-pointer items-center justify-between gap-3 py-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{channel.name || `Channel #${channel.id}`}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {channel.group_username ? `@${String(channel.group_username).replace(/^@/, "")}` : t("admin.maintenance.noPublicUsername")} / {tf("admin.maintenance.members", { count: channel.member_count || 0 })}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRequiredChannel(channel.id)}
                          className="h-5 w-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                        />
                      </label>
                    );
                  }) : <p className="py-4 text-sm text-slate-500">{t("admin.maintenance.noChannelHint")}</p>}
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-sm font-bold">{t("admin.maintenance.backups")}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{t("admin.maintenance.backupsHint")}</p></div>
                  <button type="button" onClick={() => confirmAction(adminAct("createBackup", {}, { requiresPassword: true, run: async ({ adminPassword }) => { const data = await readJsonResponse(await createAdminBackup({ adminPassword })); setBackups(data.backups || []); }, refresh: loadBackups }))} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white"><Download size={16} />{t("admin.dashboard.createBackup")}</button>
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
                  {backups.length ? backups.map((backup) => (
                    <div key={backup.name} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div><p className="font-semibold">{backup.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{backup.sizeLabel} / {backup.createdAt}</p></div>
                      <div className="flex gap-2">
                        <a href={getAdminBackupDownloadUrl(backup.name)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10"><Download size={14} />{t("admin.common.download")}</a>
                        <button type="button" onClick={() => confirmAction(adminAct("deleteBackup", { name: backup.name }, { danger: true, requiresPassword: true, run: async ({ adminPassword }) => { const data = await readJsonResponse(await deleteAdminBackup(backup.name, { adminPassword })); setBackups(data.backups || []); }, refresh: loadBackups }))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"><Trash size={14} />{t("admin.common.delete")}</button>
                      </div>
                    </div>
                  )) : <p className="py-4 text-sm text-slate-500">{t("admin.maintenance.noBackups")}</p>}
                </div>
              </section>
            </div>
          ) : null}
      </AdminLayout>

      <ActionModal
        key={action?.title || "admin-action"}
        action={action}
        busy={Boolean(busyKey)}
        onClose={() => setAction(null)}
        onConfirm={(payload) => {
          if (!action) return;
          void runAction(
            action.title || "action",
            async () => {
              await action.run(payload);
            },
            action.refresh || loadAll,
          );
        }}
      />
      <UserDetailDrawer
        detail={userDetail}
        onClose={() => { setUserDetail(null); setUserActivity(null); }}
        userActivity={userActivity}
        onLoadActivity={async (detailUser) => {
          try {
            const data = await readJsonResponse(await fetchAdminUserActivity(detailUser.id));
            setUserActivity(data);
          } catch (err) {
            setError(err?.message || "Unable to load user activity.");
          }
        }}
        onRevokeSession={(detailUser, session) =>
          confirmAction(adminAct("revokeSession", { id: session.id, username: detailUser.username }, {
            danger: true,
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await deleteAdminUserSession(detailUser.id, session.id, { adminPassword }));
              setUserDetail(await readJsonResponse(await fetchAdminUserDetail(detailUser.id)));
            },
            refresh: loadUsers,
          }))
        }
        onRevokeAllSessions={(detailUser) =>
          confirmAction(adminAct("logoutAllSessions", { username: detailUser.username }, {
            danger: true,
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await deleteAdminUserSessions(detailUser.id, { adminPassword }));
              setUserDetail(await readJsonResponse(await fetchAdminUserDetail(detailUser.id)));
            },
            refresh: loadUsers,
          }))
        }
        onUpdateUploadPolicy={async (detailUser, payload) => {
          try {
            await readJsonResponse(await updateAdminUser(detailUser.id, payload));
            setUserDetail(await readJsonResponse(await fetchAdminUserDetail(detailUser.id)));
          } catch (err) {
            setError(err?.message || t("admin.errors.uploadPolicy"));
          }
        }}
      />
      <ChatDetailDrawer
        key={
          chatDetail?.chat
            ? `${chatDetail.chat.id}-${chatDetail.chat.group_visibility}-${chatDetail.chat.group_username}-${chatDetail.chat.allow_member_invites}`
            : "chat-detail"
        }
        detail={chatDetail}
        onClose={() => setChatDetail(null)}
        onSaveSettings={(payload) =>
          confirmAction(adminAct("updateChatSettings", { name: chatDetail?.chat?.name || `chat #${chatDetail?.chat?.id}` }, {
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await updateAdminChatSettings(chatDetail.chat.id, { ...payload, adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          }))
        }
        onAddMember={(payload) =>
          confirmAction(adminAct("addChatMember", { username: payload.username, role: payload.role }, {
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await addAdminChatMember(chatDetail.chat.id, { ...payload, adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          }))
        }
        onChangeMemberRole={(member, role) =>
          confirmAction(adminAct("changeMemberRole", { username: member.username, role }, {
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await updateAdminChatMember(chatDetail.chat.id, member.id, { role, adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          }))
        }
        onRemoveMember={(member) =>
          confirmAction(adminAct("removeChatMember", { username: member.username }, {
            confirmLabel: t("admin.actions.removeChatMember.confirm"),
            danger: true,
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await deleteAdminChatMember(chatDetail.chat.id, member.id, { adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          }))
        }
      />
    </>
  );
}
