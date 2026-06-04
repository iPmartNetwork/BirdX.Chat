# Design Document

## Overview

این سند طراحی فنی قابلیت **Mobile Push Notifications** را برای BirdX ارائه می‌دهد. هدف، تحویل push notification به اپ Android (Capacitor) حتی در حالت بسته/پس‌زمینه از طریق **Firebase Cloud Messaging (FCM)** است، در کنار سیستم **Web Push (VAPID)** موجود.

اصل طراحی: **افزایشی و بدون تخریب (additive, non-breaking)**. هیچ بخشی از مسیر Web Push فعلی حذف یا بازنویسی نمی‌شود. FCM به‌عنوان یک «کانال تحویل دوم» در کنار Web Push اضافه می‌شود و نقطه تجمیع (fan-out) آن همان تابع موجود `sendPushNotificationToUsers` است.

طراحی چهار لایه را پوشش می‌دهد:
1. **Android (Capacitor shell):** پلاگین‌ها، permissions، Gradle/Firebase، آیکون‌ها، صدا و کانال.
2. **Native Bridge (`native-bridge.js`):** تزریق در WebView، دریافت FCM token، رویدادهای DOM.
3. **Web Client (React):** تشخیص native context، ارسال token به سرور، هندل رویدادهای bridge.
4. **Server (Express):** ذخیره token، ماژول `fcmService`، تجمیع با Web Push، مدیریت credential.

### نگاشت نیازمندی‌ها به اجزای طراحی

| نیازمندی | مؤلفه طراحی اصلی |
|---|---|
| R1 (notification هنگام بسته بودن) | `fcmService` (notification message) + Android FCM |
| R2 (چرخه حیات token) | جدول `device_tokens` + `/api/push/device-token` + `useNativeBridge` |
| R3 (ارسال سمت سرور + همزیستی) | `fcmService` داخل `sendPushNotificationToUsers` |
| R4 (permissions/manifest) | `AndroidManifest.xml` + runtime prompt در bridge |
| R5 (آیکون/کانال/صدا) | منابع Android + کانفیگ `LocalNotifications` |
| R6 (native context detection) | `useNativeBridge` hook + `window.__BIRDX_NATIVE__` |
| R7 (باز شدن چت با لمس) | رویداد `birdx:open-chat` + هندلر ناوبری |
| R8 (حریم خصوصی/امنیت) | فیلتر prefs در سرور + auth در endpoint |
| R9 (پیکربندی Firebase) | Gradle plugin + `FIREBASE_SERVICE_ACCOUNT` env + `.gitignore` |
| R10 (سازگاری با گذشته) | عدم تغییر `push.js` Web Push؛ افزودن کنار آن |

## Architecture

### نمای کلی جریان

```
┌──────────────────────────────────────────────────────────────┐
│                     Android Device                             │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Capacitor WebView (loads https://app.birdx.chat)        │  │
│  │                                                          │  │
│  │   native-bridge.js  ──(injected)──►  React Web Client    │  │
│  │        │  initializes plugins              │             │  │
│  │        │  emits DOM CustomEvents           │ useNativeBridge
│  │        ▼                                    ▼             │  │
│  │  @capacitor/push-notifications      POST /api/push/      │  │
│  │        │ (FCM token)        ──────►        device-token  │  │
│  └────────┼─────────────────────────────────────┼──────────┘  │
│           │                                      │             │
│  ┌────────▼─────────┐                            │             │
│  │ Android FCM SDK  │◄── system notification ────┼─────┐       │
│  │ firebase-messaging│   (when app closed)        │     │       │
│  └────────▲─────────┘                            │     │       │
└───────────┼──────────────────────────────────────┼─────┼───────┘
            │                                      │     │
            │ FCM notification message             │ HTTPS
            │                                      ▼     │
   ┌────────┴──────────┐              ┌─────────────────┴──────┐
   │ Firebase Cloud    │◄─────────────│   BirdX Server         │
   │ Messaging (FCM)   │  send(token) │   (Express)            │
   └───────────────────┘              │                        │
                                      │  sendPushNotificationToUsers()
                                      │    ├─► webpush (existing)│
                                      │    └─► fcmService (new)  │
                                      │  device_tokens table     │
                                      └────────────────────────┘
```

### تصمیمات کلیدی معماری

