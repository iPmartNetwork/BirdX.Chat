const readEnvNumber = (key, fallback, options = {}) => {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = options.integer ? Math.trunc(parsed) : parsed;
  if (options.min !== undefined && integer < options.min) return fallback;
  if (options.max !== undefined && integer > options.max) return fallback;
  return integer;
};

export const CALL_CONFIG = {
  groupCallMinMembers: readEnvNumber("VITE_GROUP_CALL_MIN_MEMBERS", 10, {
    integer: true,
    min: 2,
    max: 100,
  }),
  groupCallMaxParticipants: readEnvNumber("VITE_GROUP_CALL_MAX_PARTICIPANTS", 20, {
    integer: true,
    min: 2,
    max: 100,
  }),
};

export function resolveGroupCallLimits(appInfo) {
  const remote = appInfo?.groupCalls || {};
  const minGroupMembers = Number(remote.minGroupMembers);
  const maxParticipants = Number(remote.maxParticipants);
  const mode = String(remote.mode || remote.sfuEnabled ? "sfu" : "mesh").toLowerCase();
  return {
    minGroupMembers:
      Number.isFinite(minGroupMembers) && minGroupMembers >= 2
        ? minGroupMembers
        : CALL_CONFIG.groupCallMinMembers,
    maxParticipants:
      Number.isFinite(maxParticipants) && maxParticipants >= 2
        ? maxParticipants
        : CALL_CONFIG.groupCallMaxParticipants,
    mode: mode === "sfu" ? "sfu" : "mesh",
    sfuEnabled: mode === "sfu" || Boolean(remote.sfuEnabled),
  };
}
