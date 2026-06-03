const ADMIN_ACCESS_ROLES = ["owner", "admin", "moderator", "support"];

export function userHasAdminAccess(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return ADMIN_ACCESS_ROLES.includes(String(user.role || "").toLowerCase());
}

export { ADMIN_ACCESS_ROLES };