1. **نقطه تجمیع واحد:** `sendPushNotificationToUsers(userIds, payload)` تنها نقطه‌ای است که هم Web Push و هم FCM را اجرا می‌کند. تمام call siteها (messages, calls, contacts, polls, remote channels) بدون تغییر باقی می‌مانند و خودکار FCM دریافت می‌کنند.

2. **جدول مجزا برای token:** FCM tokenها در جدول جدید `device_tokens` ذخیره می‌شوند، جدا از `push_subscriptions`. این جداسازی R10 (سازگاری) را تضمین می‌کند.

3. **بارگذاری lazy و اختیاری Firebase Admin:** ماژول `firebaseAdmin.js` فقط در صورت وجود `FIREBASE_SERVICE_ACCOUNT` مقداردهی می‌شود. نبود credential = FCM غیرفعال، بدون crash (R3.4, R9.5).

4. **notification message نه data message:** برای تضمین تحویل در حالت بسته، FCM با کلید `notification` ارسال می‌شود (R1.3) و `data` فقط برای routing (chatId).

5. **فیلتر prefs در سرور:** ماژول مشترک `notificationGate` بررسی DND/paused/mute را قبل از ارسال (هم Web Push و هم FCM) انجام می‌دهد. این منطق از call siteها به یک نقطه منتقل/تجمیع می‌شود تا R8 برای هر دو کانال یکسان اعمال شود.

## Components and Interfaces

### ۱. لایه سرور (Server)

#### ۱.۱. Migration جدید: `043-device-tokens.js`

جدول جدید برای ذخیره FCM tokenها، با الگوی مشابه `push_subscriptions`:

```javascript
export const migration043DeviceTokens = {
  version: 43,
  up: ({ db }) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL DEFAULT 'android',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)",
    );
  },
};
```

این migration در `migrations/index.js` ثبت می‌شود (بعد از 042).

#### ۱.۲. توابع DB در `db.js`

