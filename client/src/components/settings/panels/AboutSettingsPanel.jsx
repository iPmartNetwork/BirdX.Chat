import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  LoaderCircle,
  Refresh,
} from "../../../icons/lucide.js";
import { FaGithub, FaGlobe, FaTelegram } from "react-icons/fa6";
import { checkAppVersion } from "../../../api/appMetaApi.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { ABOUT_CONTENT } from "../../../settings/aboutContent.js";
import { copyTextToClipboard } from "../../../utils/clipboard.js";

const SOCIAL_ICONS = {
  github: FaGithub,
  telegram: FaTelegram,
  website: FaGlobe,
};

function WalletRow({ label, address, copyLabel, copiedLabel }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl border border-indigo-200/70 bg-white/90 p-3 dark:border-indigo-500/30 dark:bg-slate-900/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            {label}
          </p>
          <code className="mt-2 block break-all text-xs text-slate-700 dark:text-slate-200">
            {address}
          </code>
        </div>
        <button
          type="button"
          onClick={async () => {
            const didCopy = await copyTextToClipboard(address);
            if (!didCopy) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-[0_0_14px_rgba(99,102,241,0.2)] dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
          aria-label={`Copy ${label} wallet`}
        >
          <Copy size={12} className="icon-anim-pop" />
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  );
}

export function AboutSettingsPanel({
  appInfo,
  appInfoLoading,
  appInfoError,
  onDone,
  variant = "desktop",
}) {
  const { t } = useLanguage();
  const isMobile = variant === "mobile";
  const [checkState, setCheckState] = useState({
    status: "",
    latestVersion: "",
    latestTag: "",
  });
  const resetCheckStateTimerRef = useRef(null);

  const versionLabel =
    String(appInfo?.version || t("settings.about.unknown")).trim() ||
    t("settings.about.unknown");
  const ownerHref = ABOUT_CONTENT.copyright?.ownerHref || "";
  const ownerLabel = ABOUT_CONTENT.copyright?.ownerLabel || "iPmartNetwork";
  const year = new Date().getFullYear();
  const rowBase =
    "flex w-full items-center justify-between gap-3 rounded-2xl border border-indigo-200/70 bg-white/90 px-4 py-3 text-start text-sm font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-slate-900/50 dark:text-indigo-200";
  const actionButtonBase =
    "inline-flex h-7 min-w-[58px] items-center justify-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-none transition";

  useEffect(() => {
    return () => {
      if (resetCheckStateTimerRef.current) {
        window.clearTimeout(resetCheckStateTimerRef.current);
      }
    };
  }, []);

  const scheduleCheckStateReset = () => {
    if (resetCheckStateTimerRef.current) {
      window.clearTimeout(resetCheckStateTimerRef.current);
    }
    resetCheckStateTimerRef.current = window.setTimeout(() => {
      setCheckState({
        status: "",
        latestVersion: "",
        latestTag: "",
      });
      resetCheckStateTimerRef.current = null;
    }, 3200);
  };

  const currentButtonStyle = (() => {
    if (checkState.status === "checking") {
      return {
        className:
          "cursor-wait border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-[0_0_14px_rgba(99,102,241,0.2)] dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-indigo-500/10",
        label: t("settings.about.checking"),
        icon: <LoaderCircle size={12} className="animate-spin" />,
      };
    }
    if (checkState.status === "error") {
      return {
        className:
          "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
        label: t("settings.about.failed"),
        icon: <AlertCircle size={13} />,
      };
    }
    if (checkState.status === "update-available") {
      return {
        className:
          "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        label: t("settings.about.updateAvailable"),
        icon: <AlertCircle size={13} />,
      };
    }
    if (checkState.status === "up-to-date") {
      return {
        className:
          "border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200",
        label: t("settings.about.upToDate"),
        icon: <Check size={13} />,
      };
    }
    return {
      className: "bg-indigo-500 text-white hover:bg-indigo-400",
      label: t("settings.about.check"),
      icon: <Refresh size={13} />,
    };
  })();

  return (
    <div className="space-y-4 text-slate-600 dark:text-slate-300">
      <div
        className={
          isMobile
            ? "space-y-3"
            : "app-scroll max-h-[calc(100dvh-18rem)] space-y-3 overflow-y-auto pr-1"
        }
      >
        <div className={rowBase}>
          <span>{t("settings.about.version")}</span>
          <span className="truncate text-slate-600 dark:text-slate-300">
            {appInfoLoading ? t("settings.about.loading") : versionLabel}
          </span>
        </div>

        <div className={`${rowBase} items-start`}>
          <div className="min-w-0 flex-1">
            <p>{t("settings.about.checkUpdates")}</p>
            {appInfoError ? (
              <p className="mt-1 text-xs font-normal text-rose-600 dark:text-rose-300">
                {appInfoError}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (resetCheckStateTimerRef.current) {
                window.clearTimeout(resetCheckStateTimerRef.current);
                resetCheckStateTimerRef.current = null;
              }
              setCheckState({
                status: "checking",
                latestVersion: "",
                latestTag: "",
              });
              try {
                const payload = await checkAppVersion(appInfo);
                setCheckState({
                  status: payload?.status || "up-to-date",
                  latestVersion: String(payload?.latestVersion || ""),
                  latestTag: String(payload?.latestTag || ""),
                });
                scheduleCheckStateReset();
              } catch {
                setCheckState({
                  status: "error",
                  latestVersion: "",
                  latestTag: "",
                });
                scheduleCheckStateReset();
              }
            }}
            disabled={checkState.status === "checking"}
            className={`${actionButtonBase} ${currentButtonStyle.className}`}
          >
            {currentButtonStyle.icon}
            <span>{currentButtonStyle.label}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-indigo-200/70 bg-white/90 p-4 dark:border-indigo-500/30 dark:bg-slate-900/50">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">
            {t("settings.about.supportProject")}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {t("settings.about.supportIntro")}
          </p>
          <div className="mt-3 space-y-2.5">
            {ABOUT_CONTENT.wallets.map((wallet) => (
              <WalletRow
                key={wallet.label}
                label={wallet.label}
                address={wallet.address}
                copyLabel={t("settings.about.copy")}
                copiedLabel={t("settings.about.copied")}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-indigo-100/80 pt-4 dark:border-indigo-500/20">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {ABOUT_CONTENT.socials.map((item) => {
              const Icon = SOCIAL_ICONS[item.icon];
              return (
                <a
                  key={`${item.icon}-${item.href}`}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.icon}
                  title={item.icon}
                  className="group inline-flex items-center justify-center p-1 text-slate-500 transition hover:text-indigo-700 dark:text-slate-400 dark:hover:text-indigo-200"
                >
                  <span className="inline-flex items-center justify-center text-slate-600 transition group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-200">
                    {Icon ? <Icon size={24} /> : null}
                  </span>
                </a>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            {"\u00A9"} {year}{" "}
            <a
              href={ownerHref}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-slate-600 underline-offset-4 transition hover:text-indigo-700 hover:underline dark:text-slate-300 dark:hover:text-indigo-200"
            >
              {ownerLabel}
            </a>
          </p>
          <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
            {t("settings.about.rights")}
          </p>
          <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
            {t("settings.about.freedom")}
          </p>
        </div>
      </div>

      {!isMobile ? (
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => onDone?.()}
            className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
          >
            {t("settings.done")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
