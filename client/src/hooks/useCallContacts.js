import { useMemo } from "react";

/**
 * Merge server-side accepted contacts with live presence from chat members.
 */
export function useCallContacts(serverContacts, chats, user, inCallByUsername = null) {
  return useMemo(() => {
    const selfUsername = String(user?.username || "").toLowerCase();
    const liveByUsername = new Map();
    const inCallMap =
      inCallByUsername && typeof inCallByUsername === "object" ? inCallByUsername : {};

    (Array.isArray(chats) ? chats : []).forEach((chat) => {
      if (String(chat?.type || "").toLowerCase() !== "dm") return;
      const members = Array.isArray(chat?.members) ? chat.members : [];
      const peer = members.find(
        (member) =>
          String(member?.username || "").toLowerCase() !== selfUsername,
      );
      if (!peer?.username) return;
      liveByUsername.set(String(peer.username).toLowerCase(), {
        chatId: Number(chat.id || 0),
        status: String(peer.status || "offline").toLowerCase(),
        avatar_url: peer.avatar_url || "",
        color: peer.color || "var(--birdx-accent)",
        nickname: peer.nickname || peer.username,
      });
    });

    const accepted = Array.isArray(serverContacts) ? serverContacts : [];
    return accepted
      .map((contact) => {
        const key = String(contact?.username || "").toLowerCase();
        const live = liveByUsername.get(key);
        const displayName = String(
          contact?.nickname || live?.nickname || contact?.username || "",
        ).trim();
        return {
          id: Number(contact?.id || 0),
          chatId: Number(live?.chatId || contact?.chatId || 0),
          username: contact?.username || "",
          nickname: displayName || contact?.username || "",
          avatar_url: live?.avatar_url || contact?.avatar_url || "",
          color: live?.color || contact?.color || "var(--birdx-accent)",
          status: live?.status || String(contact?.status || "offline").toLowerCase(),
          inCall: Boolean(inCallMap[key] || contact?.inCall),
          sortKey: (displayName || contact?.username || "").toLowerCase(),
          isContact: true,
        };
      })
      .sort((a, b) =>
        a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: "base" }),
      );
  }, [chats, inCallByUsername, serverContacts, user?.username]);
}