```javascript
// ذخیره/به‌روزرسانی token (R2.4, R2.6, R2.7)
export function upsertDeviceToken(userId, token, platform = "android") {
  run(
    `INSERT INTO device_tokens (user_id, token, platform, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(token) DO UPDATE SET
       user_id = excluded.user_id,
       platform = excluded.platform,
       updated_at = datetime('now')`,
    [Number(userId), String(token), String(platform || "android")],
  );
}

// حذف token (R2.10, R2.11)
export function deleteDeviceToken(token) {
  run("DELETE FROM device_tokens WHERE token = ?", [String(token)]);
}

// واکشی tokenهای کاربران هدف (R3.1)
export function listDeviceTokensByUserIds(userIds = []) {
  const ids = [...new Set(userIds.map((id) => Number(id)).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return getAll(
    `SELECT id, user_id, token, platform FROM device_tokens
     WHERE user_id IN (${placeholders})`,
    ids,
  );
}
```

نکته R2.6 (در صورت خطای ON CONFLICT، رکورد جدید بساز): چون از `ON CONFLICT(token)` استفاده می‌شود، آپدیت اتمیک است. اگر به هر دلیل INSERT خطا داد، لایه API خطا را می‌گیرد و طبق R2.5 پاسخ خطا برمی‌گرداند.

#### ۱.۳. ماژول `server/lib/firebaseAdmin.js` (جدید)

مسئول مقداردهی اولیه Firebase Admin SDK به‌صورت اختیاری:

```javascript
import admin from "firebase-admin";

export function createFirebaseAdmin({ readEnvString }) {
  let app = null;
  let enabled = false;

  const raw = readEnvString("FIREBASE_SERVICE_ACCOUNT", "").trim();
  // پشتیبانی از دو حالت: مسیر فایل یا JSON مستقیم (base64 یا plain)
  if (raw) {
    try {
      const credentialJson = resolveServiceAccount(raw); // file path | base64 | inline json
      app = admin.initializeApp({
        credential: admin.credential.cert(credentialJson),
      });
      enabled = true;
    } catch (error) {
      console.error("[fcm] Firebase Admin init failed:", String(error?.message || error));
      enabled = false; // R9.5: بدون crash
    }
  }

  return {
    isEnabled: () => enabled,
    messaging: () => (enabled ? admin.messaging() : null),
  };
}
```

`resolveServiceAccount` سه حالت را می‌پذیرد: مسیر فایل JSON روی دیسک، رشته base64، یا JSON مستقیم. (انعطاف برای deploy؛ سرور production معمولاً مسیر فایل را ترجیح می‌دهد.)

#### ۱.۴. ماژول `server/lib/fcm.js` (جدید)

سرویس ارسال FCM، هم‌امضا با الگوی `createPushService`:

```javascript
export function createFcmService({
  firebaseAdmin,
  listDeviceTokensByUserIds,
  deleteDeviceToken,
}) {
  const FCM_ENABLED = firebaseAdmin.isEnabled();

  async function sendFcmToUsers(userIds = [], payload = {}) {
    if (!FCM_ENABLED) return;                         // R3.3
    const messaging = firebaseAdmin.messaging();
    if (!messaging) return;
    const targets = listDeviceTokensByUserIds(userIds);
    if (!targets.length) return;

    await Promise.all(
      targets.map(async (row) => {
        try {
          await messaging.send({
            token: row.token,
            notification: {                            // R1.3: notification message
              title: String(payload.title || "BirdX"),
              body: String(payload.body || ""),
            },
            data: buildDataPayload(payload),           // R3.6: chatId در data
            android: {
              priority: "high",
              notification: {
                channelId: "birdx_messages",           // R5.3
                sound: "notification_sound",
                color: "#10b981",                      // R5.2
                icon: "ic_notification",               // R5.5
              },
            },
          });
        } catch (error) {
          const code = String(error?.errorInfo?.code || error?.code || "");
          if (code === "messaging/registration-token-not-registered") {
            deleteDeviceToken(row.token);              // R2.11
          } else {
            console.warn("[fcm] send failed:", code || String(error?.message || error));
          }
          // R3.4: خطا را می‌بلعد و ادامه می‌دهد
        }
      }),
    );
  }

  return { FCM_ENABLED, sendFcmToUsers };
}

function buildDataPayload(payload) {
  const data = {};
  if (payload?.data?.chatId != null) data.chatId = String(payload.data.chatId);
  if (payload?.data?.url) data.url = String(payload.data.url);
  if (payload?.data?.type) data.type = String(payload.data.type);
  return data;
}
```

**نکته مهم درباره `payload` فعلی:** call siteهای موجود payload را به شکل `{ title, body, data: { url, chatId? } }` می‌فرستند. برای R3.6 و R7، call siteهای پیام باید `data.chatId` را هم اضافه کنند (تغییر کوچک و سازگار — `url` حفظ می‌شود برای Web Push). این در tasks پوشش داده می‌شود.

#### ۱.۵. اتصال در `sendPushNotificationToUsers`

تابع موجود در `push.js` بدون شکستن امضا گسترش می‌یابد. دو رویکرد ممکن:

**رویکرد انتخابی:** `createPushService` یک پارامتر اختیاری `fcmService` می‌گیرد و در انتهای ارسال Web Push، `sendFcmToUsers` را هم صدا می‌زند:

```javascript
export function createPushService({
  webpush, listPushSubscriptionsByUserIds, deletePushSubscription, vapid,
  fcmService = null,                                  // جدید، اختیاری
}) {
  // ... منطق فعلی Web Push بدون تغییر ...

  async function sendPushNotificationToUsers(userIds = [], payload = {}) {
    // مسیر Web Push موجود (بدون تغییر) — R10.2
    if (PUSH_ENABLED) {
      const targets = listPushSubscriptionsByUserIds(userIds);
      await Promise.all(targets.map(/* ... موجود ... */));
    }
    // مسیر FCM جدید — R3.1, R3.2 (همزمان، مستقل)
    if (fcmService?.FCM_ENABLED) {
      await fcmService.sendFcmToUsers(userIds, payload).catch((error) => {
        console.warn("[push] FCM dispatch failed:", String(error?.message || error));
      }); // R3.4
    }
  }
}
```

این طراحی تضمین می‌کند: اگر `fcmService` پاس داده نشود (یا غیرفعال باشد)، رفتار دقیقاً مثل قبل است (R10).

**نکته همزمانی (R3.2):** Web Push و FCM به‌صورت مستقل اجرا می‌شوند؛ شکست یکی روی دیگری اثر نمی‌گذارد.

#### ۱.۶. NotificationGate (فیلتر prefs مشترک) — R8

در حال حاضر فیلتر mute در call siteها انجام می‌شود اما DND/paused به‌طور سیستماتیک قبل از push بررسی نمی‌شود. برای R8.1/R8.2/R8.3، یک تابع کمکی در `push.js` (یا یک ماژول کوچک `notificationGate.js`) اضافه می‌شود که لیست `userIds` را قبل از ارسال فیلتر می‌کند:

```javascript
// userIds را بر اساس prefs فیلتر می‌کند
export function filterNotifiableUserIds(userIds, { findUserById }) {
  const nowIso = new Date().toISOString();
  return userIds.filter((id) => {
    const user = findUserById(Number(id));
    if (!user) return false;
    if (Number(user.notifications_paused || 0)) return false;        // R8.2
    if (user.dnd_until && String(user.dnd_until) > nowIso) return false; // R8.1
    return true;
  });
}
```

این فیلتر داخل `sendPushNotificationToUsers` (قبل از هر دو کانال) اعمال می‌شود تا هم Web Push و هم FCM یکدست از prefs پیروی کنند. فیلتر mute (R8.3) همچنان در call siteها انجام می‌شود (چون به chatId وابسته است) و `userIds` ورودی از قبل mute-filtered است.

> **توجه سازگاری:** افزودن فیلتر prefs به `sendPushNotificationToUsers` رفتار Web Push را هم تحت تأثیر قرار می‌دهد. این یک بهبود سازگار است (احترام به prefs که کاربر تنظیم کرده) و با R10.2 تناقض ندارد چون R10.2 درباره «فعال ماندن مسیر Web Push» است نه «ارسال به کاربری که خودش اعلان را paused کرده».

#### ۱.۷. API: ثبت/حذف device token

روت‌های جدید در `server/api/push.js` (در کنار روت‌های موجود، بدون تغییر آن‌ها — R10.3):

```javascript
// ثبت FCM token — R2.4, R8.4, R8.5
app.post("/api/push/device-token", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { username, token, platform } = req.body || {};
  if (!username || !token) {
    return res.status(400).json({ error: "Username and token are required." });
  }
  if (!requireSessionUsernameMatch(res, session, username)) return; // R8.5 (fallback reject داخل helper)
  const user = findUserByUsername(String(username).toLowerCase());
  if (!user) return res.status(404).json({ error: "User not found." });
  try {
    upsertDeviceToken(user.id, token, platform);      // R2.4, R8.6
    return res.json({ ok: true });
  } catch (error) {                                    // R2.5: خطا بدون retry
    return res.status(500).json({ error: "Unable to save device token." });
  }
});

// حذف FCM token — R2.9, R2.10
app.delete("/api/push/device-token", (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { username, token } = req.body || {};
  if (!username || !token) {
    return res.status(400).json({ error: "Username and token are required." });
  }
  if (!requireSessionUsernameMatch(res, session, username)) return;
  deleteDeviceToken(token);
  return res.json({ ok: true });
});
```

`requireSessionUsernameMatch` از پیش وجود دارد و در صورت عدم تطابق، خطای ۴۰۳ برمی‌گرداند (R8.5).

#### ۱.۸. اتصال در `server/index.js`

```javascript
import { createFirebaseAdmin } from "./lib/firebaseAdmin.js";
import { createFcmService } from "./lib/fcm.js";
import { readEnvString } from "./settings/env.js";

const firebaseAdmin = createFirebaseAdmin({ readEnvString });
const fcmService = createFcmService({
  firebaseAdmin,
  listDeviceTokensByUserIds,
  deleteDeviceToken,
});

const pushService = createPushService({
  webpush, listPushSubscriptionsByUserIds, deletePushSubscription, vapid,
  fcmService,                                         // تزریق FCM
});
```

و افزودن `upsertDeviceToken`, `deleteDeviceToken`, `listDeviceTokensByUserIds`, `findUserByUsername` به `apiDeps`.

### ۲. لایه Android (Capacitor)

#### ۲.۱. `apps/mobile/package.json`

افزودن ۱۳ پلاگین (از work2):
`@capacitor/app`, `@capacitor/browser`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/local-notifications`, `@capacitor/network`, `@capacitor/preferences`, `@capacitor/push-notifications`, `@capacitor/share`, `@capawesome/capacitor-badge`. (biometric در صورت نیاز اختیاری.)

#### ۲.۲. `apps/mobile/capacitor.config.json`

افزودن کانفیگ پلاگین‌ها (از work2): بخش‌های `PushNotifications`, `LocalNotifications` (smallIcon=`ic_notification`, iconColor=`#10b981`), `Keyboard`, `Camera`، و `android.handleBackButton: true`.

#### ۲.۳. `AndroidManifest.xml` — R4

افزودن permissions و سرویس FCM:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- داخل <application> -->
<meta-data
  android:name="com.google.firebase.messaging.default_notification_channel_id"
  android:value="birdx_messages" />
<meta-data
  android:name="com.google.firebase.messaging.default_notification_icon"
  android:resource="@drawable/ic_notification" />
<meta-data
  android:name="com.google.firebase.messaging.default_notification_color"
  android:resource="@color/birdx_accent" />
```

سرویس FCM (`FirebaseMessagingService`) توسط پلاگین `@capacitor/push-notifications` به‌صورت خودکار رجیستر می‌شود؛ نیازی به کلاس سفارشی نیست (R4.5 از طریق merge کردن manifest پلاگین تأمین می‌شود، اما meta-data بالا کانال/آیکون پیش‌فرض را تنظیم می‌کند).

#### ۲.۴. Gradle / Firebase — R9

- `apps/mobile/android/build.gradle`: افزودن classpath `com.google.gms:google-services`.
- `apps/mobile/android/app/build.gradle`: اعمال `apply plugin: 'com.google.gms.google-services'` و افزودن وابستگی `com.google.firebase:firebase-messaging`.
- قراردادن `google-services.json` در `apps/mobile/android/app/`.
- پلاگین google-services طوری پیکربندی می‌شود که نبود فایل build را نشکند (R9.2) — در عمل اگر فایل موجود باشد مشکلی نیست؛ برای حالت نبود، از یک فایل placeholder یا flag استفاده می‌شود.

#### ۲.۵. منابع (Resources) — R5

- آیکون‌های launcher: `mipmap-*/ic_launcher*.png` + `mipmap-anydpi-v26/ic_launcher.xml` (از work2).
- آیکون نوتیفیکیشن: `drawable/ic_notification.png` (یا vector) — آیکون monochrome سفید برای status bar.
- رنگ: `values/colors.xml` → `<color name="birdx_accent">#10b981</color>`.
- صدا: `res/raw/notification_sound.mp3`.

> **نکته منبع صدا/آیکون:** اگر `ic_notification` یا `notification_sound.mp3` در work2 موجود نباشند، در tasks یک گام برای ساخت/قراردادن آن‌ها لحاظ می‌شود. آیکون status bar باید monochrome باشد وگرنه Android آن را به مربع سفید تبدیل می‌کند.

### ۳. لایه Native Bridge

#### ۳.۱. `apps/mobile/www/native-bridge.js`

اسکریپت آماده از work2 منتقل می‌شود. مسئولیت‌ها (مطابق R2, R5, R6, R7):
- `window.__BIRDX_NATIVE__ = true` و `window.BirdXNative` (R6.1).
- مقداردهی `@capacitor/push-notifications`: درخواست permission (R4.6)، register، و listenerها.
- انتشار `birdx:push-token` روی `registration` (R2.2, R2.7).
- انتشار `birdx:notification` روی `pushNotificationReceived`.
- انتشار `birdx:open-chat` روی `pushNotificationActionPerformed` با `data.chatId` (R7.1).
- غیرفعال‌سازی PWA install prompt و unregister service worker (R6.5, R6.6).
- ساخت Notification_Channel `birdx_messages` (R5.3) — از طریق `LocalNotifications.createChannel`.

**نکته R4.6 (نمایش prompt حتی اگر granted):** کد فعلی work2 فقط در صورت granted نبودن register می‌کند. برای رعایت R4.6 (نمایش dialog حتی اگر قبلاً granted)، `PushNotifications.requestPermissions()` همیشه یک بار در اولین اجرای پس از احراز هویت صدا زده می‌شود. روی Android اگر قبلاً granted باشد، سیستم بدون نمایش مجدد dialog بلافاصله granted برمی‌گرداند (رفتار OS)، که با هدف R4.6 سازگار است.

#### ۳.۲. تزریق bridge در WebView

چون WebView از `https://app.birdx.chat` (یعنی همان React build) لود می‌شود، `native-bridge.js` باید در دسترس باشد. دو گزینه:

- **گزینه A (انتخابی):** اسکریپت در build کلاینت (`client/index.html` یا به‌صورت ماژول) قرار گیرد و فقط در native context اجرا شود. اما چون bridge به Capacitor متکی است و فقط در WebView معنا دارد، قراردادن آن در `client/public/native-bridge.js` و بارگذاری شرطی منطقی است.
- **گزینه B:** استفاده از قابلیت Capacitor برای inject. 

**تصمیم:** فایل در `apps/mobile/www/native-bridge.js` نگهداری می‌شود (مطابق R6.8 و دارایی work2) و نیز نسخه‌ای در `client/public/` قرار می‌گیرد که `index.html` آن را با تگ `<script>` بارگذاری می‌کند؛ خود اسکریپت در ابتدای اجرا بررسی می‌کند `window.Capacitor?.isNativePlatform()` و در غیر native context هیچ کاری نمی‌کند (no-op). این تضمین می‌کند PWA/desktop تحت تأثیر قرار نگیرند (R10.5, R6.4).

### ۴. لایه Web Client (React)

#### ۴.۱. Hook جدید: `client/src/hooks/useNativeBridge.js`

مسئول تشخیص native context و پل زدن رویدادهای bridge به منطق React:

```javascript
export function useNativeBridge({ user, registerDeviceToken, unregisterDeviceToken, onOpenChat }) {
  const isNative = typeof window !== "undefined" && window.__BIRDX_NATIVE__ === true; // R6.2

  // R2.3: شنیدن birdx:push-token و ارسال به سرور
  useEffect(() => {
    if (!isNative || !user?.username) return;
    const handler = (e) => {
      const token = e.detail?.token;
      if (token) registerDeviceToken({ username: user.username, token });
    };
    window.addEventListener("birdx:push-token", handler);
    return () => window.removeEventListener("birdx:push-token", handler);
  }, [isNative, user?.username, registerDeviceToken]);

  // R7.2: شنیدن birdx:open-chat
  useEffect(() => {
    if (!isNative) return;
    const handler = (e) => {
      const chatId = Number(e.detail?.chatId || 0);
      if (chatId) onOpenChat(chatId);
    };
    window.addEventListener("birdx:open-chat", handler);
    return () => window.removeEventListener("birdx:open-chat", handler);
  }, [isNative, onOpenChat]);

  return { isNative };
}
```

#### ۴.۲. API client در `client/src/api/chatApi.js`

```javascript
export const registerDeviceToken = ({ username, token, platform = "android" }) =>
  apiFetch(`${API_BASE}/api/push/device-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, token, platform }),
  });

