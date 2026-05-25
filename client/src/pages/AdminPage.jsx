import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addAdminChatMember,
  bulkAdminChats,
  bulkAdminUsers,
  createAdminBackup,
  deleteAdminBackup,
  deleteAdminChat,
  deleteAdminChatMember,
  deleteAdminFile,
  deleteAdminUser,
  deleteAdminUserSession,
  deleteAdminUserSessions,
  fetchAdminAuditLogs,
  fetchAdminBackups,
  fetchAdminChatDetail,
  fetchAdminChats,
  fetchAdminFiles,
  fetchAdminOverview,
  fetchAdminRequiredChannels,
  fetchAdminSecuritySummary,
  fetchAdminSettings,
  fetchAdminSystemHealth,
  fetchAdminUserActivity,
  fetchAdminUserDetail,
  fetchAdminUsers,
  getAdminBackupDownloadUrl,
  getAdminExportUrl,
  resetAdminUserPassword,
  sendAdminBroadcast,
  updateAdminChatMember,
  updateAdminChatSettings,
  updateAdminRequiredChannels,
  updateAdminUser,
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

const PAGE_SIZE = 25;
const ADMIN_ROLE_OPTIONS = ["owner", "admin", "moderator", "support", "user"];
const ADMIN_ACCESS_ROLES = ADMIN_ROLE_OPTIONS.filter((role) => role !== "user");
const CHAT_ROLE_OPTIONS = ["owner", "admin", "moderator", "member"];

