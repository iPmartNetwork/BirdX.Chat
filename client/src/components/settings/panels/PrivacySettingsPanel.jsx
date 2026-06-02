import { useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { updateDmPolicy } from "../../../api/chatApi.js";
import { InlineError } from "../common/InlineError.jsx";

const POLICY_OPTIONS = [
  { value: "acquaintances", labelKey: "settings.privacy.acquaintances" },
  { value: "everyone", labelKey: "settings.privacy.everyone" },
  { value: "nobody", labelKey: "settings.privacy.nobody" },
];

export function PrivacySettingsPanel({ user, dmPolicy, onDmPolicyChange, onDone }) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = async (nextPolicy) => {
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
        throw new Error(data?.error || "Unable to save privacy setting.");
      }
      onDmPolicyChange?.(data.dmPolicy || nextPolicy);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t("settings.privacy.intro")}
      </p>
      <div className="space-y-2">
        {POLICY_OPTIONS.map((option) => {
          const active = dmPolicy === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving}
              onClick={() => handleSelect(option.value)}
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
        })}
      </div>
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