export const unregisterDeviceToken = ({ username, token }) =>
  apiFetch(`${API_BASE}/api/push/device-token`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, token }),
  });
```

#### ۴.۳. هماهنگی با `useChatNotifications` — R6.3, R6.4

`useChatNotifications` (Web Push) باید در native context **اجرا نشود**. یک گارد اضافه می‌شود:

```javascript
const isNative = typeof window !== "undefined" && window.__BIRDX_NATIVE__ === true;
// در توابع subscribe: اگر isNative بود، early return
```

این تضمین می‌کند در native فقط FCM و در PWA فقط Web Push فعال است (R6.3, R6.4).

#### ۴.۴. هندل `birdx:open-chat` در ناوبری

`onOpenChat(chatId)` از طریق همان مکانیزم موجود `OPEN_CHAT_ID_KEY` (که در ChatPage برای deep link استفاده می‌شود) چت را باز می‌کند (R7.2). اگر اپ تازه باز شده، پس از کامل شدن auth و load، چت هدف باز می‌شود (R7.3). اگر chatId نامعتبر بود، لیست چت‌ها نمایش داده می‌شود (R7.4 — رفتار پیش‌فرض موجود).

#### ۴.۵. logout — R2.8

در مسیر logout موجود، اگر `isNative` بود و token در دسترس بود (از `birdx:push-token` ذخیره‌شده در state/ref)، `unregisterDeviceToken` صدا زده می‌شود قبل از پاک کردن session.

## Data Models

### جدول `device_tokens` (جدید)

| ستون | نوع | توضیح |
|---|---|---|
| `id` | INTEGER PK | شناسه |
| `user_id` | INTEGER FK→users | کاربر مالک token (R8.6) |
| `token` | TEXT UNIQUE | FCM registration token (R2.5 dedupe) |
| `platform` | TEXT | پیش‌فرض `android` |
| `created_at` | TEXT | زمان ایجاد |
| `updated_at` | TEXT | زمان آخرین به‌روزرسانی (R2.7) |

### Payload استاندارد notification

ساختار مشترک بین Web Push و FCM (R3.5):

```javascript
{
  title: "نام چت یا فرستنده",
  body: "متن پیش‌نمایش پیام",
  data: {
    url: "/chat?openChatId=123",  // برای Web Push (موجود)
    chatId: "123",                // برای FCM open-chat (R3.6, R7)
    type: "message" | "call" | "contact" | "poll"
  }
}
```

## Error Handling

| سناریو | رفتار | نیازمندی |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` تنظیم نشده | FCM غیرفعال، سرور بالا می‌آید، فقط Web Push | R3.3, R9.5 |
| Firebase Admin init خطا | log + FCM غیرفعال، بدون crash | R9.5 |
| ارسال FCM به یک token خطا | log + ادامه به سایر tokenها و Web Push | R3.4 |
| token نامعتبر/منقضی (`registration-token-not-registered`) | حذف token از `device_tokens` | R2.11 |
| خطای ذخیره token در DB | پاسخ ۵۰۰ به کلاینت، بدون retry | R2.5 |
| ارسال FCM تماس خطا | log + ادامه | R1.5 |
| permission POST_NOTIFICATIONS رد شد | اپ بدون crash ادامه، عدم نمایش notification | R4.8 |
| غیرفعال‌سازی install prompt یا SW خطا | مستقل ادامه به دیگری | R6.6 |
| username ≠ session در ثبت/حذف token | رد ۴۰۳ (fallback reject) | R8.5 |
| chatId نامعتبر در open-chat | نمایش لیست چت‌ها | R7.4 |

