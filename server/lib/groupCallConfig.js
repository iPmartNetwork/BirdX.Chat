import { readEnvInt, readEnvString } from "../settings/env.js";

/**
 * NOTE: These are read lazily (inside functions) rather than at module load.
 * In ESM, all imports are hoisted and evaluated before `dotenv.config()` runs
 * in index.js, so reading process.env at module top-level would always return
 * the fallback values regardless of .env settings.
 */

/** Minimum group members required to start a group call. */
export function getGroupCallMinMembers() {
  return readEnvInt("GROUP_CALL_MIN_MEMBERS", 10, { min: 2, max: 100 });
}

/** Maximum concurrent participants in one group call room. */
export function getGroupCallMaxParticipants() {
  return readEnvInt("GROUP_CALL_MAX_PARTICIPANTS", 20, { min: 2, max: 100 });
}

/** mesh = peer-to-peer mesh (default). sfu = mediasoup SFU when available. */
export function getGroupCallMode() {
  return readEnvString("GROUP_CALL_MODE", "mesh").trim().toLowerCase() === "sfu"
    ? "sfu"
    : "mesh";
}

export function getGroupCallLimits() {
  return {
    minGroupMembers: getGroupCallMinMembers(),
    maxParticipants: getGroupCallMaxParticipants(),
  };
}

export function getGroupCallConfig() {
  const mode = getGroupCallMode();
  return {
    ...getGroupCallLimits(),
    mode,
    sfuEnabled: mode === "sfu",
  };
}
