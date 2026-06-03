const userCallRoomCounts = new Map();

export function isUserInActiveCall(userId) {
  const id = Number(userId || 0);
  if (!id) return false;
  return (userCallRoomCounts.get(id) || 0) > 0;
}

export function createCallPresenceTracker({ findUserById, listChatsForUser, listChatMembers, emitSseEvent }) {
  const emitCallPresence = (userId, inCall) => {
    const id = Number(userId || 0);
    if (!id) return;
    const user = findUserById(id);
    if (!user?.username) return;

    const normalizedUsername = String(user.username).toLowerCase();
    const payload = {
      type: "call_presence",
      username: normalizedUsername,
      userId: id,
      inCall: Boolean(inCall),
    };

    const targets = new Set([normalizedUsername]);
    const chats = listChatsForUser(id);
    chats.forEach((chat) => {
      listChatMembers(Number(chat?.id || 0)).forEach((member) => {
        const memberUsername = String(member?.username || "").toLowerCase();
        if (memberUsername) targets.add(memberUsername);
      });
    });

    targets.forEach((targetUsername) => {
      emitSseEvent(targetUsername, payload);
    });
  };

  const setUserInCall = (userId, inCall) => {
    const id = Number(userId || 0);
    if (!id) return;
    const prev = userCallRoomCounts.get(id) || 0;
    const next = inCall ? prev + 1 : Math.max(0, prev - 1);
    if (next <= 0) userCallRoomCounts.delete(id);
    else userCallRoomCounts.set(id, next);

    const wasInCall = prev > 0;
    const nowInCall = next > 0;
    if (wasInCall !== nowInCall) {
      emitCallPresence(id, nowInCall);
    }
  };

  const clearUsersInCall = (userIds = []) => {
    const unique = [...new Set(userIds.map((id) => Number(id || 0)).filter(Boolean))];
    unique.forEach((userId) => {
      if ((userCallRoomCounts.get(userId) || 0) > 0) {
        userCallRoomCounts.delete(userId);
        emitCallPresence(userId, false);
      }
    });
  };

  return { setUserInCall, clearUsersInCall, isUserInActiveCall };
}
