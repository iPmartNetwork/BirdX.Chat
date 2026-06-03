import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import {
  fetchBlockedUsers,
  unblockUser,
  updateContactRequestPolicy,
  updateDmPolicy,
} from "../../../api/chatApi.js";
import Avatar from "../../common/Avatar.jsx";
import { InlineError } from "../common/InlineError.jsx";

const DM_POLICY_OPTIONS = [
  { value: "acquaintances", labelKey: "settings.privacy.acquaintances" },
  { value: "everyone", labelKey: "settings.privacy.everyone" },
  { value: "nobody", labelKey: "settings.privacy.nobody" },
];

const CONTACT_POLICY_OPTIONS = [
  { value: "everyone", labelKey: "settings.privacy.contactEveryone" },
  { value: "acquaintances", labelKey: "settings.privacy.contactAcquaintances" },
  { value: "nobody", labelKey: "settings.privacy.contactNobody" },
];

export function PrivacySettingsPanel({
  user,
  dmPolicy,
  contactRequestPolicy = "everyone",
  onDmPolicyChange,
  onContactRequestPolicyChange,
  onDone,
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const loadBlocked = useCallback(async () => {
    if (!user?.username) return;
    setLoadingBlocked(true);
    try {
      const res = await fetchBlockedUsers({ username: user.username });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.privacy.blockedLoadError"));
      setBlockedUsers(Array.isArray(data?.blocked) ? data.blocked : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBlocked(false);
    }
  }, [t, user?.username]);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const handleDmSelect = async (nextPolicy) => {
    if (!user?.username || nextPolicy === dmPolicy) return;
    try {
      setSaving(true);
      setError("");
      const res = await updateDmPolicy({
        username: user.username,
        dmPolicy: nextPolicy,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t("settings.privacy.saveError"));
      }
      onDmPolicyChange?.(data.dmPolicy || nextPolicy);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleContactPolicySelect = async (nextPolicy) => {
    if (!user?.username || nextPolicy === contactRequestPolicy) return;
    try {
      setSaving(true);
      setError("");
      const res = await updateContactRequestPolicy({
        username: user.username,
        contactRequestPolicy: nextPolicy,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || t("settings.privacy.saveError"));
      }
      onContactRequestPolicyChange?.(data.contactRequestPolicy || nextPolicy);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (targetUsername) => {
    if (!user?.username || !targetUsername) return;
    try {
      setSaving(true);
      setError("");
      const res = await unblockUser({ username: user.username, target: targetUsername });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("settings.privacy.unblockError"));
      await loadBlocked();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderPolicyOptions = (options, activeValue, onSelect) =>
    options.map((option) => {
      const active = activeValue === option.value;
      return (
        <button
          key={option.value}
          type="button"
          disabled={saving}
          onClick={() => onSelect(option.value)}
          className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-start transition ${
            active
              ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-100"
              : "border-emerald-100/70 bg-white text-slate-700 hover:border-emerald-300 dark:border-emerald-500/25 dark:bg-slate-950 dark:text-slate-200"
          }`}
        >
          <span className="text-sm font-semibold">{t(option.labelKey)}</span>
          <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(`${option.labelKey}.hint`)}
          </span>
        </button>
      );
    });

  return (
    <div className="app-scroll mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
      <section className="space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("settings.privacy.dmTitle")}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("settings.privacy.intro")}
        </p>
        <div className="space-y-2">{renderPolicyOptions(DM_POLICY_OPTIONS, dmPolicy, handleDmSelect)}</div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("settings.privacy.contactTitle")}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t("settings.privacy.contactIntro")}
        </p>
        <div className="space-y-2">
          {renderPolicyOptions(
            CONTACT_POLICY_OPTIONS,
            contactRequestPolicy,
            handleContactPolicySelect,
          )}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("settings.privacy.blockedTitle")}
        </p>
        {loadingBlocked ? (
          <p className="text-xs text-slate-500">{t("settings.about.loading")}</p>
        ) : null}
        {!loadingBlocked && !blockedUsers.length ? (
          <p className="rounded-2xl border border-dashed border-emerald-200 px-4 py-3 text-xs text-slate-500 dark:border-emerald-500/30">
            {t("settings.privacy.blockedEmpty")}
          </p>
        ) : null}
        <div className="space-y-2">
          {blockedUsers.map((blocked) => (
            <div
              key={`blocked-${blocked.username}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100/80 bg-white px-3 py-2 dark:border-emerald-500/25 dark:bg-slate-950/70"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={blocked.avatar_url}
                  name={blocked.nickname || blocked.username}
                  color={blocked.color || "var(--birdx-accent)"}
                  className="h-9 w-9 shrink-0"
                  useAccentColor={!blocked.avatar_url}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {blocked.nickname || blocked.username}
                  </p>
                  <p className="truncate text-xs text-slate-500" dir="ltr">
                    @{blocked.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleUnblock(blocked.username)}
                className="shrink-0 rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200"
              >
                {t("settings.privacy.unblock")}
              </button>
            </div>
          ))}
        </div>
      </section>

      {error ? <InlineError message={error} /> : null}
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
      >
        {t("settings.done")}
      </button>
    </div>
  );
}
