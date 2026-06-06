const API_BASE = "";

const withCredentials = (options = {}) => ({
  credentials: "include",
  ...options,
});

export const apiFetch = (url, options = {}) => fetch(url, withCredentials(options));

export const fetchHealth = () => apiFetch(`${API_BASE}/api/health`);

export const pingPresence = (username) =>
  apiFetch(`${API_BASE}/api/presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const fetchPresence = (username) =>
  apiFetch(`${API_BASE}/api/presence?username=${encodeURIComponent(username)}`);

export const searchUsers = ({ exclude, query }) =>
  apiFetch(
    `${API_BASE}/api/users?exclude=${encodeURIComponent(exclude)}&query=${encodeURIComponent(
      query,
    )}`,
  );

export const lookupUserExact = ({ exclude, username }) =>
  apiFetch(
    `${API_BASE}/api/users/lookup?exclude=${encodeURIComponent(exclude)}&username=${encodeURIComponent(
      username,
    )}`,
  );

export const fetchDmRequests = (username) =>
  apiFetch(
    `${API_BASE}/api/dm-requests?username=${encodeURIComponent(username)}`,
  );

export const acceptDmRequest = ({ username, chatId }) =>
  apiFetch(`${API_BASE}/api/dm-requests/${encodeURIComponent(chatId)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const rejectDmRequest = ({ username, chatId }) =>
  apiFetch(`${API_BASE}/api/dm-requests/${encodeURIComponent(chatId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const updateDmPolicy = ({ username, dmPolicy }) =>
  apiFetch(`${API_BASE}/api/profile/dm-policy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, dmPolicy }),
  });

export const updateContactRequestPolicy = ({ username, contactRequestPolicy }) =>
  apiFetch(`${API_BASE}/api/profile/contact-request-policy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, contactRequestPolicy }),
  });

export const fetchBlockedUsers = ({ username }) =>
  apiFetch(`${API_BASE}/api/users/blocked?username=${encodeURIComponent(username)}`);

export const blockUser = ({ username, target }) =>
  apiFetch(`${API_BASE}/api/users/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, target }),
  });

export const unblockUser = ({ username, target }) =>
  apiFetch(
    `${API_BASE}/api/users/block/${encodeURIComponent(target)}?username=${encodeURIComponent(username)}`,
    { method: "DELETE" },
  );

export const resolveMentions = ({ username, mentions }) =>
  apiFetch(`${API_BASE}/api/mentions/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, mentions }),
  });

export const fetchPushPublicKey = () => apiFetch(`${API_BASE}/api/push/public-key`);

export const subscribePush = ({ username, subscription }) =>
  apiFetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, subscription }),
  });

export const unsubscribePush = ({ username, endpoint }) =>
  apiFetch(`${API_BASE}/api/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, endpoint }),
  });

export const registerDeviceToken = ({ username, token, platform = "android" }) =>
  apiFetch(`${API_BASE}/api/push/device-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, token, platform }),
  });

export const unregisterDeviceToken = ({ username, token }) =>
  apiFetch(`${API_BASE}/api/push/device-token`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, token }),
  });

export const sendPushTest = ({ username }) =>
  apiFetch(`${API_BASE}/api/push/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const fetchAdminMe = () => apiFetch(`${API_BASE}/api/admin/me`);

export const verifyAdmin2fa = ({ token }) =>
  apiFetch(`${API_BASE}/api/admin/verify-2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

export const fetchPublicBranding = () => apiFetch(`${API_BASE}/api/branding`);

export const updateProfileUiPrefs = async ({ username, uiAccentColor }) => {
  const res = await apiFetch(`${API_BASE}/api/profile/ui-prefs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, uiAccentColor }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
};

export const fetchGroupE2eeStatus = (chatId) =>
  apiFetch(`${API_BASE}/api/e2ee/group/${encodeURIComponent(chatId)}/status`);

