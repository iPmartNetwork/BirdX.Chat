const STORAGE_MIGRATIONS = [
  ["songbird-perf-telemetry-v1", "birdx-perf-telemetry-v1"],
  ["songbird-insecure-dismissed", "birdx-insecure-dismissed"],
  ["songbird-whats-new-dismissed-version", "birdx-whats-new-dismissed-version"],
  ["songbird-chat-list-cache", "birdx-chat-list-cache"],
  ["songbird-chat-messages-cache", "birdx-chat-messages-cache"],
  ["songbird-chat-messages-index", "birdx-chat-messages-index"],
  ["songbird-channel-seen", "birdx-channel-seen"],
];

const PREFIX_MIGRATIONS = [
  ["songbird-permission-dismiss-", "birdx-permission-dismiss-"],
];

export function migrateLegacyStorageKeys() {
  if (typeof window === "undefined" || !window.localStorage) return;

  STORAGE_MIGRATIONS.forEach(([legacyKey, nextKey]) => {
    try {
      if (localStorage.getItem(legacyKey) == null) return;
      if (localStorage.getItem(nextKey) == null) {
        localStorage.setItem(nextKey, localStorage.getItem(legacyKey));
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // ignore quota / privacy mode
    }
  });

  try {
    const keysToMigrate = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      PREFIX_MIGRATIONS.forEach(([legacyPrefix, nextPrefix]) => {
        if (key.startsWith(legacyPrefix)) {
          keysToMigrate.push([key, `${nextPrefix}${key.slice(legacyPrefix.length)}`]);
        }
      });
    }
    keysToMigrate.forEach(([legacyKey, nextKey]) => {
      if (localStorage.getItem(nextKey) == null) {
        localStorage.setItem(nextKey, localStorage.getItem(legacyKey));
      }
      localStorage.removeItem(legacyKey);
    });
  } catch {
    // ignore
  }
}