## Security Considerations

1. **احراز هویت token endpoints (R8.4, R8.5):** هر دو روت `device-token` از `requireSession` + `requireSessionUsernameMatch` استفاده می‌کنند. token فقط به user_id نشست احراز هویت‌شده گره می‌خورد (R8.6).

2. **محرمانگی Service Account (R9.4, R9.6):** کلید از `FIREBASE_SERVICE_ACCOUNT` env خوانده می‌شود (مسیر فایل یا base64). فایل کلید و هر `*-service-account*.json` به `.gitignore` افزوده می‌شود. هرگز در پاسخ‌های API echo نمی‌شود.

3. **احترام به prefs (R8.1–R8.3):** فیلتر DND/paused/mute قبل از ارسال، از نشت اعلان ناخواسته جلوگیری می‌کند.

4. **محتوای notification:** عنوان/متن همان پیش‌نمایش موجود است؛ تغییری در سطح افشای محتوا ایجاد نمی‌شود.

## Testing Strategy

از آنجا که پروژه فریم‌ورک تست خودکار ندارد و قانون پروژه افزودن تست بدون درخواست صریح را منع می‌کند، راهبرد تست **دستی و مبتنی بر verification** است:

1. **سرور (بدون Firebase):** اطمینان از اینکه سرور بدون `FIREBASE_SERVICE_ACCOUNT` بالا می‌آید و Web Push کار می‌کند (`node --check`، اجرای سرور، تست `/api/push/test`). (R9.5, R10)
2. **سرور (با Firebase):** پس از تنظیم credential، تست endpoint `/api/push/device-token` (ثبت/حذف) و یک ارسال آزمایشی FCM.
3. **Android build:** اجرای `gradlew assembleDebug` و اطمینان از موفقیت build با google-services و permissions جدید.
4. **سناریوی end-to-end:** نصب APK، login، تأیید دریافت FCM token در سرور (لاگ)، بستن کامل اپ، ارسال پیام از کاربر دیگر، مشاهده notification، لمس و باز شدن چت صحیح (R1, R7).
5. **عدم رگرسیون:** تست Web Push روی مرورگر/PWA بدون تغییر (R10).

