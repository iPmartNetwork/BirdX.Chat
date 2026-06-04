const splitEnvList = (value) =>
  String(value || "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const DEFAULT_STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** Build-time fallback from Vite env (parent .env at `npm run build`). */
export function buildIceServersFromViteEnv() {
  const turnUrls = splitEnvList(
    import.meta.env.APP_TURN_URLS ||
      import.meta.env.CHAT_TURN_URLS ||
      import.meta.env.APP_TURN_URL ||
      import.meta.env.CHAT_TURN_URL,
  );
  const turnUsername =
    import.meta.env.APP_TURN_USERNAME || import.meta.env.CHAT_TURN_USERNAME || "";
  const turnCredential =
    import.meta.env.APP_TURN_CREDENTIAL || import.meta.env.CHAT_TURN_CREDENTIAL || "";

  const iceServers = [...DEFAULT_STUN];
  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      ...(turnUsername ? { username: turnUsername } : {}),
      ...(turnCredential ? { credential: turnCredential } : {}),
    });
  }
  return iceServers;
}

/** Runtime config from GET /api/app/info (`rtc` field). */
export function buildIceServersFromRtcPayload(rtc) {
  const remote = Array.isArray(rtc?.iceServers) ? rtc.iceServers : [];
  if (!remote.length) return null;
  return remote;
}

export function iceServersHaveTurn(iceServers) {
  return (iceServers || []).some((server) =>
    []
      .concat(server?.urls || [])
      .join(" ")
      .includes("turn:"),
  );
}

export function mergeIceServers(primary, fallback) {
  if (iceServersHaveTurn(primary)) return primary;
  if (iceServersHaveTurn(fallback)) return fallback;
  return primary?.length ? primary : fallback;
}
