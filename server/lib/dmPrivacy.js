import { readEnvInt } from "../settings/env.js";

export const DM_POLICIES = ["nobody", "acquaintances", "everyone"];
const POLICY_RANK = { nobody: 0, acquaintances: 1, everyone: 2 };

export function getDmDiscoveryMode() {
  const raw = String(process.env.DM_DISCOVERY_MODE || "exact_username")
    .trim()
    .toLowerCase();
  if (["off", "exact_username", "all"].includes(raw)) return raw;
  return "exact_username";
}

export function getServerMaxDmPolicy() {
  const raw = String(process.env.DM_MAX_POLICY || "everyone")
    .trim()
    .toLowerCase();
  if (DM_POLICIES.includes(raw)) return raw;
  return "everyone";
}

export function normalizeDmPolicy(value, serverMax = getServerMaxDmPolicy()) {
  const policy = DM_POLICIES.includes(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : "acquaintances";
  const maxRank = POLICY_RANK[serverMax] ?? 2;
  const policyRank = POLICY_RANK[policy] ?? 1;
  if (policyRank > maxRank) {
    return serverMax === "everyone" ? "everyone" : serverMax;
  }
  return policy;
}

export function getDmRejectCooldownDays() {
  return readEnvInt(["DM_REJECT_COOLDOWN_DAYS"], 7, { min: 1, max: 90 });
}

export function getDmRequestsPerDayLimit() {
  return readEnvInt(["DM_REQUESTS_PER_DAY"], 20, { min: 1, max: 500 });
}

export function evaluateDmAccess({
  fromUser,
  toUser,
  usersShareGroup,
  blockedEitherWay,
}) {
  if (blockedEitherWay) {
    return { allowed: false, code: "blocked", message: "You cannot message this user." };
  }

  const toPolicy = normalizeDmPolicy(toUser?.dm_policy, getServerMaxDmPolicy());

  if (toPolicy === "nobody") {
    return {
      allowed: false,
      code: "dm_closed",
      message: "This user is not accepting direct messages.",
    };
  }

  if (toPolicy === "everyone") {
    return { allowed: true, direct: true, status: "active" };
  }

  if (usersShareGroup) {
    return { allowed: true, direct: true, status: "active" };
  }

  return {
    allowed: true,
    direct: false,
    status: "pending",
    message: "Your message will be sent as a conversation request.",
  };
}

export function recordDmSecurityEvent(adminRun, adminSave, req, type, details = {}) {
  if (!adminRun) return;
  try {
    const ip = String(
      req.headers?.["x-forwarded-for"] ||
        req.headers?.["x-real-ip"] ||
        req.socket?.remoteAddress ||
        req.ip ||
        "",
    )
      .split(",")[0]
      .trim();
    adminRun(
      `INSERT INTO security_events (type, username, user_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(type || ""),
        String(details.username || "").trim().toLowerCase() || null,
        Number(details.userId || 0) || null,
        ip,
        String(req.headers?.["user-agent"] || "").slice(0, 500),
        JSON.stringify(details),
      ],
    );
    adminSave?.();
  } catch (error) {
    console.warn("[dm-privacy] security log failed:", String(error?.message || error));
  }
}