export const enableGroupE2ee = (chatId) =>
  apiFetch(`${API_BASE}/api/e2ee/group/${encodeURIComponent(chatId)}/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const disableGroupE2ee = (chatId) =>
  apiFetch(`${API_BASE}/api/e2ee/group/${encodeURIComponent(chatId)}/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const uploadGroupE2eeKey = ({ chatId, wrappedKey, keyGeneration = 1, userId = null }) =>
  apiFetch(`${API_BASE}/api/e2ee/group/${encodeURIComponent(chatId)}/keys`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wrappedKey,
      keyGeneration,
      ...(userId ? { userId: Number(userId) } : {}),
    }),
  });

export const fetchMyGroupE2eeKey = (chatId) =>
  apiFetch(`${API_BASE}/api/e2ee/group/${encodeURIComponent(chatId)}/keys/me`);

export const fetchGroupE2eeKeys = (chatId) =>
  apiFetch(`${API_BASE}/api/e2ee/group/${encodeURIComponent(chatId)}/keys`);

export const fetchAdminOverview = () => apiFetch(`${API_BASE}/api/admin/overview`);

export const fetchAdminSystemHealth = () => apiFetch(`${API_BASE}/api/admin/system-health`);

export const fetchAdminSecuritySummary = () => apiFetch(`${API_BASE}/api/admin/security-summary`);

const buildAdminQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

export const fetchAdminUsers = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/users${buildAdminQuery(params)}`);

export const fetchAdminUserDetail = (userId) =>
  apiFetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`);

const adminJsonOptions = (method, payload = {}) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload || {}),
});

export const updateAdminUser = (userId, payload) =>
  apiFetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`, adminJsonOptions("PATCH", payload));

export const resetAdminUserPassword = (userId, payload) => {
  const body = typeof payload === "string" ? { password: payload } : payload;
  return apiFetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/reset-password`,
    adminJsonOptions("POST", body),
  );
};

export const deleteAdminUser = (userId, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}`, adminJsonOptions("DELETE", payload));

export const deleteAdminUserSession = (userId, sessionId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(
      sessionId,
    )}`,
    adminJsonOptions("DELETE", payload),
  );

export const deleteAdminUserSessions = (userId, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/sessions`, adminJsonOptions("DELETE", payload));

export const fetchAdminChats = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/chats${buildAdminQuery(params)}`);

export const fetchAdminChatDetail = (chatId) =>
  apiFetch(`${API_BASE}/api/admin/chats/${encodeURIComponent(chatId)}/detail`);

export const updateAdminChatSettings = (chatId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/chats/${encodeURIComponent(chatId)}/settings`,
    adminJsonOptions("PATCH", payload),
  );

export const addAdminChatMember = (chatId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/chats/${encodeURIComponent(chatId)}/members`,
    adminJsonOptions("POST", payload),
  );

export const updateAdminChatMember = (chatId, userId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`,
    adminJsonOptions("PATCH", payload),
  );

export const deleteAdminChatMember = (chatId, userId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`,
    adminJsonOptions("DELETE", payload),
  );

export const deleteAdminChat = (chatId, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/chats/${encodeURIComponent(chatId)}`, adminJsonOptions("DELETE", payload));

export const fetchAdminFiles = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/files${buildAdminQuery(params)}`);

export const deleteAdminFile = (fileId, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/files/${encodeURIComponent(fileId)}`, adminJsonOptions("DELETE", payload));

export const fetchAdminAuditLogs = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/audit-logs${buildAdminQuery(params)}`);

export const fetchAdminSettings = () => apiFetch(`${API_BASE}/api/admin/settings`);

export const fetchAdminRequiredChannels = () =>
  apiFetch(`${API_BASE}/api/admin/required-channels`);

export const updateAdminRequiredChannels = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/required-channels`, adminJsonOptions("PUT", payload));

export const applyAdminRequiredChannels = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/required-channels/apply`, adminJsonOptions("POST", payload));

export const fetchAdminBackups = () => apiFetch(`${API_BASE}/api/admin/backups`);

export const createAdminBackup = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/backups`, adminJsonOptions("POST", payload));

export const deleteAdminBackup = (name, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/backups/${encodeURIComponent(name)}`, adminJsonOptions("DELETE", payload));

export const getAdminBackupDownloadUrl = (name) =>
  `${API_BASE}/api/admin/backups/${encodeURIComponent(name)}/download`;

