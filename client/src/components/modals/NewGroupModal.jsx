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
  avatarColor = "#3b82f6",
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
  onDeleteChat,
  showRemoteChannelSettings = false,
  remoteChannelAvailable = true,
}) {
  const [copiedRegenerateLink, setCopiedRegenerateLink] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const groupSearchInputRef = useRef(null);
  if (!open) return null;
  if (typeof document === "undefined") return null;

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
  const safeEntityLabel = String(entityLabel || "Group");
  const safeAvatarName = String(avatarName || safeEntityLabel || "Group");

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
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-6">
        <div className="app-scroll max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-primary-100/70 bg-white p-6 shadow-xl dark:border-primary-500/30 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-200">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-full border border-rose-200 p-2 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 hover:shadow-[0_0_16px_rgba(244,63,94,0.2)] dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              <Close size={18} className="icon-anim-pop" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {showAvatarField ? (
              <div className="rounded-2xl border border-primary-200 p-3 dark:border-primary-500/30">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {safeEntityLabel} photo
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
                      style={getAvatarStyle(avatarColor || "#3b82f6")}
                    >
                      {getAvatarInitials(safeAvatarName || "G")}
                    </div>
                  )}
                  <div className="flex w-full flex-nowrap items-center gap-2">
                    <label
                      htmlFor="groupPhotoInput"
                      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        fileUploadEnabled
                          ? "cursor-pointer border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 hover:shadow-md dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-primary-500/20 dark:hover:shadow-md"
                          : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
                      }`}
                    >
                      <Upload size={18} className="icon-anim-lift" />
                      <span>Upload Photo</span>
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
                        aria-label={`Remove ${safeEntityLabel.toLowerCase()} photo`}
                      >
                        <Trash size={18} className="icon-anim-sway" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {safeEntityLabel} nickname
              </label>
              <div className="relative mt-2">
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
                  placeholder={`My ${safeEntityLabel.toLowerCase()}`}
                  lang={nicknameHasPersian ? "fa" : "en"}
                  dir={nicknameHasPersian ? "rtl" : "ltr"}
                  className={`w-full rounded-2xl border border-primary-200 bg-white px-4 py-3 pr-16 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-300/60 dark:border-primary-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                    nicknameHasPersian ? "font-fa text-right" : "text-left"
                  }`}
                  style={{ unicodeBidi: "plaintext" }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-slate-500">
                  {safeGroupForm.nickname.length}/{NICKNAME_MAX}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {safeEntityLabel} username
              </label>
              <div className="relative mt-2">
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
                  placeholder={`my${safeEntityLabel.toLowerCase()}`}
                  lang={usernameHasPersian ? "fa" : "en"}
                  dir={usernameHasPersian ? "rtl" : "ltr"}
                  className={`w-full rounded-2xl border border-primary-200 bg-white px-4 py-3 pr-16 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-300/60 dark:border-primary-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                    usernameHasPersian ? "font-fa text-right" : "text-left"
                  }`}
                  style={{ unicodeBidi: "plaintext" }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-slate-500">
                  {safeGroupForm.username.length}/{USERNAME_MAX}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Visibility
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-primary-200 p-1 dark:border-primary-500/30">
                <button
                  type="button"
                  onClick={() =>
                    setGroupForm?.((prev) => ({ ...prev, visibility: "public" }))
                  }
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    safeGroupForm.visibility === "public"
                      ? "bg-primary-500 text-white"
                      : "text-slate-700 hover:bg-primary-50 dark:text-slate-200 dark:hover:bg-primary-500/10"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={14} className="icon-anim-bob" />
                    Public
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGroupForm?.((prev) => ({ ...prev, visibility: "private" }))
                  }
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    safeGroupForm.visibility === "private"
                      ? "bg-primary-500 text-white"
                      : "text-slate-700 hover:bg-primary-50 dark:text-slate-200 dark:hover:bg-primary-500/10"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={14} className="icon-anim-bob" />
                    Private
                  </span>
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {safeGroupForm.visibility === "public"
                  ? `Anyone can discover and join this ${safeEntityLabel.toLowerCase()}.`
                  : `Private ${safeEntityLabel.toLowerCase()}s can only be joined via invite link.`}
              </p>
              {safeGroupForm.visibility === "private" ? (
                <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={safeGroupForm.allowMemberInvites !== false}
                    onChange={(event) =>
                      setGroupForm?.((prev) => ({
                        ...prev,
                        allowMemberInvites: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded-full border border-primary-300 bg-white accent-primary-500 focus:ring-2 focus:ring-primary-300 dark:border-primary-500/40 dark:bg-slate-900 dark:accent-primary-400"
                  />
                  Allow members to invite others
                </label>
              ) : null}
            </div>

            {showInviteManagement ? (
              <div className="rounded-2xl border border-primary-200 p-3 dark:border-primary-500/30">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Invite link
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Regenerating creates a new link and expires the previous one.
                </p>
                <div className="mt-2 rounded-xl border border-primary-200 bg-primary-50/70 p-3 text-xs text-primary-800 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-200">
                  <span className="break-all">
                    {currentInviteLink || "No invite link available."}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
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
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-primary-200 bg-white px-3 text-xs font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50 hover:shadow-[0_0_14px_rgba(59,130,246,0.2)] dark:border-primary-500/30 dark:bg-slate-900 dark:text-primary-200 dark:hover:bg-primary-500/10"
                  >
                    <Copy size={12} className="icon-anim-pop" />
                    {copiedRegenerateLink ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={onRegenerateInvite}
                    disabled={regeneratingInviteLink}
                    className="inline-flex h-8 items-center gap-2 rounded-full border border-primary-200 bg-white px-3 text-xs font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50 hover:shadow-[0_0_14px_rgba(59,130,246,0.2)] disabled:opacity-60 dark:border-primary-500/30 dark:bg-slate-900 dark:text-primary-200 dark:hover:bg-primary-500/10"
                  >
                    {regeneratingInviteLink ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : null}
                    Regenerate
                  </button>
                </div>
              </div>
            ) : null}

            {showRemoteChannelSettings ? (
              <div className="rounded-2xl border border-primary-200 p-3 dark:border-primary-500/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Remote Channel
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Mirror posts from a Telegram channel into this channel.
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
                        ? "bg-primary-500"
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
                    Remote Channel is not configured on this server.
                  </p>
                ) : null}
                {safeGroupForm.remoteChannelLoading ? (
                  <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <LoaderCircle size={13} className="animate-spin" />
                    Loading Remote Channel settings...
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
                        Telegram source
                      </label>
                      <input
                        value={safeGroupForm.remoteChannelSource}
                        onChange={(event) =>
                          setGroupForm?.((prev) => ({
                            ...prev,
                            remoteChannelSource: event.target.value,
                          }))
                        }
                        placeholder="@channel or https://t.me/channel"
                        lang={remoteSourceHasPersian ? "fa" : "en"}
                        dir={remoteSourceHasPersian ? "rtl" : "ltr"}
                        className={`mt-2 w-full rounded-2xl border border-primary-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-300/60 dark:border-primary-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                          remoteSourceHasPersian ? "font-fa text-right" : "text-left"
                        }`}
                        style={{ unicodeBidi: "plaintext" }}
                      />
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-slate-200">
                      <span>Sync Telegram title when saving</span>
                      <input
                        type="checkbox"
                        checked={safeGroupForm.remoteChannelSyncMetadata}
                        onChange={(event) =>
                          setGroupForm?.((prev) => ({
                            ...prev,
                            remoteChannelSyncMetadata: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-primary-300 accent-primary-500"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-slate-200">
                      <span>Allow media streaming when supported</span>
                      <input
                        type="checkbox"
                        checked={safeGroupForm.remoteChannelStreamMedia}
                        onChange={(event) =>
                          setGroupForm?.((prev) => ({
                            ...prev,
                            remoteChannelStreamMedia: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-primary-300 accent-primary-500"
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

            <div className="rounded-2xl border border-primary-200 p-3 dark:border-primary-500/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Members
                </p>
              </div>
              <div className="relative mt-2">
                <input
                  ref={groupSearchInputRef}
                  value={safeSearchQuery}
                  onChange={(event) => {
                    setGroupSearchQuery?.(event.target.value);
                    setGroupError?.("");
                  }}
                  placeholder="username"
                  lang={groupSearchHasPersian ? "fa" : "en"}
                  dir={groupSearchHasPersian ? "rtl" : "ltr"}
                  className={`w-full rounded-2xl border border-primary-200 bg-white px-4 py-3 pr-14 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-300/60 dark:border-primary-500/30 dark:bg-slate-900 dark:text-slate-100 ${
                    groupSearchHasPersian ? "font-fa text-right" : "text-left"
                  }`}
                  style={{ unicodeBidi: "plaintext" }}
                />
                {safeSearchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => setGroupSearchQuery?.("")}
                    className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-rose-600 transition hover:bg-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.22)] dark:text-rose-200 dark:hover:bg-rose-500/10"
                    aria-label="Clear member search"
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
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition ${
                            selected
                              ? "border-primary-500 border-2 bg-primary-50 text-primary-900 shadow-md dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-100"
                              : "border-primary-100/70 bg-white/80 text-slate-700 hover:border-primary-300 dark:border-primary-500/30 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
                          }`}
                        >
                          <Avatar
                            src={result.avatar_url}
                            alt={label}
                            name={label}
                            color={result.color || "#3b82f6"}
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
                    Searching...
                  </p>
                ) : safeSearchQuery.trim() ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No users found.
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-200"
                      >
                        <Avatar
                          src={member.avatar_url}
                          alt={label}
                          name={label}
                          color={member.color || "#3b82f6"}
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
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  No members selected yet.
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
              Delete {safeEntityLabel.toLowerCase()}
            </button>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_0_14px_rgba(148,163,184,0.2)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={creatingGroup}
              className="inline-flex min-w-[88px] items-center justify-center gap-2 rounded-full bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-400 disabled:opacity-70"
            >
              {creatingGroup ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  Saving...
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
        title={`Delete ${safeEntityLabel.toLowerCase()}`}
        description={`This permanently deletes the ${safeEntityLabel.toLowerCase()}, removes all members, and erases all messages.`}
        confirmLabel="Continue"
        deleteLabel={`Delete ${safeEntityLabel.toLowerCase()}`}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async (password) => {
          await onDeleteChat?.(password);
        }}
      />
    </>,
    document.body,
  );
}