هر گام verification در tasks به‌صورت صریح ذکر می‌شود.

## Correctness Properties

این بخش ویژگی‌های ثابت (invariants) سیستم را تعریف می‌کند که باید در هر شرایطی برقرار بمانند. چون پروژه فریم‌ورک تست خودکار ندارد، این ویژگی‌ها به‌صورت معیارهای verification دستی بررسی می‌شوند (نه property-based tests خودکار).

### Property 1: عدم تخریب Web Push (Non-Regression Invariant)
در هر مسیر اجرایی، اگر `fcmService` غیرفعال یا تزریق‌نشده باشد، رفتار `sendPushNotificationToUsers` باید **دقیقاً** برابر رفتار قبل از این تغییر باشد.
- **Validates: Requirements 10.2, 3.3**
- **Verification:** اجرای سرور بدون `FIREBASE_SERVICE_ACCOUNT` و تأیید کارکرد `/api/push/test` روی مرورگر.

### Property 2: همزیستی مستقل کانال‌ها (Channel Independence)
شکست در ارسال FCM هرگز نباید مانع ارسال Web Push شود و بالعکس. هر دو کانال در `Promise` های مستقل با `catch` جداگانه اجرا می‌شوند.
- **Validates: Requirements 3.4**
- **Verification:** شبیه‌سازی خطای FCM (token جعلی) و تأیید اینکه Web Push همچنان ارسال می‌شود.

