import { useState } from "react";
import { fetch2FAStatus, setup2FA, verifySetup2FA, disable2FA, fetch2FABackupCodes } from "../../../api/chatApi.js";
import { Lock, ShieldCheck, Trash } from "../../../icons/lucide.js";

export default function TwoFactorSettings() {
  const [status, setStatus] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch2FAStatus();
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setStatus(data);
    } catch (err) {
      setError(err?.message || "Failed to load 2FA status.");
    }
  };

  const handleSetup = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await setup2FA();
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setSetupData(data);
    } catch (err) {
      setError(err?.message || "Failed to start 2FA setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await verifySetup2FA({ token: verifyToken });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Invalid code");
      setSuccess("2FA enabled successfully!");
      setSetupData(null);
      setVerifyToken("");
      await loadStatus();
    } catch (err) {
      setError(err?.message || "Verification failed.");
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
      if (!res.ok) throw new Error(data?.error || "Failed");
      setSuccess("2FA disabled.");
      setDisablePassword("");
      setBackupCodes(null);
      await loadStatus();
    } catch (err) {
      setError(err?.message || "Failed to disable 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const handleShowBackupCodes = async () => {
    setError("");
    try {
      const res = await fetch2FABackupCodes();
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setBackupCodes(data.backupCodes || []);
    } catch (err) {
      setError(err?.message || "Failed to load backup codes.");
    }
  };

  if (status === null) {
    return (
      <section className="mt-5 rounded-2xl border border-emerald-100/70 bg-white/80 p-4 dark:border-emerald-500/30 dark:bg-slate-950/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Two-Factor Authentication</h3>
          </div>
          <button type="button" onClick={loadStatus} className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200">
            Check status
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
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Two-Factor Authentication</h3>
        {isEnabled ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Enabled</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">Disabled</span>
        )}
      </div>

      {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
      {success ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">{success}</p> : null}

      {!isEnabled && !setupData ? (
        <div className="mt-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add an extra layer of security to your account using an authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <button type="button" onClick={handleSetup} disabled={loading} className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-50">
            {loading ? "Setting up..." : "Enable 2FA"}
          </button>
        </div>
      ) : null}

      {setupData ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">1. Scan this QR code with your authenticator app:</p>
            <div className="mt-2 flex justify-center rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.uri)}`}
                alt="2FA QR Code"
                className="h-48 w-48"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Or enter this secret manually:</p>
            <code className="mt-1 block rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono font-bold tracking-wider text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {setupData.secret}
            </code>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">2. Enter the 6-digit code to verify:</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="h-10 w-32 rounded-xl border border-emerald-200 bg-white px-3 text-center text-lg font-bold tracking-[0.3em] text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
              />
              <button type="button" onClick={handleVerify} disabled={loading || verifyToken.length !== 6} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">3. Save your backup codes (in case you lose your device):</p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
              {setupData.backupCodes?.map((code, idx) => (
                <code key={idx} className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{code}</code>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => { setSetupData(null); setVerifyToken(""); setError(""); }} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Cancel setup
          </button>
        </div>
      ) : null}

      {isEnabled ? (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={handleShowBackupCodes} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200">
            <Lock size={13} />View backup codes
          </button>
          {backupCodes ? (
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
              {backupCodes.map((code, idx) => (
                <code key={idx} className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{code}</code>
              ))}
            </div>
          ) : null}
          <div className="border-t border-slate-100 pt-3 dark:border-white/10">
            <p className="text-xs font-bold text-rose-600 dark:text-rose-300">Disable 2FA</p>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
                className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              />
              <button type="button" onClick={handleDisable} disabled={loading || !disablePassword} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50 dark:border-rose-500/30">
                <Trash size={13} />{loading ? "..." : "Disable"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
