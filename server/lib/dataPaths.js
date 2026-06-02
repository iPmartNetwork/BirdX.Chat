import fs from "node:fs";
import path from "node:path";

export const BIRDX_DB_FILENAME = "birdx.db";
export const LEGACY_DB_FILENAME = "songbird.db";
export const BIRDX_BACKUP_PREFIX = "birdx-backup";
export const LEGACY_BACKUP_PREFIX = "songbird-backup";

export const BIRDX_BACKUP_ZIP_PATTERN = /^birdx-backup-.*\.zip$/i;
export const LEGACY_BACKUP_ZIP_PATTERN = /^songbird-backup-.*\.zip$/i;
export const BACKUP_ZIP_PATTERN = /^(?:birdx|songbird)-backup-.*\.zip$/i;

export const BIRDX_SERVICE_NAME = "birdx.service";
export const LEGACY_SERVICE_NAME = "songbird.service";

export function resolveProjectDataDir(projectRootDir) {
  return path.resolve(projectRootDir, "data");
}

/** Prefer birdx.db; one-time rename from songbird.db when present. */
export function resolveDatabasePath(dataDir, fsImpl = fs) {
  const birdxPath = path.join(dataDir, BIRDX_DB_FILENAME);
  const legacyPath = path.join(dataDir, LEGACY_DB_FILENAME);
  if (!fsImpl.existsSync(birdxPath) && fsImpl.existsSync(legacyPath)) {
    fsImpl.renameSync(legacyPath, birdxPath);
    console.log(`[birdx] Migrated ${LEGACY_DB_FILENAME} → ${BIRDX_DB_FILENAME}`);
  }
  return birdxPath;
}

export function resolveServiceName(env = process.env) {
  return (
    String(env.BIRDX_SERVICE_NAME || "").trim() ||
    String(env.SONGBIRD_SERVICE_NAME || "").trim() ||
    BIRDX_SERVICE_NAME
  );
}

export function resolveServiceUser(env = process.env) {
  return (
    String(env.BIRDX_SERVICE_USER || "").trim() ||
    String(env.SONGBIRD_SERVICE_USER || "").trim() ||
    "birdx"
  );
}

export function detectBackupLayout(extractedRoot, fsImpl = fs) {
  const exists = (targetPath) =>
    targetPath && fsImpl.existsSync(targetPath);

  const currentEnvSrc = path.join(extractedRoot, ".env");
  const currentDataSrc = path.join(extractedRoot, "data");
  const currentDbBirdx = path.join(currentDataSrc, BIRDX_DB_FILENAME);
  const currentDbLegacy = path.join(currentDataSrc, LEGACY_DB_FILENAME);
  const currentUploadsSrc = path.join(currentDataSrc, "uploads");

  const currentDbSrc = exists(currentDbBirdx)
    ? currentDbBirdx
    : exists(currentDbLegacy)
      ? currentDbLegacy
      : null;

  if (currentDbSrc && exists(currentUploadsSrc)) {
    return {
      kind: "current",
      envSrc: exists(currentEnvSrc) ? currentEnvSrc : null,
      dbSrc: currentDbSrc,
      uploadsSrc: currentUploadsSrc,
    };
  }

  const legacyDbBirdx = path.join(extractedRoot, BIRDX_DB_FILENAME);
  const legacyDbLegacy = path.join(extractedRoot, LEGACY_DB_FILENAME);
  const legacyDbSrc = exists(legacyDbBirdx)
    ? legacyDbBirdx
    : exists(legacyDbLegacy)
      ? legacyDbLegacy
      : null;
  const legacyUploadsSrc = path.join(extractedRoot, "uploads");

  if (legacyDbSrc && exists(legacyUploadsSrc)) {
    return {
      kind: "legacy",
      envSrc: exists(currentEnvSrc) ? currentEnvSrc : null,
      dbSrc: legacyDbSrc,
      uploadsSrc: legacyUploadsSrc,
    };
  }

  return null;
}
