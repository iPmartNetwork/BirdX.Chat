import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Close,
  Copy,
  Globe,
  LoaderCircle,
  Lock,
  Trash,
  Upload,
} from "../../icons/lucide.js";
import { copyTextToClipboard } from "../../utils/clipboard.js";
import { getAvatarStyle } from "../../utils/avatarColor.js";
import { hasPersian } from "../../utils/fontUtils.js";
import { getAvatarInitials } from "../../utils/avatarInitials.js";
import { NICKNAME_MAX, USERNAME_MAX } from "../../utils/nameLimits.js";
import ConfirmPasswordModal from "./ConfirmPasswordModal.jsx";
import Avatar from "../common/Avatar.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

function formatTemplate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`,
  );
}

export default function NewGroupModal({
  open,
  groupForm = {},
  setGroupForm,
  groupSearchQuery = "",
  setGroupSearchQuery,
  groupSearchResults = [],
  groupSearchLoading,
  selectedGroupMembers = [],
  setSelectedGroupMembers,
  groupError,
  setGroupError,
  creatingGroup,
  onCreate,
  onClose,
  title = "New group",
  submitLabel = "Create",
  avatarPreview = "",
  avatarColor = "#10b981",
  avatarName = "Group",
  onAvatarChange,
  onAvatarRemove,
  showAvatarField = false,
  hideSelectedMemberChips = false,
  fileUploadEnabled = true,
  showInviteManagement = false,
  currentInviteLink = "",
  regeneratingInviteLink = false,
  onRegenerateInvite,
  entityLabel = "Group",
  entityType = "group",
  onDeleteChat,
  showRemoteChannelSettings = false,
  remoteChannelAvailable = true,
}) {
  const { t, isRtl, language } = useLanguage();
  const [copiedRegenerateLink, setCopiedRegenerateLink] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const groupSearchInputRef = useRef(null);
  if (!open) return null;
  if (typeof document === "undefined") return null;

  const resolvedEntityType =
    entityType === "channel" || entityType === "group" ? entityType : "group";
  const entityName = t(
    resolvedEntityType === "channel" ? "chat.channel" : "chat.group",
  );
  const tf = (key, vars = {}) => formatTemplate(t(key), { entity: entityName, ...vars });

  const safeGroupForm = {
    nickname: String(groupForm?.nickname || ""),
    username: String(groupForm?.username || ""),
    visibility: String(groupForm?.visibility || "public"),
    allowMemberInvites: groupForm?.allowMemberInvites !== false,
    remoteChannelEnabled: Boolean(groupForm?.remoteChannelEnabled),
    remoteChannelProvider: String(groupForm?.remoteChannelProvider || "telegram"),
    remoteChannelSource: String(groupForm?.remoteChannelSource || ""),
    remoteChannelSyncMetadata: Boolean(groupForm?.remoteChannelSyncMetadata),
    remoteChannelStreamMedia: Boolean(groupForm?.remoteChannelStreamMedia),
    remoteChannelStatus: groupForm?.remoteChannelStatus || null,
    remoteChannelLoading: Boolean(groupForm?.remoteChannelLoading),
  };
  const safeSearchQuery = String(groupSearchQuery || "");
  const safeSearchResults = Array.isArray(groupSearchResults)
    ? groupSearchResults.filter((item) => item && typeof item === "object")
    : [];
  const safeSelectedMembers = Array.isArray(selectedGroupMembers)
    ? selectedGroupMembers.filter((item) => item && typeof item === "object")
    : [];
  const safeEntityLabel = String(entityLabel || entityName);
  const safeAvatarName = String(avatarName || safeEntityLabel || entityName);
  const namePlaceholder =
    resolvedEntityType === "channel"
      ? t("chat.form.placeholderNameChannel")
      : t("chat.form.placeholderNameGroup");
  const userPlaceholder =
    resolvedEntityType === "channel"
      ? t("chat.form.placeholderUserChannel")
      : t("chat.form.placeholderUserGroup");

  const selectedMemberNames = new Set(
    safeSelectedMembers.map((member) => String(member?.username || "")),
  );
  const nicknameHasPersian = hasPersian(safeGroupForm.nickname);
  const usernameHasPersian = hasPersian(safeGroupForm.username);
  const groupSearchHasPersian = hasPersian(safeSearchQuery);
  const remoteSourceHasPersian = hasPersian(safeGroupForm.remoteChannelSource);
  const remoteLastError =
    safeGroupForm.remoteChannelStatus?.source?.lastError ||
    safeGroupForm.remoteChannelStatus?.error ||
    "";
  const remoteQueue = safeGroupForm.remoteChannelStatus?.source?.queue || {};

  return createPortal(
    <>
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-6 sm:px-6">
        <div
          className={`app-scroll max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-100/80 bg-white p-5 shadow-2xl shadow-emerald-900/5 dark:border-emerald-500/25 dark:bg-slate-950 sm:p-6 ${
            language === "fa" ? "font-fa" : ""
          }`}
          lang={language === "fa" ? "fa" : "en"}
          dir={isRtl ? "rtl" : "ltr"}
        >
          <div className="flex items-center justify-between gap-3 border-b border-emerald-100/70 pb-4 dark:border-emerald-500/20">
            <h3
              className={`text-lg font-semibold text-emerald-700 dark:text-emerald-200 ${
                language === "fa" ? "font-fa" : ""
              }`}
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex shrink-0 items-center justify-center rounded-full border border-rose-200 p-2 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 hover:shadow-[0_0_16px_rgba(244,63,94,0.2)] dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
              aria-label={t("chat.form.close")}
            >
              <Close size={18} className="icon-anim-pop" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {showAvatarField ? (
              <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/30 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {tf("chat.form.photo")}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Group avatar preview"
                      className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold ${hasPersian(getAvatarInitials(safeAvatarName || "G")) ? "font-fa" : ""}`}
                      style={getAvatarStyle(avatarColor || "#10b981")}
                    >
                      {getAvatarInitials(safeAvatarName || "G")}
                    </div>
                  )}
                  <div className="flex w-full flex-nowrap items-center gap-2">
                    <label
                      htmlFor="groupPhotoInput"
                      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        fileUploadEnabled
                          ? "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:shadow-md dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20 dark:hover:shadow-md"
                          : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
                      }`}
                    >
                      <Upload size={18} className="icon-anim-lift" />
                      <span>{t("chat.form.uploadPhoto")}</span>
                    </label>
                    <input
                      id="groupPhotoInput"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={onAvatarChange}
                      disabled={!fileUploadEnabled}
                    />
                    {avatarPreview ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onAvatarRemove?.();
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-800/50"
                        aria-label={t("chat.form.removePhoto")}
                      >
                        <Trash size={18} className="icon-anim-sway" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("chat.form.displayName")}
              </label>
              <div className="relative">
                <input
                  value={safeGroupForm.nickname}
                  onChange={(event) => {
                    setGroupForm?.((prev) => ({
                      ...prev,
                      nickname: event.target.value,
                    }));
                    setGroupError?.("");
                  }}
                  maxLength={NICKNAME_MAX}
                  placeholder={namePlaceholder}
                  lang={nicknameHasPersian ? "fa" : "en"}
                  dir={nicknameHasPersian ? "rtl" : "ltr"}
                  className={`w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                    nicknameHasPersian ? "font-fa" : ""
                  }`}
                  style={{ unicodeBidi: "plaintext" }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("chat.form.username")}
              </label>
              <div className="relative">
                <input
                  value={safeGroupForm.username}
                  onChange={(event) => {
                    setGroupForm?.((prev) => ({
                      ...prev,
                      username: event.target.value.toLowerCase(),
                    }));
                    setGroupError?.("");
                  }}
                  maxLength={USERNAME_MAX}
                  placeholder={userPlaceholder}
                  lang="en"
                  dir="ltr"
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-start text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
                  style={{ unicodeBidi: "plaintext" }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100/80 bg-slate-50/50 p-3 dark:border-emerald-500/25 dark:bg-slate-900/40">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t("chat.form.visibility")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-200/80 bg-white p-1 dark:border-emerald-500/30 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() =>
                    setGroupForm?.((prev) => ({ ...prev, visibility: "public" }))
                  }
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    safeGroupForm.visibility === "public"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                      : "text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-emerald-500/10"
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Globe size={14} className="icon-anim-bob" />
                    {t("chat.form.public")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGroupForm?.((prev) => ({ ...prev, visibility: "private" }))
                  }
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    safeGroupForm.visibility === "private"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                      : "text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-emerald-500/10"
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Lock size={14} className="icon-anim-bob" />
                    {t("chat.form.private")}
                  </span>
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {safeGroupForm.visibility === "public"
                  ? tf("chat.form.publicHint")
                  : tf("chat.form.privateHint")}
              </p>
              {safeGroupForm.visibility === "private" ? (
                <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-100/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-500/20 dark:bg-slate-950 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={safeGroupForm.allowMemberInvites !== false}
                    onChange={(event) =>
                      setGroupForm?.((prev) => ({
                        ...prev,
                        allowMemberInvites: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 shrink-0 rounded border border-emerald-300 bg-white accent-emerald-500 focus:ring-2 focus:ring-emerald-300 dark:border-emerald-500/40 dark:bg-slate-900 dark:accent-emerald-400"
                  />
                  <span>{t("chat.form.allowInvites")}</span>
                </label>
              ) : null}
            </div>

            {showInviteManagement ? (
              <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/30 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t("chat.form.inviteLink")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {t("chat.form.inviteRegenerateHint")}
                </p>
                <div className="mt-2 rounded-xl border border-emerald-200 bg-white p-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-200">
                  <span className="break-all" dir="ltr">
                    {currentInviteLink || t("chat.form.noInviteLink")}
                  </span>
                </div>
                <div
                  className={`mt-3 flex items-center gap-2 ${isRtl ? "flex-row-reverse justify-start" : "justify-end"}`}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      const value = String(currentInviteLink || "");
                      if (!value) return;
                      try {
                        await copyTextToClipboard(value);
                      } catch {
                        // ignore clipboard errors
                      }
                      setCopiedRegenerateLink(true);
                      window.setTimeout(
                        () => setCopiedRegenerateLink(false),
                        1400,
                      );
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_0_14px_rgba(16,185,129,0.2)] dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  >
                    <Copy size={12} className="icon-anim-pop" />
                    {copiedRegenerateLink ? t("chat.form.copied") : t("chat.form.copy")}
                  </button>
                  <button
                    type="button"
                    onClick={onRegenerateInvite}
                    disabled={regeneratingInviteLink}
                    className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_0_14px_rgba(16,185,129,0.2)] disabled:opacity-60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  >
                    {regeneratingInviteLink ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : null}
                    {t("chat.form.regenerate")}
                  </button>
                </div>
              </div>
            ) : null}

            {showRemoteChannelSettings ? (
              <div className="rounded-2xl border border-emerald-100/80 bg-slate-50/50 p-4 dark:border-emerald-500/25 dark:bg-slate-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t("chat.form.remoteChannel")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {t("chat.form.remoteChannelHint")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={safeGroupForm.remoteChannelEnabled}
                    disabled={!remoteChannelAvailable}
                    onClick={() =>
                      remoteChannelAvailable &&
                      setGroupForm?.((prev) => ({
                        ...prev,
                        remoteChannelEnabled: !prev.remoteChannelEnabled,
                      }))
                    }
                    className={`h-7 w-12 rounded-full p-1 transition ${
                      safeGroupForm.remoteChannelEnabled && remoteChannelAvailable
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-700"
                    } ${remoteChannelAvailable ? "" : "opacity-60"}`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition ${
                        safeGroupForm.remoteChannelEnabled && remoteChannelAvailable
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {!remoteChannelAvailable ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    {t("chat.form.remoteNotConfigured")}
                  </p>
                ) : null}
                {safeGroupForm.remoteChannelLoading ? (
                  <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <LoaderCircle size={13} className="animate-spin" />
                    {t("chat.form.remoteLoading")}
                  </p>
                ) : null}
                {remoteLastError ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200">
                    {remoteLastError}
                  </p>
                ) : null}
                {safeGroupForm.remoteChannelEnabled && remoteChannelAvailable ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t("chat.form.remoteSource")}
                      </label>
                      <input
                        value={safeGroupForm.remoteChannelSource}
                        onChange={(event) =>
                          setGroupForm?.((prev) => ({
                            ...prev,
                            remoteChannelSource: event.target.value,
                          }))
                        }
                        placeholder={t("chat.form.remoteSourcePlaceholder")}
                        lang={remoteSourceHasPersian ? "fa" : "en"}
                        dir={remoteSourceHasPersian ? "rtl" : "ltr"}
                        className={`mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                          remoteSourceHasPersian ? "font-fa text-right" : "text-left"
                        }`}
                        style={{ unicodeBidi: "plaintext" }}
                      />
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-slate-200">
                      <span>{t("chat.form.remoteSyncTitle")}</span>
                      <input
                        type="checkbox"
                        checked={safeGroupForm.remoteChannelSyncMetadata}
                        onChange={(event) =>
                          setGroupForm?.((prev) => ({
                            ...prev,
                            remoteChannelSyncMetadata: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-emerald-300 accent-emerald-500"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-slate-200">
                      <span>{t("chat.form.remoteStreamMedia")}</span>
                      <input
                        type="checkbox"
                        checked={safeGroupForm.remoteChannelStreamMedia}
                        onChange={(event) =>
                          setGroupForm?.((prev) => ({
                            ...prev,
                            remoteChannelStreamMedia: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-emerald-300 accent-emerald-500"
                      />
                    </label>
                    {Object.keys(remoteQueue).length ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Queue: {Object.entries(remoteQueue).map(([key, value]) => `${key} ${value}`).join(" - ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-emerald-100/80 bg-slate-50/50 p-4 dark:border-emerald-500/25 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t("chat.form.addMembers")}
                </p>
                {safeSelectedMembers.length > 0 ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                    {tf("chat.form.membersCount", {
                      count: safeSelectedMembers.length,
                    })}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t("chat.form.memberSearchHint")}
              </p>
              <div className="relative mt-2">
                <input
                  ref={groupSearchInputRef}
                  value={safeSearchQuery}
                  onChange={(event) => {
                    setGroupSearchQuery?.(event.target.value);
                    setGroupError?.("");
                  }}
                  placeholder={t("chat.form.memberSearchPlaceholder")}
                  lang="en"
                  dir="ltr"
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 pe-12 ps-4 text-start text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100"
                  style={{ unicodeBidi: "plaintext" }}
                />
                {safeSearchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => setGroupSearchQuery?.("")}
                    className="absolute end-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-rose-600 transition hover:bg-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.22)] dark:text-rose-200 dark:hover:bg-rose-500/10"
                    aria-label={t("chat.search")}
                  >
                    <Close size={16} className="icon-anim-pop" />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {safeSearchResults.length ? (
                  <div className="app-scroll max-h-64 space-y-2 overflow-y-auto pr-1">
                    {safeSearchResults.map((result) => {
                      const resultUsername = String(result?.username || "");
                      const selected = selectedMemberNames.has(resultUsername);
                      const label = result?.nickname || resultUsername;
                      const avatarInitials = getAvatarInitials(label);
                      return (
                        <button
                          key={resultUsername}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            if (selected) {
                              setSelectedGroupMembers?.((prev) =>
                                (Array.isArray(prev) ? prev : []).filter(
                                  (member) =>
                                    String(member?.username || "") !==
                                    resultUsername,
                                ),
                              );
                              groupSearchInputRef.current?.focus?.();
                              return;
                            }
                            setSelectedGroupMembers?.((prev) => [
                              ...(Array.isArray(prev) ? prev : []),
                              { ...result, username: resultUsername },
                            ]);
                            setGroupSearchQuery?.("");
                            groupSearchInputRef.current?.focus?.();
                          }}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-start text-sm font-medium transition ${
                            selected
                              ? "border-emerald-500 border-2 bg-emerald-50 text-emerald-900 shadow-md dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-100"
                              : "border-emerald-100/70 bg-white/80 text-slate-700 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
                          }`}
                        >
                          <Avatar
                            src={result.avatar_url}
                            alt={label}
                            name={label}
                            color={result.color || "#10b981"}
                            initials={avatarInitials}
                            className="h-8 w-8"
                          />
                          <div className="min-w-0">
                            <p
                              className={`truncate font-semibold ${hasPersian(label) ? "font-fa" : ""}`}
                              dir="auto"
                              title={label}
                            >
                              {label}
                            </p>
                            <p
                              className="truncate text-xs text-slate-500 dark:text-slate-400"
                              dir="auto"
                            >
                              @{resultUsername}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : groupSearchLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("chat.searching")}
                  </p>
                ) : safeSearchQuery.trim() ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("chat.noUsersFound")}
                  </p>
                ) : null}
              </div>
              {safeSelectedMembers.length > 0 && !hideSelectedMemberChips ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {safeSelectedMembers.map((member) => {
                    const memberUsername = String(member?.username || "");
                    const label = member?.nickname || memberUsername;
                    const initials = getAvatarInitials(label);
                    return (
                      <button
                        key={`member-chip-${memberUsername}`}
                        type="button"
                        onClick={() =>
                          setSelectedGroupMembers?.((prev) =>
                            (Array.isArray(prev) ? prev : []).filter(
                              (item) =>
                                String(item?.username || "") !== memberUsername,
                            ),
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        <Avatar
                          src={member.avatar_url}
                          alt={label}
                          name={label}
                          color={member.color || "#10b981"}
                          initials={initials}
                          className="h-4 w-4 text-[9px]"
                        />
                        <span
                          className="max-w-[160px] truncate"
                          dir="auto"
                          title={memberUsername}
                        >
                          @{memberUsername}
                        </span>
                        <Close size={12} />
                      </button>
                    );
                  })}
                </div>
              ) : !hideSelectedMemberChips ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {t("chat.form.noMembersYet")}
                </p>
              ) : null}
            </div>
          </div>

          {groupError ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200">
              {groupError}
            </p>
          ) : null}

          {onDeleteChat ? (
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
            >
              <Trash size={16} className="icon-anim-sway" />
              {tf("chat.form.deleteEntity")}
            </button>
          ) : null}

          <div
            className={`mt-5 flex items-center gap-2 border-t border-emerald-100/70 pt-4 dark:border-emerald-500/20 ${
              isRtl ? "flex-row-reverse justify-start" : "justify-end"
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70"
            >
              {t("chat.cancel")}
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={creatingGroup}
              className="inline-flex min-w-[6.5rem] items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:opacity-70"
            >
              {creatingGroup ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  {t("chat.saving")}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmPasswordModal
        open={deleteModalOpen}
        title={tf("chat.form.deleteEntityTitle")}
        description={tf("chat.form.deleteEntityDesc")}
        confirmLabel={t("chat.form.deleteContinue")}
        deleteLabel={tf("chat.form.deleteConfirm")}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async (password) => {
          await onDeleteChat?.(password);
        }}
      />
    </>,
    document.body,
  );
}
