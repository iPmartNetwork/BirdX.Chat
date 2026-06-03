import { useState } from "react";
import { Archive, ChevronDown, ChevronUp } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import Avatar from "../../common/Avatar.jsx";
import { getAvatarInitials } from "../../../utils/avatarInitials.js";
import { hasPersian } from "../../../utils/fontUtils.js";
import ContextMenuSurface from "../../context-menu/ContextMenuSurface.jsx";

function resolveChatLabel(chat, currentUsername) {
  const type = String(chat?.type || "").toLowerCase();
  if (type === "group" || type === "channel") {
    return chat?.name || (type === "channel" ? "Channel" : "Group");
  }
  if (type === "saved") {
    return "Saved messages";
  }
  const members = Array.isArray(chat?.members) ? chat.members : [];
  const other = members.find(
    (member) =>
      String(member?.username || "").toLowerCase() !==
      String(currentUsername || "").toLowerCase(),
  );
  return other?.nickname || other?.username || chat?.name || "Chat";
}

export default function ArchivedChatsSection({
  chats,
  loading,
  activeChatId,
  currentUsername,
  formatChatTimestamp,
  onOpenChat,
  onOpenChatContextMenu,
  onUnarchive,
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(chats) ? chats : [];
  const count = items.length;

  if (!loading && count === 0) {
    return null;
  }

  return (
    <div className="mb-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-100"
      >
        <span className="inline-flex items-center gap-1.5">
          <Archive size={14} className="icon-anim-sway" />
          {t("chat.archived")}
          {count > 0 ? (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-200">
              {count}
            </span>
          ) : null}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded ? (
        loading ? (
          <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
            {t("chat.searching")}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((chat) => {
              const label = resolveChatLabel(chat, currentUsername);
              const initials = getAvatarInitials(label);
              const isActive = Number(activeChatId) === Number(chat.id);
              const avatarUrl =
                chat?.avatar_url ||
                chat?.avatarUrl ||
                (Array.isArray(chat?.members)
                  ? chat.members.find(
                      (m) =>
                        String(m?.username || "").toLowerCase() !==
                        String(currentUsername || "").toLowerCase(),
                    )?.avatar_url
                  : null);
              return (
                <div
                  key={`archived-${chat.id}`}
                  className="flex items-center gap-2"
                >
                  <ContextMenuSurface
                    type="button"
                    as="button"
                    onClick={() => onOpenChat?.(chat)}
                    contextMenu={{
                      isMobile:
                        typeof window !== "undefined" &&
                        window.matchMedia(
                          "(max-width: 767px) and (pointer: coarse)",
                        ).matches,
                      onOpen: ({ event, targetEl, isMobile }) =>
                        onOpenChatContextMenu?.({
                          kind: "chat",
                          event,
                          targetEl,
                          isMobile,
                          data: { chat, fromArchived: true },
                        }),
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/20 dark:text-emerald-100"
                        : "border-slate-300/80 bg-white/90 text-slate-700 hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-slate-950/60 dark:text-slate-200"
                    }`}
                  >
                    <Avatar
                      src={avatarUrl}
                      alt={label}
                      name={label}
                      color={chat?.color || "var(--birdx-accent)"}
                      initials={initials}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold ${hasPersian(label) ? "font-fa" : ""}`}
                        dir="auto"
                      >
                        {label}
                      </p>
                      {chat?.last_time ? (
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {formatChatTimestamp?.(chat.last_time) || ""}
                        </p>
                      ) : null}
                    </div>
                  </ContextMenuSurface>
                  <button
                    type="button"
                    onClick={() => onUnarchive?.(chat.id)}
                    className="shrink-0 rounded-xl border border-emerald-200/80 px-2.5 py-2 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  >
                    {t("chat.unarchive")}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
