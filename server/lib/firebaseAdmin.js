import fs from "node:fs";
import admin from "firebase-admin";

/**
 * Resolves the Firebase service account credentials from a single env value.
 * Supports three formats so deployments can pick whatever is convenient:
 *   1. Absolute/relative path to a service-account JSON file on disk.
 *   2. Base64-encoded JSON string.
 *   3. Inline JSON string.
 *
 * @param {string} raw
 * @returns {object} parsed service account JSON
 */
function resolveServiceAccount(raw) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("empty service account value");

  // 1. File path
  if (!value.startsWith("{") && fs.existsSync(value)) {
    const fileContent = fs.readFileSync(value, "utf8");
    return JSON.parse(fileContent);
  }

  // 3. Inline JSON
  if (value.startsWith("{")) {
    return JSON.parse(value);
  }

  // 2. Base64-encoded JSON
  const decoded = Buffer.from(value, "base64").toString("utf8");
  return JSON.parse(decoded);
}

/**
 * Creates the Firebase Admin wrapper. FCM is optional: if FIREBASE_SERVICE_ACCOUNT
 * is missing or invalid, the wrapper stays disabled and the server keeps running
 * with Web Push only (no crash).
 *
 * @param {{ readEnvString: (keys: string|string[], fallback?: string) => string }} deps
 */
export function createFirebaseAdmin({ readEnvString }) {
  let app = null;
  let enabled = false;

  const raw = readEnvString("FIREBASE_SERVICE_ACCOUNT", "").trim();

  if (raw) {
    try {
      const serviceAccount = resolveServiceAccount(raw);
      // Reuse an already-initialized default app if present (e.g. hot reload).
      app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
      enabled = true;
      console.log("[fcm] Firebase Admin initialized; FCM push enabled.");
    } catch (error) {
      enabled = false;
      console.error(
        "[fcm] Firebase Admin init failed; FCM disabled:",
        String(error?.message || error),
      );
    }
  } else {
    console.log(
      "[fcm] FIREBASE_SERVICE_ACCOUNT not set; FCM disabled (Web Push only).",
    );
  }

  return {
    isEnabled: () => enabled,
    messaging: () => (enabled ? admin.messaging() : null),
  };
}
