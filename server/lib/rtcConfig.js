import { readEnvString } from "../settings/env.js";

function splitEnvList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** ICE servers for WebRTC (STUN + optional TURN from server .env). */
export function getRtcIceServers() {
  const turnUrls = splitEnvList(
    readEnvString(
      ["APP_TURN_URLS", "CHAT_TURN_URLS", "APP_TURN_URL", "CHAT_TURN_URL"],
      "",
    ),
  );
  const turnUsername = readEnvString(
    ["APP_TURN_USERNAME", "CHAT_TURN_USERNAME"],
    "",
  );
  const turnCredential = readEnvString(
    ["APP_TURN_CREDENTIAL", "CHAT_TURN_CREDENTIAL"],
    "",
  );

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      ...(turnUsername ? { username: turnUsername } : {}),
      ...(turnCredential ? { credential: turnCredential } : {}),
    });
  }

  return iceServers;
}

export function getRtcPublicConfig() {
  const iceServers = getRtcIceServers();
  const hasTurn = iceServers.some((entry) =>
    []
      .concat(entry.urls || [])
      .join(" ")
      .includes("turn:"),
  );
  return {
    iceServers,
    turnConfigured: hasTurn,
  };
}
