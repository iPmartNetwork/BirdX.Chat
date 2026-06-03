import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Close, Eye, EyeOff, Trash, Upload } from "../../../icons/lucide.js";
import { hasPersian } from "../../../utils/fontUtils.js";
import { getAvatarInitials } from "../../../utils/avatarInitials.js";
import { NICKNAME_MAX, USERNAME_MAX } from "../../../utils/nameLimits.js";
import { InlineError } from "../common/InlineError.jsx";
import { AboutSettingsPanel } from "../panels/AboutSettingsPanel.jsx";
import { DataSettingsPanel } from "../panels/DataSettingsPanel.jsx";
import { LanguageSettingsPanel } from "../panels/LanguageSettingsPanel.jsx";
import { ThemeSettingsPanel } from "../panels/ThemeSettingsPanel.jsx";
import ScheduledMessagesPanel from "../panels/ScheduledMessagesPanel.jsx";
import { PrivacySettingsPanel } from "../panels/PrivacySettingsPanel.jsx";
import TwoFactorSettings from "../panels/TwoFactorSettings.jsx";
import { DevicesSettingsPanel } from "../panels/DevicesSettingsPanel.jsx";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import ConfirmPasswordModal from "../../modals/ConfirmPasswordModal.jsx";
import Avatar from "../../common/Avatar.jsx";

