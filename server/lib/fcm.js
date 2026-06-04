/**
 * FCM (Firebase Cloud Messaging) send service.
 *
 * Sends notification messages to native Android devices via Firebase Admin SDK.
 * Runs alongside the existing Web Push (VAPID) channel; the two are independent.
 *
 * Notification messages (with the `notification` key) are used so Android can
 * display the notification even when the app is fully closed/backgrounded.
 */

const STALE_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

function buildDataPayload(payload = {}) {
  const data = {};
  const source = payload?.data || {};
  if (source.chatId != null) data.chatId = String(source.chatId);
  if (source.url) data.url = String(source.url);
  if (source.type) data.type = String(source.type);
  return data;
}

export function createFcmService({
  firebaseAdmin,
  listDeviceTokensByUserIds,
  deleteDeviceToken,
}) {
  const FCM_ENABLED = Boolean(firebaseAdmin?.isEnabled?.());

  async function sendFcmToUsers(userIds = [], payload = {}) {
    if (!FCM_ENABLED) return;
    const messaging = firebaseAdmin.messaging();
    if (!messaging) return;

    const targets = listDeviceTokensByUserIds(userIds) || [];
    if (!targets.length) return;

    const title = String(payload?.title || "BirdX");
    const body = String(payload?.body || "");
    const data = buildDataPayload(payload);

    await Promise.all(
      targets.map(async (row) => {
        const token = String(row?.token || "").trim();
        if (!token) return;
        try {
          await messaging.send({
            token,
            notification: { title, body },
            data,
            android: {
              priority: "high",
              notification: {
                channelId: "birdx_messages",
                sound: "notification_sound",
                color: "#10b981",
                icon: "ic_notification",
              },
            },
          });
        } catch (error) {
          const code = String(
            error?.errorInfo?.code || error?.code || "",
          );
          if (STALE_TOKEN_CODES.has(code)) {
            // Remove dead/invalid tokens so we don't keep retrying them.
            try {
              deleteDeviceToken(token);
            } catch {
              // ignore cleanup failures
            }
          } else {
            console.warn(
              "[fcm] send failed:",
              code || String(error?.message || error),
            );
          }
          // Swallow the error and continue with other tokens / Web Push.
        }
      }),
    );
  }

  return { FCM_ENABLED, sendFcmToUsers };
}
