/**
 * Filters a list of user IDs down to those who are currently notifiable,
 * honoring per-user notification preferences (paused / DND).
 *
 * Applied before BOTH Web Push and FCM so both channels respect prefs equally.
 *
 * @param {Array<number>} userIds
 * @param {{ findUserById?: (id: number) => any }} deps
 * @returns {Array<number>}
 */
export function filterNotifiableUserIds(userIds = [], { findUserById } = {}) {
  const ids = (Array.isArray(userIds) ? userIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];
  if (typeof findUserById !== "function") return ids;

  const nowIso = new Date().toISOString();
  return ids.filter((id) => {
    const user = findUserById(id);
    if (!user) return false;
    if (Number(user.notifications_paused || 0)) return false; // paused
    if (user.dnd_until && String(user.dnd_until) > nowIso) return false; // DND active
    return true;
  });
}

export function createPushService({
  webpush,
  listPushSubscriptionsByUserIds,
  deletePushSubscription,
  vapid,
  fcmService = null,
  findUserById = null,
}) {
  const VAPID_PUBLIC_KEY = String(vapid.publicKey || "").trim();
  const VAPID_PRIVATE_KEY = String(vapid.privateKey || "").trim();
  const VAPID_SUBJECT = String(
    vapid.subject || "mailto:admin@example.com",
  ).trim();
  const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

  if (PUSH_ENABLED) {
    try {
      webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
      );
    } catch (error) {
      console.error(
        "[push] VAPID setup failed:",
        String(error?.message || error),
      );
    }
  }

  async function sendWebPush(userIds, payload) {
    if (!PUSH_ENABLED) return;
    const targets = listPushSubscriptionsByUserIds(userIds);
    if (!targets.length) return;
    const body = JSON.stringify(payload || {});
    await Promise.all(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh || "",
                auth: sub.auth || "",
              },
            },
            body,
          );
        } catch (error) {
          const status = Number(error?.statusCode || 0);
          if (status === 404 || status === 410) {
            deletePushSubscription(sub.endpoint);
          }
        }
      }),
    );
  }

  async function sendPushNotificationToUsers(userIds = [], payload = {}) {
    // Respect per-user notification prefs (paused / DND) for BOTH channels.
    const notifiable = filterNotifiableUserIds(userIds, { findUserById });
    if (!notifiable.length) return;

    // Web Push (existing channel) — unchanged behavior.
    await sendWebPush(notifiable, payload).catch((error) => {
      console.warn(
        "[push] Web Push dispatch failed:",
        String(error?.message || error),
      );
    });

    // FCM (new channel) — independent; failure must not block Web Push.
    if (fcmService?.FCM_ENABLED) {
      await fcmService.sendFcmToUsers(notifiable, payload).catch((error) => {
        console.warn(
          "[push] FCM dispatch failed:",
          String(error?.message || error),
        );
      });
    }
  }

  return {
    PUSH_ENABLED,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    sendPushNotificationToUsers,
  };
}
