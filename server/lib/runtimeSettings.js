const DEFAULTS = {
  maintenanceMode: false,
  maintenanceMessage: "",
  accountCreation: null,
  fileUpload: null,
};

let cache = null;

function parseStored(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadRuntimeSettings(getRow) {
  if (cache) return cache;
  const row = getRow?.("SELECT value FROM app_settings WHERE key = 'runtime_settings'");
  cache = { ...DEFAULTS, ...parseStored(row?.value) };
  return cache;
}

export function getRuntimeSettings(getRow) {
  return { ...loadRuntimeSettings(getRow) };
}

export function saveRuntimeSettings(partial, run, save, getRow) {
  const current = loadRuntimeSettings(getRow);
  cache = {
    ...current,
    ...partial,
  };
  run?.(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('runtime_settings', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [JSON.stringify(cache)],
  );
  save?.();
  return cache;
}

export function resetRuntimeSettingsCache() {
  cache = null;
}

export function resolveRuntimeFlag(storedValue, envDefault) {
  if (storedValue === null || storedValue === undefined) return Boolean(envDefault);
  return Boolean(storedValue);
}

export function getMaintenanceState(getRow) {
  const settings = loadRuntimeSettings(getRow);
  return {
    enabled: Boolean(settings.maintenanceMode),
    message: String(settings.maintenanceMessage || "").trim(),
  };
}
