import { useCallback, useEffect, useState } from "react";
import {
  fetchSessions,
  revokeOtherSessions,
  revokeSession,
} from "../../../api/chatApi.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { hasPersian } from "../../../utils/fontUtils.js";

function formatSessionLabel(session, t) {
  const ua = String(session?.userAgent || "").toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return t("settings.devices.ios");
  if (ua.includes("android")) return t("settings.devices.android");
  if (ua.includes("windows")) return t("settings.devices.windows");
  if (ua.includes("mac")) return t("settings.devices.mac");
  if (ua.includes("linux")) return t("settings.devices.linux");
  if (ua) return t("settings.devices.browser");
  return t("settings.devices.unknown");
}

export function DevicesSettingsPanel({ user, onClose }) {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    if (!user?.username) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchSessions(user.username);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t("settings.devices.loadFailed"));
      }
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (err) {
      setError(err?.message || t("settings.devices.loadFailed"));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [t, user?.username]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
      <p className={hasPersian(t("settings.devices.intro")) ? "font-fa leading-6" : "leading-6"}>
        {t("settings.devices.intro")}
      </p>

      {loading ? (
        <p className="text-xs text-slate-500">{t("settings.about.loading")}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {sessions.map((session) => {
          const label = formatSessionLabel(session, t);
          return (
            <div
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/70 bg-white/90 px-4 py-3 dark:border-emerald-500/30 dark:bg-slate-900/50"
            >
              <div className="min-w-0">
                <p
                  className={`font-semibold text-emerald-700 dark:text-emerald-200 ${hasPersian(label) ? "font-fa" : ""}`}
                >
                  {label}
                  {session.isCurrent ? (
                    <span className="ms-2 text-[10px] font-bold uppercase text-emerald-500">
                      {t("settings.devices.current")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                  {session.ipAddress || "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {t("settings.devices.lastActive")}: {session.lastSeen || "—"}
                </p>
              </div>
              {!session.isCurrent ? (
                <button
                  type="button"
                  onClick={async () => {
                    await revokeSession({
                      username: user.username,
                      sessionId: session.id,
                    });
                    await loadSessions();
                  }}
                  className="shrink-0 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200"
                >
                  {t("settings.devices.revoke")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void loadSessions()}
        className="w-full rounded-2xl border border-emerald-200/80 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200"
      >
        {t("settings.devices.refresh")}
      </button>

      <button
        type="button"
        onClick={async () => {
          if (!window.confirm(t("settings.devices.revokeOthersConfirm"))) return;
          await revokeOtherSessions(user.username);
          await loadSessions();
        }}
        className="w-full rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200"
      >
        {t("settings.devices.revokeOthers")}
      </button>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
        >
          {t("settings.done")}
        </button>
      </div>
    </div>
  );
}