export const discoverUsersAndGroups = ({ username, query }) =>
  apiFetch(
    `${API_BASE}/api/discover?username=${encodeURIComponent(
      username,
    )}&query=${encodeURIComponent(query)}`,
  );

export const markMessagesRead = ({ chatId, username }) =>
  apiFetch(`${API_BASE}/api/messages/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, username }),
  });

export const getMessageReadCounts = ({ chatId, username, messageIds }) =>
  apiFetch(`${API_BASE}/api/messages/read-counts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, username, messageIds }),
  });

export const logout = () =>
  apiFetch(`${API_BASE}/api/logout`, {
    method: "POST",
  });

export const fetchUserProfile = (username) =>
  apiFetch(
    `${API_BASE}/api/profile?username=${encodeURIComponent(username)}`,
  );

export const updateProfile = (payload) =>
  apiFetch(`${API_BASE}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const uploadAvatar = (payload) =>
  apiFetch(`${API_BASE}/api/profile/avatar`, {
    method: "POST",
    body: payload,
  });

export const updateStatus = (payload) =>
  apiFetch(`${API_BASE}/api/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updatePassword = (payload) =>
  apiFetch(`${API_BASE}/api/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteAccount = (payload) =>
  apiFetch(`${API_BASE}/api/profile/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const listChats = () => apiFetch(`${API_BASE}/api/chats`);

export const listChatsForUser = (username, options = {}) =>
  apiFetch(`${API_BASE}/api/chats?username=${encodeURIComponent(username)}`, options);

export const createChat = (payload) =>
  apiFetch(`${API_BASE}/api/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteChats = (payload) =>
  apiFetch(`${API_BASE}/api/chats/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const createDmChat = ({ from, to }) =>
  apiFetch(`${API_BASE}/api/chats/dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });

export const createGroupChat = (payload) =>
  apiFetch(`${API_BASE}/api/chats/group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const createChannelChat = (payload) =>
  apiFetch(`${API_BASE}/api/chats/group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, type: "channel" }),
  });

export const getGroupInviteInfo = (token) =>
  apiFetch(`${API_BASE}/api/groups/invite/${encodeURIComponent(token)}`);

export const joinGroupByInvite = (token, payload = {}) =>
  apiFetch(`${API_BASE}/api/groups/invite/${encodeURIComponent(token)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const getGroupInviteLink = (chatId) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/invite-link`);

export const regenerateGroupInviteLink = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/regenerate-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const leaveGroupChat = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const removeGroupMember = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/remove-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateGroupMemberRole = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/member-role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateGroupChat = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateChannelChat = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, type: "channel" }),
  });

export const deleteGroupChat = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const joinPublicGroup = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/join-public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const getChatPreview = ({ chatId, username }) =>
  apiFetch(
    `${API_BASE}/api/chats/${encodeURIComponent(chatId)}/preview?username=${encodeURIComponent(
      username,
    )}`,
  );

export const fetchChatCallLogs = ({ chatId, username, limit = 30 }) =>
  apiFetch(
    `${API_BASE}/api/chats/${encodeURIComponent(chatId)}/calls?username=${encodeURIComponent(
      username,
    )}&limit=${encodeURIComponent(limit)}`,
  );

export const fetchUserCallHistory = ({ username, limit = 50 }) =>
  apiFetch(
    `${API_BASE}/api/calls?username=${encodeURIComponent(username)}&limit=${encodeURIComponent(limit)}`,
  );

export const fetchContacts = ({ username }) =>
  apiFetch(`${API_BASE}/api/contacts?username=${encodeURIComponent(username)}`);

export const fetchIncomingContactRequests = ({ username }) =>
  apiFetch(
    `${API_BASE}/api/contacts/requests/incoming?username=${encodeURIComponent(username)}`,
  );

export const fetchContactPeerStatus = ({ username, peerUsername }) =>
  apiFetch(
    `${API_BASE}/api/contacts/peer-status?username=${encodeURIComponent(username)}&peerUsername=${encodeURIComponent(peerUsername)}`,
  );

export const sendContactRequest = ({ username, toUsername }) =>
  apiFetch(`${API_BASE}/api/contacts/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, toUsername }),
  });

export const acceptContactRequest = ({ username, requestId }) =>
  apiFetch(`${API_BASE}/api/contacts/requests/${encodeURIComponent(requestId)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const rejectContactRequest = ({ username, requestId }) =>
  apiFetch(`${API_BASE}/api/contacts/requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const cancelContactRequest = ({ username, requestId }) =>
  apiFetch(`${API_BASE}/api/contacts/requests/${encodeURIComponent(requestId)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const fetchOutgoingContactRequests = ({ username }) =>
  apiFetch(
    `${API_BASE}/api/contacts/requests/outgoing?username=${encodeURIComponent(username)}`,
  );

export const removeContact = ({ username, contactUsername }) =>
  apiFetch(
    `${API_BASE}/api/contacts/${encodeURIComponent(contactUsername)}?username=${encodeURIComponent(username)}`,
    { method: "DELETE" },
  );

export const uploadGroupAvatar = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/avatar`, {
    method: "POST",
    body: payload,
  });

export const removeGroupAvatar = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/group/${encodeURIComponent(chatId)}/avatar`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const getRemoteChannelSettings = ({ chatId, username }) =>
  apiFetch(
    `${API_BASE}/api/chats/${encodeURIComponent(chatId)}/remote-channel?username=${encodeURIComponent(
      username,
    )}`,
  );

export const updateRemoteChannelSettings = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/${encodeURIComponent(chatId)}/remote-channel`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const getSavedMessagesChat = (username) =>
  apiFetch(`${API_BASE}/api/chats/saved?username=${encodeURIComponent(username)}`);

export const setChatMute = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/${encodeURIComponent(chatId)}/mute`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateChatSettings = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/${encodeURIComponent(chatId)}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const fetchArchivedChats = (username) =>
  apiFetch(`${API_BASE}/api/chats/archived?username=${encodeURIComponent(username)}`);

export const fetchSessions = (username) =>
  apiFetch(`${API_BASE}/api/sessions?username=${encodeURIComponent(username)}`);

export const revokeOtherSessions = (username) =>
  apiFetch(`${API_BASE}/api/sessions/others`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const revokeSession = ({ username, sessionId }) =>
  apiFetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const updateNotificationPrefs = (payload) =>
  apiFetch(`${API_BASE}/api/notification-prefs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const scheduleChatMessage = (chatId, payload) =>
  apiFetch(`${API_BASE}/api/chats/${encodeURIComponent(chatId)}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const fetchScheduledMessages = (username) =>
  apiFetch(
    `${API_BASE}/api/scheduled-messages?username=${encodeURIComponent(username)}`,
  );

export const cancelScheduledMessage = ({ username, messageId }) =>
  apiFetch(`${API_BASE}/api/scheduled-messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

export const hideChats = ({ username, chatIds }) =>
  apiFetch(`${API_BASE}/api/chats/hide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, chatIds }),
  });

export const listMessages = (chatId, params = {}) => {
  const search = new URLSearchParams(params);
  const query = search.toString();
  const suffix = query ? `?${query}` : "";
  return apiFetch(`${API_BASE}/api/messages/${chatId}${suffix}`);
};

export const listMessagesByQuery = (params = {}, options = {}) => {
  const search = new URLSearchParams(params);
  const query = search.toString();
  const suffix = query ? `?${query}` : "";
  return apiFetch(`${API_BASE}/api/messages${suffix}`, options);
};

export const sendMessage = (payload) =>
  apiFetch(`${API_BASE}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const sendPollMessage = (payload) =>
  apiFetch(`${API_BASE}/api/messages/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const votePollMessage = (payload) =>
  apiFetch(`${API_BASE}/api/messages/poll/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const editMessage = (payload) =>
  apiFetch(`${API_BASE}/api/messages/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteMessage = (payload) =>
  apiFetch(`${API_BASE}/api/messages/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const toggleMessageReaction = (payload) =>
  apiFetch(`${API_BASE}/api/messages/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const forwardMessage = (payload) =>
  apiFetch(`${API_BASE}/api/messages/forward`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const sendTypingIndicator = (payload) =>
  apiFetch(`${API_BASE}/api/messages/typing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deletePendingMessage = (clientId) =>
  apiFetch(`${API_BASE}/api/messages/pending/${clientId}`, {
    method: "DELETE",
  });

export const getSseStreamUrl = (username) =>
  `${API_BASE}/api/events?username=${encodeURIComponent(username)}`;

export const getMessagesUploadUrl = () => `${API_BASE}/api/messages/upload`;

// --- E2EE Key Exchange ---

export const uploadE2eeKeys = (payload) =>
  apiFetch(`${API_BASE}/api/e2ee/keys/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const fetchE2eeKeyBundle = (targetUserId) =>
  apiFetch(`${API_BASE}/api/e2ee/keys/bundle/${encodeURIComponent(targetUserId)}`);

export const fetchE2eeKeyStatus = (username) =>
  apiFetch(`${API_BASE}/api/e2ee/keys/status?username=${encodeURIComponent(username)}`);

export const checkPeerE2eeStatus = (targetUserId) =>
  apiFetch(`${API_BASE}/api/e2ee/keys/check/${encodeURIComponent(targetUserId)}`);

export const fetchE2eePreKeyCount = (username) =>
  apiFetch(`${API_BASE}/api/e2ee/keys/prekey-count?username=${encodeURIComponent(username)}`);

// --- Admin: Broadcast ---
export const sendAdminBroadcast = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/broadcast`, adminJsonOptions("POST", payload));

// --- Admin: Export Data ---
export const getAdminExportUrl = (type, format = "json") =>
  `${API_BASE}/api/admin/export/${encodeURIComponent(type)}?format=${encodeURIComponent(format)}`;

// --- Admin: Bulk Actions ---
export const bulkAdminUsers = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/bulk/users`, adminJsonOptions("POST", payload));

export const bulkAdminChats = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/bulk/chats`, adminJsonOptions("POST", payload));

// --- Admin: Enhanced User Detail ---
export const fetchAdminUserActivity = (userId) =>
  apiFetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/activity`);

// --- Admin: Analytics ---
export const fetchAdminAnalytics = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/analytics${buildAdminQuery(params)}`);

export const fetchAdminCalls = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/calls${buildAdminQuery(params)}`);

export const fetchAdminModerationReports = (params = {}) =>
  apiFetch(`${API_BASE}/api/admin/moderation/reports${buildAdminQuery(params)}`);

export const updateAdminModerationReport = (reportId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/moderation/reports/${encodeURIComponent(reportId)}`,
    adminJsonOptions("PATCH", payload),
  );

export const adminModerationReportAction = (reportId, payload = {}) =>
  apiFetch(
    `${API_BASE}/api/admin/moderation/reports/${encodeURIComponent(reportId)}/action`,
    adminJsonOptions("POST", payload),
  );

export const fetchAdminServerSettings = () =>
  apiFetch(`${API_BASE}/api/admin/server-settings`);

export const updateAdminServerSettings = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/server-settings`, adminJsonOptions("PATCH", payload));

export const reportMessage = (payload = {}) =>
  apiFetch(`${API_BASE}/api/messages/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

// --- Message Pinning ---
export const pinMessage = ({ chatId, messageId }) =>
  apiFetch(`${API_BASE}/api/messages/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, messageId }),
  });

export const unpinMessage = ({ chatId, messageId }) =>
  apiFetch(`${API_BASE}/api/messages/unpin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, messageId }),
  });

export const fetchPinnedMessages = (chatId) =>
  apiFetch(`${API_BASE}/api/messages/pinned/${encodeURIComponent(chatId)}`);

export const searchMessagesInChat = ({ chatId, q, fromUserId, hasFiles, dateFrom, dateTo, limit, offset }) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (fromUserId) params.set("fromUserId", String(fromUserId));
  if (hasFiles === true) params.set("hasFiles", "true");
  if (hasFiles === false) params.set("hasFiles", "false");
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const query = params.toString();
  return apiFetch(`${API_BASE}/api/messages/search/${encodeURIComponent(chatId)}${query ? `?${query}` : ""}`);
};

// --- Threads ---
export const fetchThreadReplies = (messageId, { limit, offset } = {}) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const query = params.toString();
  return apiFetch(`${API_BASE}/api/threads/${encodeURIComponent(messageId)}${query ? `?${query}` : ""}`);
};

