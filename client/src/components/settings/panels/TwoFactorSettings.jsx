import { useEffect, useState } from "react";
import {
  cancel2FASetup,
  fetch2FAStatus,
  setup2FA,
  verifySetup2FA,
  disable2FA,
  fetch2FABackupCodes,
} from "../../../api/chatApi.js";
import { Copy, Lock, ShieldCheck, Trash } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { hasPersian } from "../../../utils/fontUtils.js";
import { copyTextToClipboard } from "../../../utils/clipboard.js";

function CopyButton({ label, copiedLabel, onCopy, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      const ok = await onCopy?.();
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-500/10 ${className}`}
    >
      <Copy size={12} className="icon-anim-pop" />
      {copied ? copiedLabel : label}
    </button>
  );
}

export default function TwoFactorSettings() {
  const { t } = useLanguage();
  const [status, setStatus] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch2FAStatus();
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.2fa.errorLoad"));
      setStatus(data);
      return data;
    } catch (err) {
      setError(err?.message || t("settings.2fa.errorLoad"));
      return null;
    } finally {
      setStatusLoading(false);
    }
  };

  const resumePendingSetup = async () => {
    try {
      const res = await setup2FA();
      const data = await res.json();
      if (!res.ok) return;
      if (data?.secret) {
        setSetupData(data);
      }
    } catch {
      // ignore resume errors
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await loadStatus();
      if (!active || !data || data.enabled) return;
      await resumePendingSetup();
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSetup = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await setup2FA();
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.2fa.errorStart"));
      setSetupData(data);
    } catch (err) {
      setError(err?.message || t("settings.2fa.errorStart"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await verifySetup2FA({
        token: String(verifyToken || "").replace(/\D/g, "").padStart(6, "0"),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.2fa.errorInvalid"));
      setSuccess(t("settings.2fa.successEnabled"));
      setSetupData(null);
      setVerifyToken("");
      await loadStatus();
    } catch (err) {
      setError(err?.message || t("settings.2fa.errorVerify"));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await disable2FA({ password: disablePassword });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.2fa.errorDisable"));
      setSuccess(t("settings.2fa.successDisabled"));
      setDisablePassword("");
      setBackupCodes(null);
      await loadStatus();
    } catch (err) {
      setError(err?.message || t("settings.2fa.errorDisable"));
    } finally {
      setLoading(false);
    }
  };

  const handleShowBackupCodes = async () => {
    setError("");
    try {
      const res = await fetch2FABackupCodes();
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.2fa.errorBackup"));
      setBackupCodes(data.backupCodes || []);
    } catch (err) {
      setError(err?.message || t("settings.2fa.errorBackup"));
    }
  };

  if (status === null) {
    return (
      <section className="mt-5 rounded-2xl border border-emerald-100/70 bg-white/80 p-4 dark:border-emerald-500/30 dark:bg-slate-950/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-500" />
            <h3
              className={`text-sm font-bold text-slate-700 dark:text-slate-200 ${hasPersian(t("settings.2fa.title")) ? "font-fa" : ""}`}
            >
              {t("settings.2fa.title")}
            </h3>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            disabled={statusLoading}
            className={`rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200 ${hasPersian(t("settings.2fa.checkStatus")) ? "font-fa" : ""}`}
          >
            {statusLoading ? t("settings.2fa.settingUp") : t("settings.2fa.checkStatus")}
          </button>
        </div>
      </section>
    );
  }

  const isEnabled = Boolean(status?.enabled);

  return (
    <section className="mt-5 rounded-2xl border border-emerald-100/70 bg-white/80 p-4 dark:border-emerald-500/30 dark:bg-slate-950/60">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-500" />
        <h3
          className={`text-sm font-bold text-slate-700 dark:text-slate-200 ${hasPersian(t("settings.2fa.title")) ? "font-fa" : ""}`}
        >
          {t("settings.2fa.title")}
        </h3>
        {isEnabled ? (
          <span
            className={`rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200 ${hasPersian(t("settings.2fa.enabled")) ? "font-fa" : ""}`}
          >
            {t("settings.2fa.enabled")}
          </span>
        ) : (
          <span
            className={`rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400 ${hasPersian(t("settings.2fa.disabled")) ? "font-fa" : ""}`}
          >
            {t("settings.2fa.disabled")}
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      {!isEnabled && !setupData ? (
        <div className="mt-3">
          <p
            className={`text-xs text-slate-500 dark:text-slate-400 ${hasPersian(t("settings.2fa.intro")) ? "font-fa" : ""}`}
          >
            {t("settings.2fa.intro")}
          </p>
          <button
            type="button"
            onClick={handleSetup}
            disabled={loading}
            className={`mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-50 ${hasPersian(t("settings.2fa.enable")) ? "font-fa" : ""}`}
          >
            {loading ? t("settings.2fa.settingUp") : t("settings.2fa.enable")}
          </button>
        </div>
      ) : null}

      {setupData ? (
        <div className="mt-4 space-y-4">
          <div>
            <p
              className={`text-xs font-bold text-slate-700 dark:text-slate-200 ${hasPersian(t("settings.2fa.scanQr")) ? "font-fa" : ""}`}
            >
              {t("settings.2fa.scanQr")}
            </p>
            <div className="mt-2 flex justify-center rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.uri)}`}
                alt={t("settings.2fa.qrAlt")}
                className="h-48 w-48"
              />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={`text-xs font-bold text-slate-700 dark:text-slate-200 ${hasPersian(t("settings.2fa.manualSecret")) ? "font-fa" : ""}`}
              >
                {t("settings.2fa.manualSecret")}
              </p>
              <CopyButton
                label={t("settings.2fa.copySecret")}
                copiedLabel={t("groupInvite.copied")}
                onCopy={() => copyTextToClipboard(String(setupData.secret || ""))}
              />
            </div>
            <code className="mt-1 block select-all rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono font-bold tracking-wider text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {setupData.secret}
            </code>
          </div>
          <div>
            <p
              className={`text-xs font-bold text-slate-700 dark:text-slate-200 ${hasPersian(t("settings.2fa.enterCode")) ? "font-fa" : ""}`}
            >
              {t("settings.2fa.enterCode")}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-10 w-32 rounded-xl border border-emerald-200 bg-white px-3 text-center text-lg font-bold tracking-[0.3em] text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || verifyToken.replace(/\D/g, "").length !== 6}
                className={`rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${hasPersian(t("settings.2fa.verify")) ? "font-fa" : ""}`}
              >
                {loading ? t("settings.2fa.verifying") : t("settings.2fa.verify")}
              </button>
            </div>
            <p
              className={`mt-2 text-[11px] text-slate-500 dark:text-slate-400 ${hasPersian(t("settings.2fa.timeSyncHint")) ? "font-fa" : ""}`}
            >
              {t("settings.2fa.timeSyncHint")}
            </p>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={`text-xs font-bold text-slate-700 dark:text-slate-200 ${hasPersian(t("settings.2fa.saveBackup")) ? "font-fa" : ""}`}
              >
                {t("settings.2fa.saveBackup")}
              </p>
              <CopyButton
                label={t("settings.2fa.copyBackup")}
                copiedLabel={t("groupInvite.copied")}
                onCopy={() =>
                  copyTextToClipboard(
                    (setupData.backupCodes || []).join("\n"),
                  )
                }
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
              {setupData.backupCodes?.map((code, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => copyTextToClipboard(String(code || ""))}
                  title={t("chat.copy")}
                  className="rounded-md px-1 py-0.5 text-left text-xs font-mono font-bold text-slate-600 transition hover:bg-emerald-100/80 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setError("");
              try {
                await cancel2FASetup();
              } catch {
                // ignore cancel errors
              }
              setSetupData(null);
              setVerifyToken("");
            }}
            className={`text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 ${hasPersian(t("settings.2fa.cancelSetup")) ? "font-fa" : ""}`}
          >
            {t("settings.2fa.cancelSetup")}
          </button>
        </div>
      ) : null}

      {isEnabled ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={handleShowBackupCodes}
            className={`inline-flex items-center gap-1 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200 ${hasPersian(t("settings.2fa.viewBackup")) ? "font-fa" : ""}`}
          >
            <Lock size={13} />
            {t("settings.2fa.viewBackup")}
          </button>
          {backupCodes ? (
            <div>
              <div className="mb-2 flex justify-end">
                <CopyButton
                  label={t("settings.2fa.copyBackup")}
                  copiedLabel={t("groupInvite.copied")}
                  onCopy={() => copyTextToClipboard((backupCodes || []).join("\n"))}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
                {backupCodes.map((code, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => copyTextToClipboard(String(code || ""))}
                    title={t("chat.copy")}
                    className="rounded-md px-1 py-0.5 text-left text-xs font-mono font-bold text-slate-600 transition hover:bg-emerald-100/80 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="border-t border-slate-100 pt-3 dark:border-white/10">
            <p
              className={`text-xs font-bold text-rose-600 dark:text-rose-300 ${hasPersian(t("settings.2fa.disableTitle")) ? "font-fa" : ""}`}
            >
              {t("settings.2fa.disableTitle")}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={t("settings.2fa.passwordPlaceholder")}
                className={`h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 ${hasPersian(t("settings.2fa.passwordPlaceholder")) ? "font-fa text-right" : ""}`}
              />
              <button
                type="button"
                onClick={handleDisable}
                disabled={loading || !disablePassword}
                className={`inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50 dark:border-rose-500/30 ${hasPersian(t("settings.2fa.disable")) ? "font-fa" : ""}`}
              >
                <Trash size={13} />
                {loading ? "..." : t("settings.2fa.disable")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