const tabs = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "monitor", label: "Monitor", icon: Globe },
  { id: "users", label: "Users", icon: Users },
  { id: "chats", label: "Chats", icon: Chat },
  { id: "files", label: "Files", icon: File },
  { id: "broadcast", label: "Broadcast", icon: Globe },
  { id: "export", label: "Export", icon: Download },
  { id: "audit", label: "Audit", icon: ShieldCheck },
  { id: "maintenance", label: "Maintenance", icon: Settings },
];

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
  if (!pagination || Number(pagination.totalPages || 1) <= 1) return null;
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950">
      <span className="font-medium text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages} / {pagination.total} items
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
              Admin password
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
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => onConfirm({ value, adminPassword })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              action.danger ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {busy ? "Working..." : action.confirmLabel || "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}

function UserDetailDrawer({ detail, onClose, onRevokeSession, onRevokeAllSessions, onUpdateUploadPolicy, userActivity, onLoadActivity }) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-[420] bg-slate-950/40 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <header className="border-b border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                User detail
              </p>
              <h2 className="mt-1 text-xl font-bold">{detail.user.nickname || detail.user.username}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">@{detail.user.username}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10"
            >
              Close
            </button>
          </div>
        </header>
        <div className="app-scroll flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Messages" value={detail.stats.messages} icon={Database} />
            <StatCard label="Chats" value={detail.stats.chats} icon={Chat} />
            <StatCard label="Files" value={detail.stats.files} detail={detail.stats.storageLabel} icon={File} />
            <StatCard label="Sessions" value={detail.stats.sessions} icon={Lock} />
          </div>

          {/* Enhanced: Last activity & devices */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Activity & Devices</h3>
              <button
                type="button"
                onClick={() => onLoadActivity?.(detail.user)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/10"
              >
                Load activity
              </button>
            </div>
            {userActivity ? (
              <div className="mt-3 space-y-3">
                {userActivity.devices?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Devices</p>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {userActivity.devices.map((device, idx) => (
                        <div key={idx} className="py-2 text-sm">
                          <p className="truncate font-medium">{device.user_agent || "Unknown device"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">IP {device.ip_address || "-"} / Last seen {device.last_seen || "-"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {userActivity.recentMessages?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Recent messages</p>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {userActivity.recentMessages.map((msg) => (
                        <div key={msg.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium">{msg.chat_name || `${msg.chat_type} #${msg.chat_id}`}</p>
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{msg.created_at}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{msg.body || "(empty)"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {userActivity.loginHistory?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Login history</p>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {userActivity.loginHistory.map((entry, idx) => (
                        <div key={idx} className="py-2 text-sm">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.created_at} / IP {entry.ip_address || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Click "Load activity" to see recent messages, devices, and login history.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Active sessions</h3>
              <button
                type="button"
                onClick={() => onRevokeAllSessions(detail.user)}
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 dark:border-rose-500/30"
              >
                Logout all
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
              {detail.sessions.length ? (
                detail.sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold">Session #{session.id}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Created {session.created_at} / Last seen {session.last_seen}
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
                      Revoke
                    </button>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-slate-500">No active sessions.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-sm font-bold">Upload policy</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">File uploads</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {detail.user.fileUploadDisabled ? "Disabled for this user" : "Enabled (default)"}
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
                  {detail.user.fileUploadDisabled ? "Enable" : "Disable"}
                </button>
              </div>
              <div>
                <p className="text-sm font-medium">Max file size</p>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  {detail.user.fileUploadMaxSizeBytes
                    ? `${Math.round(detail.user.fileUploadMaxSizeBytes / (1024 * 1024))} MB (custom)`
                    : "Using server default"}
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
                    <option value="">Server default (50 MB)</option>
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
            <h3 className="text-sm font-bold">Recent chats</h3>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
              {detail.chats.length ? (
                detail.chats.map((chat) => (
                  <div key={chat.id} className="py-3 text-sm">
                    <p className="font-semibold">{chat.name || `${chat.type} #${chat.id}`}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {chat.type} / role {chat.role} / {chat.message_count} messages
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-3 text-sm text-slate-500">No chats found.</p>
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
                Chat administration
              </p>
              <h2 className="mt-1 text-xl font-bold">{chat.name || `${chat.type} #${chat.id}`}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {chat.type} / {chat.group_visibility || "public"} / {chat.group_username || "no username"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">
              Close
            </button>
          </div>
        </header>
        <div className="app-scroll flex-1 space-y-4 overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Members" value={detail.stats?.members || 0} icon={Users} />
            <StatCard label="Admins" value={detail.stats?.admins || 0} icon={ShieldCheck} />
            <StatCard label="Messages" value={detail.stats?.messages || 0} icon={Database} />
            <StatCard label="Files" value={detail.stats?.files || 0} icon={File} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[140px] flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Visibility</span>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950">
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label className="min-w-[180px] flex-[2]">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Public username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="channelname" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" />
              </label>
              <label className="flex min-w-[160px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/10">
                <input type="checkbox" checked={allowInvites} onChange={(event) => setAllowInvites(event.target.checked)} />
                Invite links
              </label>
              <button type="button" onClick={() => onSaveSettings({ groupVisibility: visibility, groupUsername: username, allowMemberInvites: allowInvites })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">
                <Pencil size={15} />Save
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[180px] flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</span>
                <input value={memberUsername} onChange={(event) => setMemberUsername(event.target.value)} placeholder="username" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950" />
              </label>
              <label className="min-w-[150px]">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Role</span>
                <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950">
                  {CHAT_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => onAddMember({ username: memberUsername, role: memberRole })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">
                <UserPlus size={15} />Add
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-sm font-bold">Members and managers</h3>
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
                      <Trash size={14} />Remove
                    </button>
                  </div>
                </div>
              )) : <p className="py-3 text-sm text-slate-500">No members found.</p>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function AdminPage({ user, isDark, onToggleTheme, onNavigate }) {
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
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);

  const isAdmin = Boolean(user?.isAdmin || ADMIN_ACCESS_ROLES.includes(String(user?.role || "").toLowerCase()));

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

  const loadAll = useCallback(async () => {
    if (!isAdmin) return;
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
      setError("Unable to load admin panel.");
    } else {
      setError("");
      if (failed.length) {
        console.warn("[admin] partial load failed:", failed.join(" | "));
      }
    }
    setLoading(false);
  }, [isAdmin, loadAudit, loadBackups, loadChats, loadFiles, loadOverview, loadRequiredChannels, loadSecuritySummary, loadSettings, loadSystemHealth, loadUsers]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
    } catch (err) {
      setError(err?.message || "Action failed.");
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
      setError(err?.message || "Unable to load user detail.");
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
      setError("Only groups and channels have admin details.");
      return;
    }
    setBusyKey(`chat-detail-${item.id}`);
    setError("");
    try {
      await loadChatDetail(item.id);
    } catch (err) {
      setError(err?.message || "Unable to load chat detail.");
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
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-white">
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
          <ShieldCheck className="mx-auto text-amber-500" size={34} />
          <h1 className="mt-3 text-xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your account does not have permission to open the admin panel.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("/chat", true)}
            className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Back to chat
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900 md:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-sm font-bold">BirdX Admin</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">v2.5.3-rc3</p>
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                Admin Panel
              </p>
              <h1 className="text-xl font-bold">System management</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAll()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
              >
                <Refresh size={17} />
                Refresh
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.("/chat", true)}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Chat
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {error}
            </div>
          ) : null}
          {loading ? <EmptyState text="Loading admin panel..." /> : null}

          {!loading && activeTab === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Users" value={stats.users?.total || 0} detail={`${stats.users?.admins || 0} admins, ${stats.users?.banned || 0} banned`} icon={Users} />
                <StatCard label="Chats" value={chatTotal} detail={`${stats.chats?.group || 0} groups, ${stats.chats?.channel || 0} channels`} icon={Chat} />
                <StatCard label="Messages" value={stats.messages || 0} detail="Stored chat messages" icon={Database} />
                <StatCard label="Files" value={stats.files?.total || 0} detail={stats.files?.label || "0 B"} icon={File} />
              </div>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">Operational snapshot</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <StatCard label="Recent users" value={stats.users?.recentlyActive || 0} detail="Active in 15 minutes" icon={User} />
                  <StatCard label="Sessions" value={stats.sessions || 0} detail="Active login sessions" icon={Lock} />
                  <StatCard label="Backups" value={backups.length} detail="Stored database backups" icon={Download} />
                </div>
              </section>
            </div>
          ) : null}

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
                  label="Memory"
                  percent={systemHealth?.memory?.percent || 0}
                  detail={`${systemHealth?.memory?.usedLabel || "0 B"} of ${systemHealth?.memory?.totalLabel || "0 B"}`}
                  status={systemHealth?.memory?.status}
                  icon={Database}
                />
                <ResourceMeter
                  label="Disk"
                  percent={systemHealth?.disk?.percent || 0}
                  detail={`${systemHealth?.disk?.usedLabel || "0 B"} of ${systemHealth?.disk?.totalLabel || "0 B"}`}
                  status={systemHealth?.disk?.status}
                  icon={File}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="App uptime" value={formatDuration(systemHealth?.runtime?.uptimeSeconds || 0)} detail={`System ${formatDuration(systemHealth?.runtime?.systemUptimeSeconds || 0)}`} icon={Refresh} />
                <StatCard label="Runtime" value={systemHealth?.runtime?.nodeVersion || "-"} detail={`${systemHealth?.runtime?.platform || "-"} / ${systemHealth?.runtime?.arch || "-"}`} icon={Settings} />
                <StatCard label="Database" value={systemHealth?.services?.database?.sizeLabel || "0 B"} detail={systemHealth?.services?.database?.exists ? "Database file found" : "Database file missing"} icon={Database} />
                <StatCard label="Uploads" value={systemHealth?.services?.uploads?.sizeLabel || "0 B"} detail={`${systemHealth?.services?.backups?.count || 0} backups stored`} icon={Download} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                  <h2 className="text-sm font-bold">Security summary</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <StatCard label="Failed logins" value={securitySummary?.failedLogins24h || 0} detail="Last 24 hours" icon={Lock} />
                    <StatCard label="Banned logins" value={securitySummary?.bannedLogins24h || 0} detail="Last 24 hours" icon={Ban} />
                    <StatCard label="Failed reauth" value={securitySummary?.failedReauth24h || 0} detail="Admin password checks" icon={ShieldCheck} />
                    <StatCard label="Sensitive actions" value={securitySummary?.sensitiveActions24h || 0} detail={`${securitySummary?.activeAdminSessions || 0} admin sessions`} icon={Settings} />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Top source IPs</h3>
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                      {securitySummary?.topIps?.length ? securitySummary.topIps.map((item) => (
                        <div key={item.ip} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="font-semibold">{item.ip}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{item.count}</span>
                        </div>
                      )) : <p className="py-3 text-sm text-slate-500">No security events in the last day.</p>}
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                  <h2 className="text-sm font-bold">Recent security activity</h2>
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
                    )) : <EmptyState text="No recent security events." />}
                  </div>
                </section>
              </div>

              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">Sensitive admin actions</h2>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                  {securitySummary?.recentSensitiveActions?.length ? securitySummary.recentSensitiveActions.map((item) => (
                    <div key={`sensitive-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-bold">
                          {item.action}
                          {!item.success ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">failed</span> : null}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.actor_username || "system"} / {item.target_type || "-"} #{item.target_id || "-"} / IP {item.ip_address || "-"}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.created_at}</span>
                    </div>
                  )) : <EmptyState text="No sensitive actions found." />}
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "users" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_140px_140px_160px_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input value={userFilters.query} onChange={(event) => setUserFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))} placeholder="Search users" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900" />
                </div>
                <select value={userFilters.role} onChange={(event) => setUserFilters((prev) => ({ ...prev, role: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">All roles</option>
                  {ADMIN_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select value={userFilters.status} onChange={(event) => setUserFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="banned">Banned</option>
                  <option value="recent">Recent</option>
                </select>
                <select value={userFilters.sort} onChange={(event) => setUserFilters((prev) => ({ ...prev, sort: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="newest">Newest</option>
                  <option value="username">Username</option>
                  <option value="messages">Most messages</option>
                  <option value="chats">Most chats</option>
                  <option value="last_seen">Last seen</option>
                </select>
                <button type="button" onClick={() => void loadUsers()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">Apply</button>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
                {selectedUserIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-amber-50 px-4 py-2 dark:border-white/10 dark:bg-amber-500/10">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-200">{selectedUserIds.length} selected</span>
                    <button type="button" onClick={() => setSelectedUserIds([])} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold dark:border-white/10">Clear</button>
                    <button
                      type="button"
                      onClick={() => confirmAction({ title: "Bulk ban users", body: `Ban ${selectedUserIds.length} selected users?`, confirmLabel: "Ban all", danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminUsers({ action: "ban", ids: selectedUserIds, adminPassword })); setSelectedUserIds([]); }, refresh: loadUsers })}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                    ><Ban size={13} />Ban</button>
                    <button
                      type="button"
                      onClick={() => confirmAction({ title: "Bulk unban users", body: `Unban ${selectedUserIds.length} selected users?`, confirmLabel: "Unban all", requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminUsers({ action: "unban", ids: selectedUserIds, adminPassword })); setSelectedUserIds([]); }, refresh: loadUsers })}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10"
                    ><User size={13} />Unban</button>
                    <button
                      type="button"
                      onClick={() => confirmAction({ title: "Bulk delete users", body: `Delete ${selectedUserIds.length} selected users? This cannot be undone.`, confirmLabel: "Delete all", danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminUsers({ action: "delete", ids: selectedUserIds, adminPassword })); setSelectedUserIds([]); }, refresh: loadUsers })}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                    ><Trash size={13} />Delete</button>
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
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Activity</th>
                        <th className="px-4 py-3 text-right">Actions</th>
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
                                confirmAction({
                                  title: "Change role",
                                  body: `Change @${item.username} role to ${nextRole}?`,
                                  confirmLabel: "Change",
                                  requiresPassword: true,
                                  run: async ({ adminPassword }) =>
                                    readJsonResponse(await updateAdminUser(item.id, { role: nextRole, adminPassword })),
                                  refresh: loadUsers,
                                });
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold dark:border-white/10 dark:bg-slate-900"
                            >
                              {ADMIN_ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            {item.envAdmin ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">env</span> : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.banned ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>
                              {item.banned ? "banned" : "active"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{item.chat_count} chats / {item.message_count} messages</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => void openUserDetail(item)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold dark:border-white/10">Detail</button>
                              <button type="button" onClick={() => confirmAction({ title: item.banned ? "Unban user" : "Ban user", body: `Change ban status for @${item.username}?`, confirmLabel: item.banned ? "Unban" : "Ban", danger: !item.banned, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await updateAdminUser(item.id, { banned: !item.banned, adminPassword })), refresh: loadUsers })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold dark:border-white/10"><Ban size={14} />{item.banned ? "Unban" : "Ban"}</button>
                              <button type="button" onClick={() => confirmAction({ title: "Reset password", body: `Set a new password for @${item.username}.`, inputLabel: "New password", inputType: "password", minLength: 6, confirmLabel: "Reset", requiresPassword: true, run: async ({ value, adminPassword }) => readJsonResponse(await resetAdminUserPassword(item.id, { password: value, adminPassword })), refresh: loadUsers })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold dark:border-white/10"><Lock size={14} />Password</button>
                              <button type="button" onClick={() => confirmAction({ title: "Delete user", body: `Delete @${item.username}? This cannot be undone.`, confirmLabel: "Delete", danger: true, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await deleteAdminUser(item.id, { adminPassword })), refresh: loadUsers })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-semibold text-rose-600 dark:border-rose-500/30"><Trash size={14} />Delete</button>
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
                <input value={chatFilters.query} onChange={(event) => setChatFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))} placeholder="Search chats" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900" />
                <select value={chatFilters.type} onChange={(event) => setChatFilters((prev) => ({ ...prev, type: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">All types</option><option value="dm">DM</option><option value="group">Group</option><option value="channel">Channel</option><option value="saved">Saved</option>
                </select>
                <select value={chatFilters.visibility} onChange={(event) => setChatFilters((prev) => ({ ...prev, visibility: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">Any visibility</option><option value="public">Public</option><option value="private">Private</option>
                </select>
                <select value={chatFilters.sort} onChange={(event) => setChatFilters((prev) => ({ ...prev, sort: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="newest">Newest</option><option value="name">Name</option><option value="members">Most members</option><option value="messages">Most messages</option>
                </select>
                <button type="button" onClick={() => void loadChats()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">Apply</button>
              </div>
              {selectedChatIds.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-200">{selectedChatIds.length} selected</span>
                  <button type="button" onClick={() => setSelectedChatIds([])} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold dark:border-white/10">Clear</button>
                  <button
                    type="button"
                    onClick={() => confirmAction({ title: "Bulk delete chats", body: `Delete ${selectedChatIds.length} selected chats? This cannot be undone.`, confirmLabel: "Delete all", danger: true, requiresPassword: true, run: async ({ adminPassword }) => { await readJsonResponse(await bulkAdminChats({ action: "delete", ids: selectedChatIds, adminPassword })); setSelectedChatIds([]); }, refresh: loadChats })}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"
                  ><Trash size={13} />Delete all</button>
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
                        <p className="text-xs text-slate-500 dark:text-slate-400">{chat.type} / {chat.group_visibility || "private"} / {chat.group_username || "no username"} / {chat.member_count} members / {chat.message_count} messages</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {["group", "channel"].includes(String(chat.type || "").toLowerCase()) ? (
                        <button type="button" onClick={() => void openChatDetail(chat)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-white/10"><Pencil size={15} />Detail</button>
                      ) : null}
                      <button type="button" onClick={() => confirmAction({ title: "Delete chat", body: `Delete chat #${chat.id}? This cannot be undone.`, confirmLabel: "Delete", danger: true, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await deleteAdminChat(chat.id, { adminPassword })), refresh: loadChats })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-600 dark:border-rose-500/30"><Trash size={15} />Delete</button>
                    </div>
                  </section>
                )) : <EmptyState text="No chats found." />}
              </div>
              <Pager pagination={chatPagination} onPage={(page) => setChatFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "files" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_140px_auto]">
                <input value={fileFilters.query} onChange={(event) => setFileFilters((prev) => ({ ...prev, query: event.target.value, page: 1 }))} placeholder="Search files or owner" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900" />
                <select value={fileFilters.kind} onChange={(event) => setFileFilters((prev) => ({ ...prev, kind: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">All files</option><option value="image">Image</option><option value="video">Video</option><option value="audio">Audio</option><option value="file">File</option>
                </select>
                <button type="button" onClick={() => void loadFiles()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">Apply</button>
              </div>
              <div className="grid gap-3">
                {files.length ? files.map((file) => (
                  <section key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                    <div className="min-w-0"><p className="truncate font-bold">{file.original_name || file.stored_name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{file.size_label} / {file.mime_type || file.kind || "file"} / @{file.owner_username || "unknown"}</p></div>
                    <button type="button" onClick={() => confirmAction({ title: "Delete file", body: `Delete ${file.original_name || file.stored_name}?`, confirmLabel: "Delete", danger: true, requiresPassword: true, run: async ({ adminPassword }) => readJsonResponse(await deleteAdminFile(file.id, { adminPassword })), refresh: loadFiles })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-600 dark:border-rose-500/30"><Trash size={15} />Delete</button>
                  </section>
                )) : <EmptyState text="No files found." />}
              </div>
              <Pager pagination={filePagination} onPage={(page) => setFileFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "broadcast" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">Send broadcast message</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Send a message to all users or a specific group. Messages appear in their Saved Messages.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Target</span>
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                      >
                        <option value="all">All users</option>
                        <option value="online">Online users</option>
                        <option value="role">By role</option>
                      </select>
                    </label>
                    {broadcastTarget === "role" ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Role</span>
                        <select
                          value={broadcastRole}
                          onChange={(e) => setBroadcastRole(e.target.value)}
                          className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                        >
                          <option value="">Select role</option>
                          {ADMIN_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Message</span>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      rows={4}
                      placeholder="Type your broadcast message..."
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {broadcastMessage.length} characters
                    </span>
                    <button
                      type="button"
                      disabled={!broadcastMessage.trim()}
                      onClick={() =>
                        confirmAction({
                          title: "Send broadcast",
                          body: `Send this message to ${broadcastTarget === "role" ? `${broadcastRole} users` : broadcastTarget === "online" ? "online users" : "all users"}?`,
                          confirmLabel: "Send",
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
                      <Globe size={16} />Send broadcast
                    </button>
                  </div>
                </div>
                {broadcastResult ? (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    Broadcast delivered to {broadcastResult.delivered} of {broadcastResult.total} users.
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "export" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <h2 className="text-sm font-bold">Export data</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Download data exports in CSV or JSON format.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { type: "users", label: "Users", icon: Users, desc: "All user accounts" },
                    { type: "chats", label: "Chats", icon: Chat, desc: "All chats with stats" },
                    { type: "files", label: "Files", icon: File, desc: "All uploaded files" },
                    { type: "audit", label: "Audit Logs", icon: ShieldCheck, desc: "Admin audit trail" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.type} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <Icon size={18} className="text-emerald-500" />
                          <p className="text-sm font-bold">{item.label}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                        <div className="mt-3 flex gap-2">
                          <a
                            href={getAdminExportUrl(item.type, "csv")}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-white/10"
                          >
                            <Download size={13} />CSV
                          </a>
                          <a
                            href={getAdminExportUrl(item.type, "json")}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-white/10"
                          >
                            <Download size={13} />JSON
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : null}

          {!loading && activeTab === "audit" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_180px_150px_auto]">
                <input value={auditFilters.action} onChange={(event) => setAuditFilters((prev) => ({ ...prev, action: event.target.value, page: 1 }))} placeholder="Action filter" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                <input value={auditFilters.actor} onChange={(event) => setAuditFilters((prev) => ({ ...prev, actor: event.target.value, page: 1 }))} placeholder="Actor" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900" />
                <select value={auditFilters.targetType} onChange={(event) => setAuditFilters((prev) => ({ ...prev, targetType: event.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900">
                  <option value="">All targets</option><option value="user">User</option><option value="chat">Chat</option><option value="file">File</option><option value="backup">Backup</option><option value="session">Session</option>
                </select>
                <button type="button" onClick={() => void loadAudit()} className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white">Apply</button>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {auditLogs.length ? auditLogs.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="font-bold">
                          {log.action}
                          {!log.success ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">failed</span> : null}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {log.actor_username || "system"} / {log.target_type || "-"} #{log.target_id || "-"} / IP {log.ip_address || "-"}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{log.created_at}</span>
                    </div>
                  )) : <EmptyState text="No audit logs found." />}
                </div>
              </div>
              <Pager pagination={auditPagination} onPage={(page) => setAuditFilters((prev) => ({ ...prev, page }))} />
            </div>
          ) : null}

          {!loading && activeTab === "maintenance" ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Account Creation" value={settings?.accountCreation ? "Enabled" : "Disabled"} detail="Controlled by .env" icon={Settings} />
                <StatCard label="Message Limit" value={settings?.messageMaxChars || 0} detail="Maximum characters per message" icon={Database} />
                <StatCard label="Storage Encryption" value={settings?.storageEncryption ? "Enabled" : "Disabled"} detail="Server-side storage encryption" icon={Lock} />
                <StatCard label="Required Channels" value={requiredChannels.length} detail="Auto-joined announcement channels" icon={Chat} />
              </div>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">Required channels</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">New accounts are added automatically and members cannot leave these channels.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction({
                          title: "Save required channels",
                          body: "Update the required channel list for new accounts?",
                          confirmLabel: "Save",
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
                        })
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white"
                    >
                      <Pencil size={16} />Save
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction({
                          title: "Save and apply required channels",
                          body: "Save this required channel list and add all existing users to it?",
                          confirmLabel: "Save & apply",
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
                      <UserPlus size={16} />Save & apply
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
                            {channel.group_username ? `@${String(channel.group_username).replace(/^@/, "")}` : "No public username"} / {channel.member_count || 0} members
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
                  }) : <p className="py-4 text-sm text-slate-500">Create a BirdX channel first, then select it here.</p>}
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-sm font-bold">Database backups</h2><p className="text-xs text-slate-500 dark:text-slate-400">Create and download safe database snapshots.</p></div>
                  <button type="button" onClick={() => confirmAction({ title: "Create backup", body: "Create a fresh database backup now?", confirmLabel: "Create", requiresPassword: true, run: async ({ adminPassword }) => { const data = await readJsonResponse(await createAdminBackup({ adminPassword })); setBackups(data.backups || []); }, refresh: loadBackups })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white"><Download size={16} />Create backup</button>
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
                  {backups.length ? backups.map((backup) => (
                    <div key={backup.name} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div><p className="font-semibold">{backup.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{backup.sizeLabel} / {backup.createdAt}</p></div>
                      <div className="flex gap-2">
                        <a href={getAdminBackupDownloadUrl(backup.name)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-white/10"><Download size={14} />Download</a>
                        <button type="button" onClick={() => confirmAction({ title: "Delete backup", body: `Delete ${backup.name}?`, confirmLabel: "Delete", danger: true, requiresPassword: true, run: async ({ adminPassword }) => { const data = await readJsonResponse(await deleteAdminBackup(backup.name, { adminPassword })); setBackups(data.backups || []); }, refresh: loadBackups })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-600 dark:border-rose-500/30"><Trash size={14} />Delete</button>
                      </div>
                    </div>
                  )) : <p className="py-4 text-sm text-slate-500">No backups yet.</p>}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>

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
          confirmAction({
            title: "Revoke session",
            body: `Revoke session #${session.id} for @${detailUser.username}?`,
            confirmLabel: "Revoke",
            danger: true,
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await deleteAdminUserSession(detailUser.id, session.id, { adminPassword }));
              setUserDetail(await readJsonResponse(await fetchAdminUserDetail(detailUser.id)));
            },
            refresh: loadUsers,
          })
        }
        onRevokeAllSessions={(detailUser) =>
          confirmAction({
            title: "Logout all sessions",
            body: `Logout all active sessions for @${detailUser.username}?`,
            confirmLabel: "Logout all",
            danger: true,
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await deleteAdminUserSessions(detailUser.id, { adminPassword }));
              setUserDetail(await readJsonResponse(await fetchAdminUserDetail(detailUser.id)));
            },
            refresh: loadUsers,
          })
        }
        onUpdateUploadPolicy={async (detailUser, payload) => {
          try {
            await readJsonResponse(await updateAdminUser(detailUser.id, payload));
            setUserDetail(await readJsonResponse(await fetchAdminUserDetail(detailUser.id)));
          } catch (err) {
            setError(err?.message || "Unable to update upload policy.");
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
          confirmAction({
            title: "Update chat settings",
            body: `Update settings for ${chatDetail?.chat?.name || `chat #${chatDetail?.chat?.id}`}?`,
            confirmLabel: "Save",
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await updateAdminChatSettings(chatDetail.chat.id, { ...payload, adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          })
        }
        onAddMember={(payload) =>
          confirmAction({
            title: "Add chat member",
            body: `Add @${payload.username} as ${payload.role}?`,
            confirmLabel: "Add",
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await addAdminChatMember(chatDetail.chat.id, { ...payload, adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          })
        }
        onChangeMemberRole={(member, role) =>
          confirmAction({
            title: "Change member role",
            body: `Change @${member.username} role to ${role}?`,
            confirmLabel: "Change",
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await updateAdminChatMember(chatDetail.chat.id, member.id, { role, adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          })
        }
        onRemoveMember={(member) =>
          confirmAction({
            title: "Remove chat member",
            body: `Remove @${member.username} from this chat?`,
            confirmLabel: "Remove",
            danger: true,
            requiresPassword: true,
            run: async ({ adminPassword }) => {
              await readJsonResponse(await deleteAdminChatMember(chatDetail.chat.id, member.id, { adminPassword }));
              await loadChatDetail(chatDetail.chat.id);
            },
            refresh: loadChats,
          })
        }
      />
    </div>
  );
}