export const postThreadReply = ({ messageId, body }) =>
  apiFetch(`${API_BASE}/api/threads/${encodeURIComponent(messageId)}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });

// --- Stories ---
export const fetchStories = () => apiFetch(`${API_BASE}/api/stories`);

export const createStory = (payload) =>
  apiFetch(`${API_BASE}/api/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const viewStory = (storyId) =>
  apiFetch(`${API_BASE}/api/stories/${encodeURIComponent(storyId)}/view`, {
    method: "POST",
  });

export const deleteStory = (storyId) =>
  apiFetch(`${API_BASE}/api/stories/${encodeURIComponent(storyId)}`, {
    method: "DELETE",
  });

// --- Admin: Scheduled Messages ---
export const fetchAdminScheduledMessages = () =>
  apiFetch(`${API_BASE}/api/admin/scheduled-messages`);

export const createAdminScheduledMessage = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/scheduled-messages`, adminJsonOptions("POST", payload));

export const deleteAdminScheduledMessage = (id) =>
  apiFetch(`${API_BASE}/api/admin/scheduled-messages/${encodeURIComponent(id)}`, adminJsonOptions("DELETE"));

// --- Admin: Branding ---
export const fetchAdminBranding = () =>
  apiFetch(`${API_BASE}/api/admin/branding`);

export const updateAdminBranding = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/branding`, adminJsonOptions("PUT", payload));

