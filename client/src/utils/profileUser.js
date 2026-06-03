export function normalizeProfileUser(raw) {
  if (!raw) return null;
  const username = String(raw.username || "").trim();
  if (!username) return null;
  return {
    id: Number(raw.id || 0) || null,
    username,
    nickname: String(raw.nickname || raw.username || "").trim() || username,
    avatar_url: String(raw.avatar_url || raw.avatarUrl || "").trim(),
    color: raw.color || "#10b981",
    status: String(raw.status || "online").toLowerCase(),
    role: String(raw.role || ""),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export function mapProfileFromApi(data) {
  if (!data?.username) return null;
  return normalizeProfileUser({
    id: data.id,
    username: data.username,
    nickname: data.nickname,
    avatar_url: data.avatarUrl,
    color: data.color,
    status: data.status,
  });
}