export function DesktopSettingsModal({
  settingsPanel,
  setSettingsPanel,
  handleProfileSave,
  avatarPreview,
  profileForm,
  handleAvatarChange,
  handleAvatarRemove,
  setProfileForm,
  statusSelection,
  setStatusSelection,
  handlePasswordSave,
  passwordForm,
  setPasswordForm,
  userColor,
  profileError,
  passwordError,
  fileUploadEnabled,
  onClearCache,
  dataCacheStats,
  currentUser,
  onDeleteAccount,
  appInfo,
  appInfoLoading,
  appInfoError,
  dmPolicy,
  contactRequestPolicy = "everyone",
  onDmPolicyChange,
  onContactRequestPolicyChange,
  onUserUpdate,
}) {
  const { t } = useLanguage();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const handleClosePanel = useCallback(
    () => setSettingsPanel(null),
    [setSettingsPanel],
  );
  if (!settingsPanel) return null;
  if (typeof document === "undefined") return null;
  const resolvedUserColor = userColor || "#10b981";
  const profileIdentity = profileForm.nickname || profileForm.username || "S";
  const profileInitials = getAvatarInitials(profileIdentity);
  const nicknameHasPersian = hasPersian(profileForm.nickname || "");
  const usernameHasPersian = hasPersian(profileForm.username || "");
  const nicknameLength = String(profileForm.nickname || "").length;
  const usernameLength = String(profileForm.username || "").length;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-6">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-emerald-100/70 bg-white shadow-xl dark:border-emerald-500/30 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-emerald-100/70 px-6 py-5 dark:border-emerald-500/20">
          <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">
            {settingsPanel === "profile"
              ? t("settings.profile")
              : settingsPanel === "security"
                ? t("settings.security")
                : settingsPanel === "devices"
                  ? t("settings.devices")
                : settingsPanel === "privacy"
                  ? t("settings.privacy")
                : settingsPanel === "data"
                  ? t("settings.data")
                  : settingsPanel === "scheduled"
                    ? t("settings.scheduled")
                  : settingsPanel === "language"
                    ? t("settings.language")
                    : settingsPanel === "theme"
                      ? t("settings.theme")
                    : t("settings.about")}
          </h3>
          <button
            type="button"
            onClick={handleClosePanel}
            className="flex items-center justify-center rounded-full border border-rose-200 p-2 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 hover:shadow-[0_0_16px_rgba(244,63,94,0.2)] dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
            aria-label={t("settings.close")}
          >
            <Close size={18} className="icon-anim-pop" />
          </button>
        </div>

        {settingsPanel === "profile" ? (
          <form
            className="app-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6"
            onSubmit={handleProfileSave}
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.profile.photo")}
              </span>
              <div className="mt-3 flex items-center gap-4">
                <Avatar
                  src={avatarPreview}
                  alt={profileForm.nickname || profileForm.username}
                  name={profileIdentity}
                  color={resolvedUserColor}
                  initials={profileInitials}
                  className="h-14 w-14 flex-shrink-0"
                />
                <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <label
                    htmlFor="profilePhotoInput"
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      fileUploadEnabled
                        ? "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20 dark:hover:shadow-md"
                        : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
                    }`}
                  >
                    <Upload size={18} className="icon-anim-lift" />
                    <span>{t("settings.profile.upload")}</span>
                  </label>
                  <input
                    id="profilePhotoInput"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="sr-only"
                    disabled={!fileUploadEnabled}
                  />
                  {avatarPreview ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleAvatarRemove();
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-800/50"
                      aria-label={t("settings.profile.remove")}
                    >
                      <Trash size={18} className="icon-anim-sway" />
                    </button>
                  ) : null}
                </div>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.profile.nickname")}
              </span>
              <div className="relative mt-2">
                <input
                  value={profileForm.nickname}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      nickname: event.target.value,
                    }))
                  }
                  maxLength={NICKNAME_MAX}
                  lang={nicknameHasPersian ? "fa" : "en"}
                  dir={nicknameHasPersian ? "rtl" : "ltr"}
                  className={`w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 pr-16 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                    nicknameHasPersian ? "font-fa text-right" : "text-left"
                  }`}
                  style={{ unicodeBidi: "plaintext" }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-slate-500">
                  {nicknameLength}/{NICKNAME_MAX}
                </span>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.profile.username")}
              </span>
              <div className="relative mt-2">
                <input
                  value={profileForm.username}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  maxLength={USERNAME_MAX}
                  pattern="[a-zA-Z0-9._]+"
                  title={t("settings.profile.usernameHint")}
                  autoCapitalize="none"
                  lang={usernameHasPersian ? "fa" : "en"}
                  dir={usernameHasPersian ? "rtl" : "ltr"}
                  className={`w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 pr-16 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                    usernameHasPersian ? "font-fa text-right" : "text-left"
                  }`}
                  style={{ unicodeBidi: "plaintext" }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-slate-500">
                  {usernameLength}/{USERNAME_MAX}
                </span>
              </div>
            </label>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.status.title")}
              </p>
              <div className="mt-2 flex flex-row gap-2">
                {[
                  { value: "online", label: t("chat.online") },
                  { value: "invisible", label: t("chat.invisible") },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusSelection(value)}
                    className={`flex items-center gap-2 rounded-2xl border border-2 px-3 py-2 text-xs font-medium transition duration-200 ${
                      statusSelection === value
                        ? "border-emerald-500 bg-emerald-100/50 text-emerald-700 shadow-md dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "border-emerald-100/70 bg-white/80 text-slate-700 hover:bg-emerald-50/30 dark:border-emerald-500/30 dark:bg-slate-950/50 dark:text-slate-100 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full transition duration-200 ${value === "online" ? "bg-emerald-400" : "bg-slate-400"}`}
                    />
                    <span className={hasPersian(label) ? "font-fa" : ""}>{label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t("settings.status.invisibleHint")}
              </p>
            </div>
            {onDeleteAccount ? (
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
              >
                <Trash size={16} className="icon-anim-sway" />
                {t("settings.profile.deleteAccount")}
              </button>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              {t("settings.profile.save")}
            </button>
            <InlineError message={profileError} />
          </form>
        ) : null}

        {settingsPanel === "devices" ? (
          <div className="app-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <DevicesSettingsPanel user={currentUser} onClose={handleClosePanel} />
          </div>
        ) : null}

        {settingsPanel === "security" ? (
          <div className="app-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <form
            className="space-y-4"
            onSubmit={handlePasswordSave}
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.security.currentPassword")}
              </span>
              <div className="relative mt-2">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: event.target.value,
                    }))
                  }
                  placeholder={showCurrentPassword ? "12345678" : "********"}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 pr-20 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-emerald-700 transition hover:bg-emerald-100 hover:shadow-[0_0_18px_rgba(16,185,129,0.22)] dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  aria-label={
                    showCurrentPassword
                      ? t("settings.security.hideCurrent")
                      : t("settings.security.showCurrent")
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff size={16} className="icon-anim-peek" />
                  ) : (
                    <Eye size={16} className="icon-anim-peek" />
                  )}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.security.newPassword")}
              </span>
              <div className="relative mt-2">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                    }))
                  }
                  placeholder={showNewPassword ? "12345678" : "********"}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 pr-20 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-emerald-700 transition hover:bg-emerald-100 hover:shadow-[0_0_18px_rgba(16,185,129,0.22)] dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  aria-label={
                    showNewPassword
                      ? t("settings.security.hideNew")
                      : t("settings.security.showNew")
                  }
                >
                  {showNewPassword ? (
                    <EyeOff size={16} className="icon-anim-peek" />
                  ) : (
                    <Eye size={16} className="icon-anim-peek" />
                  )}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("settings.security.confirmPassword")}
              </span>
              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder={showConfirmPassword ? "12345678" : "********"}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 pr-20 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-emerald-700 transition hover:bg-emerald-100 hover:shadow-[0_0_18px_rgba(16,185,129,0.22)] dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  aria-label={
                    showConfirmPassword
                      ? t("settings.security.hideConfirm")
                      : t("settings.security.showConfirm")
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} className="icon-anim-peek" />
                  ) : (
                    <Eye size={16} className="icon-anim-peek" />
                  )}
                </button>
              </div>
            </label>
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              {t("settings.security.update")}
            </button>
            <InlineError message={passwordError} />
          </form>
          <TwoFactorSettings />
          </div>
        ) : null}

        {settingsPanel === "privacy" ? (
          <PrivacySettingsPanel
            user={currentUser}
            dmPolicy={dmPolicy}
            contactRequestPolicy={contactRequestPolicy}
            onDmPolicyChange={onDmPolicyChange}
            onContactRequestPolicyChange={onContactRequestPolicyChange}
            onDone={handleClosePanel}
          />
        ) : null}

        {settingsPanel === "data" ? (
          <div className="app-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <DataSettingsPanel
              dataCacheStats={dataCacheStats}
              onClearCache={onClearCache}
              onClose={handleClosePanel}
              user={currentUser}
              variant="desktop"
            />
          </div>
        ) : null}

        {settingsPanel === "scheduled" ? (
          <div className="app-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <ScheduledMessagesPanel user={currentUser} />
          </div>
        ) : null}

        {settingsPanel === "language" ? (
          <div className="app-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <LanguageSettingsPanel onClose={handleClosePanel} variant="desktop" />
          </div>
        ) : null}

        {settingsPanel === "theme" ? (
          <div className="app-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <ThemeSettingsPanel
              user={currentUser}
              onUserUpdate={onUserUpdate}
              onClose={handleClosePanel}
              variant="desktop"
            />
          </div>
        ) : null}

        {settingsPanel === "about" ? (
          <div className="mt-4 min-h-0 flex-1 px-6 pb-6">
            <AboutSettingsPanel
              appInfo={appInfo}
              appInfoLoading={appInfoLoading}
              appInfoError={appInfoError}
              onDone={handleClosePanel}
              variant="desktop"
            />
          </div>
        ) : null}
      </div>

      <ConfirmPasswordModal
        open={deleteModalOpen}
        title={t("settings.profile.deleteTitle")}
        description={t("settings.profile.deleteDescription")}
        confirmLabel={t("settings.profile.deleteContinue")}
        deleteLabel={t("settings.profile.deleteConfirm")}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async (password) => {
          await onDeleteAccount?.(password);
        }}
      />
    </div>,
    document.body,
  );
}