### Property 3: یکتایی token به ازای دستگاه (Token Uniqueness)
برای هر `token` در `device_tokens` فقط یک رکورد وجود دارد (به‌خاطر `UNIQUE` + `ON CONFLICT`). ثبت مجدد همان token، رکورد را به‌روزرسانی می‌کند نه تکراری.
- **Validates: Requirements 2.6**
- **Verification:** فراخوانی دوباره `/api/push/device-token` با همان token و بررسی عدم ایجاد رکورد دوم.

### Property 4: گره خوردن token به مالک احراز هویت‌شده (Ownership Invariant)
هر `token` همواره به `user_id` نشستی که آن را ثبت کرده مرتبط است؛ درخواست با username نامتطابق همواره رد می‌شود.
- **Validates: Requirements 8.5, 8.6**
- **Verification:** تلاش ثبت token با username متفاوت از session و تأیید پاسخ ۴۰۳.

### Property 5: احترام قطعی به prefs (Preference Gate Invariant)
اگر کاربری `notifications_paused` یا `dnd_until` فعال داشته باشد، **هیچ** push (نه Web Push نه FCM) برای او ارسال نمی‌شود.
- **Validates: Requirements 8.1, 8.2**
- **Verification:** تنظیم `notifications_paused=1` برای یک کاربر و تأیید عدم دریافت notification.