// --- Admin: Webhooks ---
export const fetchAdminWebhooks = () =>
  apiFetch(`${API_BASE}/api/admin/webhooks`);

export const createAdminWebhook = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/webhooks`, adminJsonOptions("POST", payload));

export const updateAdminWebhook = (id, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/webhooks/${encodeURIComponent(id)}`, adminJsonOptions("PATCH", payload));

export const deleteAdminWebhook = (id, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/webhooks/${encodeURIComponent(id)}`, adminJsonOptions("DELETE", payload));

export const testAdminWebhook = (id) =>
  apiFetch(`${API_BASE}/api/admin/webhooks/${encodeURIComponent(id)}/test`, adminJsonOptions("POST"));

// --- Admin: Bots ---
export const fetchAdminBots = () =>
  apiFetch(`${API_BASE}/api/admin/bots`);

export const createAdminBot = (payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/bots`, adminJsonOptions("POST", payload));

export const updateAdminBot = (id, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/bots/${encodeURIComponent(id)}`, adminJsonOptions("PATCH", payload));

export const deleteAdminBot = (id, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/bots/${encodeURIComponent(id)}`, adminJsonOptions("DELETE", payload));

// --- Admin: Reset User 2FA ---
export const resetAdminUser2FA = (userId, payload = {}) =>
  apiFetch(`${API_BASE}/api/admin/users/${encodeURIComponent(userId)}/reset-2fa`, adminJsonOptions("POST", payload));

// --- 2FA (User) ---
export const fetch2FAStatus = () =>
  apiFetch(`${API_BASE}/api/2fa/status`);

export const setup2FA = () =>
  apiFetch(`${API_BASE}/api/2fa/setup`, adminJsonOptions("POST"));

export const cancel2FASetup = () =>
  apiFetch(`${API_BASE}/api/2fa/cancel-setup`, adminJsonOptions("POST"));

export const verifySetup2FA = (payload = {}) =>
  apiFetch(`${API_BASE}/api/2fa/verify-setup`, adminJsonOptions("POST", payload));

export const disable2FA = (payload = {}) =>
  apiFetch(`${API_BASE}/api/2fa/disable`, adminJsonOptions("POST", payload));

export const fetch2FABackupCodes = () =>
  apiFetch(`${API_BASE}/api/2fa/backup-codes`);
