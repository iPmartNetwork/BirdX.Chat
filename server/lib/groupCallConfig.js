import { readEnvInt, readEnvString } from "../settings/env.js";

/** Minimum group members required to start a group call. */
export const GROUP_CALL_MIN_MEMBERS = readEnvInt("GROUP_CALL_MIN_MEMBERS", 10, {
  min: 2,
  max: 100,
});

/** Maximum concurrent participants in one group call room. */
export const GROUP_CALL_MAX_PARTICIPANTS = readEnvInt(
  "GROUP_CALL_MAX_PARTICIPANTS",
  20,
  { min: 2, max: 100 },
);

/** mesh = peer-to-peer mesh (default). sfu = mediasoup SFU when available. */
export const GROUP_CALL_MODE = readEnvString("GROUP_CALL_MODE", "mesh")
  .trim()
  .toLowerCase() === "sfu"
  ? "sfu"
  : "mesh";

export function getGroupCallLimits() {
  return {
    minGroupMembers: GROUP_CALL_MIN_MEMBERS,
    maxParticipants: GROUP_CALL_MAX_PARTICIPANTS,
  };
}

export function getGroupCallConfig() {
  return {
    ...getGroupCallLimits(),
    mode: GROUP_CALL_MODE,
    sfuEnabled: GROUP_CALL_MODE === "sfu",
  };
}
