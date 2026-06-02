import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chat,
  Close,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash,
  Users,
} from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { hasPersian } from "../../../utils/fontUtils.js";

export default function SidebarHeader({
  mobileTab,
  editMode,
  isConnected,
  isUpdating,
  hasChats,
  selectedChatsCount,
  onExitEdit,
  onEnterEdit,
  onDeleteChats,
  onNewChat,
  onNewGroup,
  onNewChannel,
  chatsSearchQuery,
  chatsSearchFocused,
  onChatsSearchChange,
  onChatsSearchFocus,
  onChatsSearchBlur,
  onCloseSearch,
  chatsScrollable = false,
  onScrollToTop,
}) {
  const { t, isRtl, language } = useLanguage();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuItems = useMemo(
    () => [
      { id: "dm", label: t("chat.newDm"), Icon: Chat, onClick: onNewChat },
      { id: "group", label: t("chat.newGroup"), Icon: Users, onClick: onNewGroup },
      {
        id: "channel",
        label: t("chat.newChannel"),
        Icon: Megaphone,
        onClick: onNewChannel,
      },
    ],
    [language, onNewChannel, onNewChat, onNewGroup, t],
  );
  const createMenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const hasSearchText = Boolean(String(chatsSearchQuery || "").trim());
  const searchHasPersian = hasPersian(chatsSearchQuery || "");
  const searchIsRtl = hasSearchText && searchHasPersian;

  useEffect(() => {
    if (!showCreateMenu) return;
    const handleOutside = (event) => {
      if (createMenuRef.current?.contains(event.target)) return;
      setShowCreateMenu(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showCreateMenu]);

  return (
    <div className="relative z-30 overflow-visible border-b border-slate-300/80 bg-white px-6 py-3 dark:border-emerald-500/20 dark:bg-slate-900">
      {mobileTab === "settings" ? (
        <div className="text-center text-lg font-semibold md:hidden">
          <span className="inline-flex items-center gap-2">
            {!isConnected ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-emerald-500" />
            ) : null}
            {isConnected ? t("settings.title") : t("chat.connecting")}
          </span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr,auto,1fr] items-center">
            <div className="flex items-center gap-2">
              {chatsSearchFocused ? (
                <button
                  type="button"
                  onClick={() => {
                    searchInputRef.current?.blur?.();
                    onCloseSearch?.();
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-white/80 p-2 text-rose-600 transition hover:border-rose-300 hover:shadow-[0_0_16px_rgba(244,63,94,0.22)] dark:border-rose-500/30 dark:bg-slate-950 dark:text-rose-200"
                  aria-label="Close search"
                >
                  <Close size={18} className="icon-anim-pop" />
                </button>
              ) : editMode ? (
                <button
                  type="button"
                  onClick={onExitEdit}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-white/80 p-2 text-rose-600 transition hover:border-rose-300 hover:shadow-[0_0_16px_rgba(244,63,94,0.22)] dark:border-rose-500/30 dark:bg-slate-950 dark:text-rose-200"
                  aria-label="Exit edit mode"
                >
                  <Close size={18} className="icon-anim-pop" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onEnterEdit}
                  disabled={!hasChats}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white/80 p-2 text-emerald-700 transition hover:border-emerald-300 hover:shadow-[0_0_16px_rgba(16,185,129,0.22)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-emerald-200 disabled:hover:shadow-none dark:border-emerald-500/30 dark:bg-slate-950 dark:text-emerald-200"
                  aria-label="Edit chat list"
                >
                  <Pencil size={18} className="icon-anim-sway" />
                </button>
              )}
            </div>
            <h2 className="text-center text-lg font-semibold">
              <span className="inline-flex items-center gap-2">
                {!editMode && (!isConnected || isUpdating) ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-emerald-500" />
                ) : null}
                {editMode ? (
                  t("chat.edit")
                ) : chatsSearchFocused ? (
                  t("chat.search")
                ) : !isConnected ? (
                  t("chat.connecting")
                ) : isUpdating ? (
                  t("chat.updating")
                ) : chatsScrollable ? (
                  <button
                    type="button"
                    onClick={onScrollToTop}
                    className="inline-flex cursor-pointer items-center gap-2 px-1 py-0.5 text-inherit"
                    aria-label={t("chat.searchChats")}
                  >
                    {t("chat.chats")}
                  </button>
                ) : (
                  t("chat.chats")
                )}
              </span>
            </h2>
            <div className="flex justify-end">
              {chatsSearchFocused ? (
                <span className="inline-flex h-9 w-9" aria-hidden="true" />
              ) : editMode ? (
                <button
                  type="button"
                  onClick={onDeleteChats}
                  disabled={!selectedChatsCount}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:border-rose-300 hover:shadow-[0_0_16px_rgba(244,63,94,0.22)] disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200"
                  aria-label="Delete chats"
                >
                  <Trash size={18} className="icon-anim-slide" />
                </button>
              ) : (
                <div className="relative overflow-visible" ref={createMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowCreateMenu((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white/80 p-2 text-emerald-700 transition hover:border-emerald-300 hover:shadow-[0_0_16px_rgba(16,185,129,0.22)] dark:border-emerald-500/30 dark:bg-slate-950 dark:text-emerald-200"
                    aria-label={t("chat.createMenu")}
                    aria-expanded={showCreateMenu}
                  >
                    <Plus size={18} className="icon-anim-pop" />
                  </button>
                  {showCreateMenu ? (
                    <div
                      key={language}
                      className="absolute end-0 top-12 z-50 min-w-[12.5rem] w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-emerald-200/80 bg-white p-1.5 shadow-lg dark:border-emerald-500/30 dark:bg-slate-950"
                      lang={language === "fa" ? "fa" : "en"}
                      dir={isRtl ? "rtl" : "ltr"}
                    >
                      {createMenuItems.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setShowCreateMenu(false);
                            item.onClick?.();
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-start text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 ${
                            index > 0 ? "mt-1" : ""
                          } ${isRtl ? "flex-row-reverse" : ""}`}
                        >
                          <item.Icon size={15} className="shrink-0" />
                          <span
                            className={`whitespace-nowrap ${
                              language === "fa" ? "font-fa" : ""
                            }`}
                          >
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3">
            <label className="group relative block">
              {!hasSearchText && !chatsSearchFocused ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm leading-none text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                  <span className="inline-flex -translate-y-[1px] md:translate-y-0">
                    <Search
                      size={14}
                      className="icon-anim-pop block text-emerald-600 dark:text-emerald-300"
                    />
                  </span>
                  <span>{t("chat.search")}</span>
                </span>
              ) : null}
              {chatsSearchFocused || hasSearchText ? (
                <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-2 leading-none text-slate-500 dark:text-slate-400">
                  <span className="inline-flex -translate-y-[1px] md:translate-y-0">
                    <Search
                      size={14}
                      className="icon-anim-pop block text-emerald-600 dark:text-emerald-300"
                    />
                  </span>
                </span>
              ) : null}
              <input
                ref={searchInputRef}
                value={chatsSearchQuery}
                onChange={(event) => onChatsSearchChange?.(event.target.value)}
                onFocus={onChatsSearchFocus}
                onBlur={onChatsSearchBlur}
                placeholder={t("chat.search")}
                lang={searchIsRtl ? "fa" : "en"}
                dir={searchIsRtl ? "rtl" : "ltr"}
                className={`w-full rounded-2xl border border-emerald-200 bg-white py-2 pr-10 text-sm text-slate-700 outline-none transition hover:border-emerald-300 hover:shadow-[0_0_16px_rgba(16,185,129,0.18)] focus:border-emerald-400 focus:bg-white/80 focus:ring-2 focus:ring-emerald-300/60 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-500/50 dark:hover:shadow-[0_0_18px_rgba(16,185,129,0.12)] dark:focus:bg-slate-950 ${
                  chatsSearchFocused || hasSearchText
                    ? searchIsRtl
                      ? "pl-9 text-right font-fa placeholder-slate-500 dark:placeholder-slate-400"
                      : "pl-9 text-left placeholder-slate-500 dark:placeholder-slate-400"
                    : "px-9 text-center placeholder-transparent"
                }`}
                style={{ unicodeBidi: "plaintext" }}
              />
              {hasSearchText ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChatsSearchChange?.("")}
                  className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-rose-600 transition hover:bg-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.22)] dark:text-rose-200 dark:hover:bg-rose-500/10"
                  aria-label="Clear search"
                >
                  <Close size={14} className="icon-anim-pop" />
                </button>
              ) : null}
            </label>
          </div>
        </>
      )}
    </div>
  );
}
