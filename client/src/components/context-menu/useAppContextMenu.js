import { useCallback, useState } from "react";
import {
  AlertCircle,
  Ban,
  Chat,
  CheckCheck,
  Copy,
  Download,
  Forward,
  Pencil,
  Reply,
  Trash,
  User,
  Volume2,
  VolumeX,
  Pin,
  Archive,
} from "../../icons/lucide.js";
import { copyTextToClipboard } from "../../utils/clipboard.js";
import {
  extractMessageBodyText,
  getMessageFiles,
  hasMessageText,
} from "../../utils/messageContent.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export function useAppContextMenu({
  activeChatId,
  chats,
  currentUsername,
  canCurrentUserEditGroup,
  canEditMessage,
  canDeleteMessageForEveryone,
  onReplyToMessage,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
  onForwardMessage,
  onSaveMessageFiles,
  onOpenOrCreateDm,
  onOpenProfile,
  onBlockUser,
  onRemoveGroupMember,
  onMarkChatSeen,
  onToggleChatMute,
  onToggleChatPin,
  onToggleChatArchive,
  onDeleteChats,
  onReportMessage,
}) {
  const { t } = useLanguage();
  const [contextMenu, setContextMenu] = useState(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const findExistingDmWithUser = useCallback(
    (username) => {
      const targetUsername = String(username || "").toLowerCase();
      if (!targetUsername) return null;
      return (
        chats.find((chat) => {
          if (chat?.type !== "dm") return false;
          const members = Array.isArray(chat?.members) ? chat.members : [];
          return members.some(
            (member) =>
              String(member?.username || "").toLowerCase() === targetUsername,
          );
        }) || null
      );
    },
    [chats],
  );

  const handleMarkChatSeen = useCallback(
    async (chat) => {
      const chatId = Number(chat?.id || 0);
      if (!chatId) return;
      await onMarkChatSeen?.(chat, {
        activeChatId,
      });
    },
    [activeChatId, onMarkChatSeen],
  );

  const openContextMenu = useCallback(
    ({ kind, data, targetEl, event }) => {
      const rect = targetEl?.getBoundingClientRect?.() || null;
      const point = {
        x: Number(event?.clientX || rect?.left || 0),
        y: Number(event?.clientY || rect?.bottom || rect?.top || 0),
      };
      const items = [];

      if (kind === "message") {
  const message = data?.message || null;
  const hasText = hasMessageText(message);
  const files = getMessageFiles(message);

  items.push(
    {
      id: "react",
      type: "reactions",
      emojis: [
        "\u{1F44D}",
        "\u{2764}\u{FE0F}",
        "\u{1F602}",
        "\u{1F525}",
        "\u{1F62E}",
        "\u{1F44E}",
      ],
      onReact: (emoji) => {
        onReactMessage?.(message, emoji);
      },
    },
    {
      id: "reply",
      label: "Reply",
      icon: Reply,
      onSelect: () => onReplyToMessage?.(message),
    },
    ...(hasText
      ? [
          {
            id: "copy",
            label: "Copy text",
            icon: Copy,
            onSelect: () =>
              copyTextToClipboard(extractMessageBodyText(message?.body)),
          },
        ]
      : []),
    ...(hasText && canEditMessage?.(message)
      ? [
          {
            id: "edit",
            label: "Edit",
            icon: Pencil,
            onSelect: () => onEditMessage?.(message),
          },
        ]
      : []),
    ...(files.length
      ? [
          {
            id: "save",
            label: "Save",
            icon: Download,
            onSelect: () => onSaveMessageFiles?.(message),
          },
        ]
      : []),
    {
      id: "forward",
      label: "Forward",
      icon: Forward,
      onSelect: () => onForwardMessage?.(message),
    },
    ...(onReportMessage &&
    String(message?.author_username || message?.username || "").toLowerCase() !==
      String(currentUsername || "").toLowerCase()
      ? [
          {
            id: "report",
            label: t("chat.reportMessage"),
            icon: AlertCircle,
            onSelect: () => onReportMessage?.(message),
          },
        ]
      : []),
    {
      id: "delete",
      label: "Delete",
      icon: Trash,
      danger: true,
      onSelect: () =>
        onDeleteMessage?.(message, {
          allowDeleteForEveryone: Boolean(
            canDeleteMessageForEveryone?.(message),
          ),
        }),
    },
  );
}

      if (kind === "user") {
        const targetUser = data?.member || data?.user || null;
        const username = String(targetUser?.username || "").toLowerCase();
        const isSelf = username === String(currentUsername || "").toLowerCase();
        const existingDm = findExistingDmWithUser(username);
        const isRemovableGroupMember =
          data?.sourceChatType === "group" &&
          canCurrentUserEditGroup &&
          !isSelf &&
          String(targetUser?.role || "").toLowerCase() !== "owner";

        items.push({
          id: "profile",
          label: "Open profile",
          icon: User,
          onSelect: () => {
            if (typeof data?.onOpenProfile === "function") {
              data.onOpenProfile(targetUser);
              return;
            }
            onOpenProfile?.(targetUser);
          },
        });

        if (!isSelf && !existingDm) {
          items.push({
            id: "chat",
            label: "Chat",
            icon: Chat,
            onSelect: () => onOpenOrCreateDm?.(targetUser),
          });
        }

        if (!isSelf && username && onBlockUser) {
          items.push({
            id: "block",
            label: t("chat.blockUser"),
            icon: Ban,
            danger: true,
            onSelect: () => onBlockUser?.(targetUser),
          });
        }

        if (isRemovableGroupMember) {
          items.push({
            id: "remove",
            label: "Remove",
            icon: Ban,
            danger: true,
            onSelect: () => onRemoveGroupMember?.(targetUser),
          });
        }
      }

      if (kind === "chat") {
        const chat = data?.chat || null;
        const unreadCount = Number(chat?.unread_count || 0);
        if (unreadCount > 0) {
          items.push({
            id: "seen",
            label: "Mark as seen",
            icon: CheckCheck,
            onSelect: () => handleMarkChatSeen(chat),
          });
        }
        if (String(chat?.type || "").toLowerCase() !== "saved") {
          items.push({
            id: "mute",
            label: chat?._muted ? t("chat.unmute") : t("chat.mute"),
            icon: chat?._muted ? Volume2 : VolumeX,
            onSelect: () => onToggleChatMute?.(chat?.id),
          });
        }
        if (String(chat?.type || "").toLowerCase() !== "saved") {
          items.push({
            id: "pin",
            label: chat?._pinned ? t("chat.unpin") : t("chat.pin"),
            icon: Pin,
            onSelect: () => onToggleChatPin?.(chat?.id),
          });
          const fromArchived = Boolean(data?.fromArchived);
          items.push({
            id: "archive",
            label: fromArchived ? t("chat.unarchive") : t("chat.archive"),
            icon: Archive,
            onSelect: () =>
              onToggleChatArchive?.(chat?.id, { archived: !fromArchived }),
          });
        }
        items.push({
          id: "delete",
          label: "Delete",
          icon: Trash,
          danger: true,
          onSelect: () => onDeleteChats?.([Number(chat?.id || 0)]),
        });
      }

      if (!items.length) return;
      setContextMenu({
        kind,
        point,
        items,
      });
    },
    [
      activeChatId,
      canCurrentUserEditGroup,
      currentUsername,
      findExistingDmWithUser,
      handleMarkChatSeen,
      onDeleteChats,
      onDeleteMessage,
      onEditMessage,
      onForwardMessage,
      onReactMessage,
      onSaveMessageFiles,
      onOpenOrCreateDm,
      onOpenProfile,
      onBlockUser,
      onRemoveGroupMember,
      t,
      onReplyToMessage,
      onToggleChatMute,
      onToggleChatPin,
      onToggleChatArchive,
      canDeleteMessageForEveryone,
      canEditMessage,
    ],
  );

  return {
    contextMenu,
    closeContextMenu,
    openContextMenu,
  };
}