### Property 6: پاکسازی token نامعتبر (Stale Token Cleanup)
دریافت خطای `messaging/registration-token-not-registered` همواره منجر به حذف آن token از `device_tokens` می‌شود تا انباشت token مرده رخ ندهد.
- **Validates: Requirements 2.11**
- **Verification:** ارسال به یک token باطل و بررسی حذف آن از جدول.

### Property 7: انزوای native context (Context Isolation)
مسیر Web Push فقط خارج از native و مسیر FCM فقط داخل native فعال می‌شود؛ این دو هرگز همزمان روی یک دستگاه فعال نیستند.
- **Validates: Requirements 6.3, 6.4**
- **Verification:** اجرای PWA در مرورگر (فقط Web Push) و اپ native (فقط FCM)، بررسی لاگ‌ها.

## Migration & Rollout

1. **DB migration 043** به‌صورت idempotent (`CREATE TABLE IF NOT EXISTS`) اجرا می‌شود؛ روی نصب‌های موجود امن است.
2. **عقب‌گرد (rollback):** حذف `FIREBASE_SERVICE_ACCOUNT` env کافی است تا FCM غیرفعال شود و سیستم به رفتار فقط-Web-Push برگردد.
3. **وابستگی سرور:** افزودن `firebase-admin` به `server/package.json`. این تنها dependency جدید سمت سرور است.
4. **ترتیب deploy:** ابتدا سرور (با migration و endpoint جدید) سپس build و توزیع APK جدید.
