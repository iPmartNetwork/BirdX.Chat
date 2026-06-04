# Implementation Plan

## Overview

این برنامه پیاده‌سازی، طراحی `design.md` را به تسک‌های کوچک و قابل اجرا تبدیل می‌کند. ترتیب تسک‌ها به‌گونه‌ای است که ابتدا سمت سرور (با حفظ سازگاری Web Push)، سپس Android، سپس bridge و web client پیاده می‌شود. هر تسک شامل گام verification است.

اصل راهنما: تغییرات **افزایشی و بدون تخریب** هستند. نقطه تجمیع FCM و Web Push همان تابع `sendPushNotificationToUsers` است.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "6.1"],
      "description": "شروع موازی: پایه DB سرور و پیکربندی Capacitor"
    },
    {
      "wave": 2,
      "tasks": ["1.2", "6.2"],
      "description": "توابع DB و کانفیگ Capacitor"
    },
    {
      "wave": 3,
      "tasks": ["1.3", "2.1", "6.3", "7.1"],
      "description": "verify DB، وابستگی firebase-admin، verify config، manifest/permissions"
    },
    {
      "wave": 4,
      "tasks": ["2.2", "2.3", "7.2"],
      "description": "ماژول‌های FCM سرور و Gradle/Firebase اندروید"
    },
    {
      "wave": 5,
      "tasks": ["2.4", "3.1", "7.3", "8.1", "8.2"],
      "description": "verify FCM، فیلتر prefs، verify build، منابع آیکون/صدا"
    },
    {
      "wave": 6,
      "tasks": ["3.2", "8.3", "9.1"],
      "description": "تجمیع push+fcm، verify منابع، انتقال bridge"
    },
    {
      "wave": 7,
      "tasks": ["3.3", "9.2"],
      "description": "اتصال ماژول‌ها در سرور و تنظیم bridge"
    },
    {
      "wave": 8,
      "tasks": ["3.4", "4.1", "5.1", "9.3"],
      "description": "verify سرور، endpoint توکن، payload chatId، verify bridge"
    },
    {
      "wave": 9,
      "tasks": ["4.2", "5.2", "10.1"],
      "description": "verify endpoint، verify payload، API client web"
    },
    {
      "wave": 10,
      "tasks": ["10.2", "10.3", "11.1"],
      "description": "hook native bridge، گارد Web Push، gitignore/env"
    },
    {
      "wave": 11,
      "tasks": ["10.4", "11.2"],
      "description": "اتصال open-chat/logout و verify gitignore"
    },
    {
      "wave": 12,
      "tasks": ["10.5"],
      "description": "verify build و lint کلاینت"
    },
    {
      "wave": 13,
      "tasks": ["12.1", "12.2"],
      "description": "verification نهایی end-to-end (دستی)"
    }
  ]
}
```

مسیرها:
- **Track A (سرور):** 1 → 2 → 3 → 4, 5
- **Track B (اندروید):** 6 → 7 → 8 → 9 (موازی با Track A)
- **Web Client (10):** وابسته به endpointهای سرور (4) و رویدادهای bridge (9)
- **11 (gitignore/env):** هر زمان
- **12 (نهایی):** وابسته به همه‌چیز

## Tasks

- [x] 1. لایه پایگاه‌داده سرور: جدول و توابع device_tokens
- [x] 1.1 ساخت migration `043-device-tokens.js`
  - فایل `server/migrations/043-device-tokens.js` با جدول `device_tokens` (ستون‌های id, user_id, token UNIQUE, platform, created_at, updated_at) و ایندکس `idx_device_tokens_user` مطابق design
  - ثبت migration در `server/migrations/index.js` (import + افزودن به آرایه `migrations` بعد از 042)
  - _Requirements: 2.4_

- [x] 1.2 افزودن توابع DB برای device_tokens در `server/db.js`
  - `upsertDeviceToken(userId, token, platform)` با `ON CONFLICT(token) DO UPDATE` برای dedupe
  - `deleteDeviceToken(token)`
  - `listDeviceTokensByUserIds(userIds)` با فیلتر یکتا و placeholder امن
  - _Requirements: 2.4, 2.6, 2.7, 2.10, 2.11, 3.1, 8.6_

- [x] 1.3 verification گام ۱
  - اجرای `node --check server/db.js` و `node --check server/migrations/043-device-tokens.js`
  - اجرای سرور و تأیید ساخت جدول بدون خطای migration در لاگ استارت
  - _Requirements: 9.5, 10.4_

- [x] 2. ماژول‌های FCM سمت سرور
- [x] 2.1 افزودن وابستگی `firebase-admin` به `server/package.json`
  - افزودن `firebase-admin` با نسخه پین‌شده به dependencies و اجرای `npm install` در `server/`
  - _Requirements: 9.4_

- [x] 2.2 ساخت ماژول `server/lib/firebaseAdmin.js`
  - `createFirebaseAdmin({ readEnvString })` که `FIREBASE_SERVICE_ACCOUNT` را می‌خواند (مسیر فایل | base64 | inline JSON) و در صورت خطا یا نبود، بدون crash غیرفعال می‌شود
  - متدهای `isEnabled()` و `messaging()`
  - _Requirements: 3.2, 3.3, 9.4, 9.5_

- [x] 2.3 ساخت ماژول `server/lib/fcm.js`
  - `createFcmService({ firebaseAdmin, listDeviceTokensByUserIds, deleteDeviceToken })`
  - تابع `sendFcmToUsers(userIds, payload)` که notification message با `android.notification` (channelId `birdx_messages`, sound, color `#10b981`, icon `ic_notification`) و `data` (chatId/url/type) ارسال می‌کند
  - مدیریت خطا: حذف token در `registration-token-not-registered`، بلعیدن سایر خطاها و ادامه
  - _Requirements: 1.1, 1.3, 1.4, 2.11, 3.4, 3.6, 5.2_

- [x] 2.4 verification گام ۲
  - `node --check server/lib/firebaseAdmin.js` و `node --check server/lib/fcm.js`
  - اجرای سرور بدون `FIREBASE_SERVICE_ACCOUNT` و تأیید بالا آمدن بدون crash (`FCM_ENABLED=false`)
  - _Requirements: 3.3, 9.5_

- [x] 3. تجمیع FCM با Web Push و فیلتر prefs
- [x] 3.1 افزودن فیلتر prefs (notificationGate) به `server/lib/push.js`
  - تابع `filterNotifiableUserIds(userIds, { findUserById })` که کاربران با `notifications_paused` یا `dnd_until` فعال را حذف می‌کند
  - _Requirements: 8.1, 8.2_

- [x] 3.2 گسترش `createPushService` برای پشتیبانی از fcmService
  - افزودن پارامتر اختیاری `fcmService` و `findUserById`
  - اعمال `filterNotifiableUserIds` قبل از هر دو کانال در `sendPushNotificationToUsers`
  - فراخوانی `fcmService.sendFcmToUsers` به‌صورت مستقل با catch جداگانه (بعد از Web Push)
  - تضمین: اگر `fcmService` نباشد، رفتار دقیقاً مثل قبل (سازگاری)
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 8.1, 8.2, 10.1, 10.2_

- [x] 3.3 اتصال ماژول‌ها در `server/index.js`
  - import و ساخت `firebaseAdmin` و `fcmService`
  - تزریق `fcmService` و `findUserById` به `createPushService`
  - افزودن `upsertDeviceToken`, `deleteDeviceToken`, `listDeviceTokensByUserIds` به `apiDeps`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3.4 verification گام ۳
  - `node --check server/index.js` و `node --check server/lib/push.js`
  - اجرای سرور و تأیید کارکرد `/api/push/test` (Web Push) بدون رگرسیون
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 4. endpoint های ثبت/حذف device token
- [x] 4.1 افزودن روت‌های device-token به `server/api/push.js`
  - `POST /api/push/device-token`: auth + username match + `upsertDeviceToken`، خطای ۵۰۰ بدون retry در شکست ذخیره
  - `DELETE /api/push/device-token`: auth + username match + `deleteDeviceToken`
  - عدم تغییر روت‌های موجود `/api/push/*`
  - افزودن `upsertDeviceToken`, `deleteDeviceToken`, `findUserByUsername` به destructure deps
  - _Requirements: 2.4, 2.5, 2.9, 2.10, 8.4, 8.5, 10.3_

- [x] 4.2 verification گام ۴
  - `node --check server/api/push.js`
  - تست دستی: `POST /api/push/device-token` بدون session → ۴۰۱؛ با username نامتطابق → ۴۰۳؛ تست dedupe با ثبت دوباره همان token
  - _Requirements: 2.5, 2.6, 8.4, 8.5_

- [x] 5. افزودن chatId به payload نوتیفیکیشن پیام
- [x] 5.1 افزودن `data.chatId` در call siteهای push پیام و تماس
  - در `server/api/messages.js` (ارسال پیام و poll) و `server/index.js` (تماس)، افزودن `data: { url, chatId, type }` به payload `sendPushNotificationToUsers` بدون حذف `url` موجود
  - فیلتر mute موجود حفظ شود
  - _Requirements: 3.6, 7.1, 8.3_

- [x] 5.2 verification گام ۵
  - `node --check server/api/messages.js`
  - تأیید اینکه payload شامل هم `url` (برای Web Push) و هم `chatId` (برای FCM) است
  - _Requirements: 3.5, 3.6_

- [x] 6. پیکربندی Capacitor و وابستگی‌ها (Android)
- [x] 6.1 به‌روزرسانی `apps/mobile/package.json`
  - افزودن ۱۲ پلاگین Capacitor (app, browser, camera, filesystem, haptics, keyboard, local-notifications, network, preferences, push-notifications, share, badge) با نسخه‌های سازگار با Capacitor 7
  - اجرای `npm install` در `apps/mobile`
  - _Requirements: 2.1, 5.2_

- [x] 6.2 به‌روزرسانی `apps/mobile/capacitor.config.json`
  - افزودن کانفیگ `PushNotifications`, `LocalNotifications` (smallIcon `ic_notification`, iconColor `#10b981`), `Keyboard`, `Camera` و `android.handleBackButton: true`
  - _Requirements: 5.2, 5.3_

- [x] 6.3 verification گام ۶
  - بررسی صحت JSON `capacitor.config.json` و وجود پلاگین‌ها در `package.json`
  - _Requirements: 2.1_

- [x] 7. Manifest، permissions و Firebase Gradle (Android)
- [x] 7.1 به‌روزرسانی `AndroidManifest.xml`
  - افزودن permission های POST_NOTIFICATIONS, RECORD_AUDIO, CAMERA, VIBRATE (حفظ INTERNET)
  - افزودن meta-data پیش‌فرض FCM (channel `birdx_messages`, icon `ic_notification`, color `birdx_accent`)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.9_

- [x] 7.2 پیکربندی Gradle و Firebase
  - افزودن classpath `com.google.gms:google-services` به `android/build.gradle`
  - اعمال plugin و افزودن `firebase-messaging` در `android/app/build.gradle`
  - قراردادن `google-services.json` در `apps/mobile/android/app/`
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 7.3 verification گام ۷
  - اجرای `cap sync android` و سپس `gradlew assembleDebug` و تأیید موفقیت build با تنظیمات جدید
  - _Requirements: 4.6, 4.7, 4.8, 9.1, 9.2, 9.3_

- [x] 8. منابع آیکون، رنگ و صدا (Android)
- [x] 8.1 افزودن آیکون‌های launcher
  - کپی `mipmap-*/ic_launcher*.png` و `mipmap-anydpi-v26/ic_launcher.xml` به پروژه Capacitor
  - _Requirements: 5.1_

- [x] 8.2 افزودن آیکون نوتیفیکیشن، رنگ و صدا
  - افزودن `drawable/ic_notification` (monochrome سفید برای status bar)
  - افزودن `values/colors.xml` با `birdx_accent` = `#10b981`
  - افزودن `res/raw/notification_sound.mp3`
  - _Requirements: 5.2, 5.4, 5.5_

- [x] 8.3 verification گام ۸
  - اجرای مجدد `gradlew assembleDebug` و تأیید درج منابع بدون خطا
  - _Requirements: 5.1, 5.5_

- [x] 9. Native Bridge
- [x] 9.1 انتقال `native-bridge.js`
  - قراردادن `native-bridge.js` در `apps/mobile/www/` و نسخه‌ای در `client/public/` برای بارگذاری در WebView
  - بارگذاری شرطی در `client/index.html` (no-op خارج از native context)
  - _Requirements: 6.1, 6.8_

- [x] 9.2 تنظیم prompt و کانال در bridge
  - اطمینان از فراخوانی یک‌باره `PushNotifications.requestPermissions()` در اولین اجرای پس از احراز هویت (حتی اگر granted)
  - ساخت Notification_Channel `birdx_messages` با صدا/رنگ از طریق `LocalNotifications.createChannel`
  - انتشار رویدادهای `birdx:push-token` و `birdx:open-chat`
  - غیرفعال‌سازی مستقل install prompt و service worker
  - _Requirements: 2.1, 2.2, 2.7, 4.6, 4.7, 4.8, 5.3, 5.4, 6.5, 6.6, 7.1_

- [x] 9.3 verification گام ۹
  - بازبینی اجرای no-op در غیر native context (PWA/desktop دست‌نخورده)
  - _Requirements: 6.4, 10.5_

- [x] 10. یکپارچه‌سازی Web Client (React)
- [x] 10.1 افزودن توابع API به `client/src/api/chatApi.js`
  - `registerDeviceToken({ username, token, platform })` و `unregisterDeviceToken({ username, token })`
  - _Requirements: 2.3, 2.8_

- [x] 10.2 ساخت hook `client/src/hooks/useNativeBridge.js`
  - تشخیص `window.__BIRDX_NATIVE__`، listener برای `birdx:push-token` (→ register) و `birdx:open-chat` (→ navigate)
  - نگهداری token جاری برای استفاده در logout
  - _Requirements: 2.3, 6.2, 6.7, 7.2_

- [x] 10.3 گارد native context روی Web Push
  - در `client/src/hooks/chat/useChatNotifications.js`، early-return در توابع subscribe وقتی `window.__BIRDX_NATIVE__` است
  - _Requirements: 6.3, 6.4_

- [x] 10.4 اتصال hook و open-chat و logout در ChatPage/App
  - فراخوانی `useNativeBridge` و وصل کردن `onOpenChat` به مکانیزم `OPEN_CHAT_ID_KEY`
  - فراخوانی `unregisterDeviceToken` در مسیر logout وقتی native و token موجود است
  - مدیریت chatId نامعتبر → نمایش لیست چت‌ها
  - _Requirements: 2.8, 7.2, 7.3, 7.4_

- [x] 10.5 verification گام ۱۰
  - اجرای `npm --prefix client run lint` و `npm --prefix client run build` و تأیید موفقیت بدون error جدید
  - _Requirements: 10.5_

- [x] 11. پیکربندی محرمانه و gitignore
- [x] 11.1 افزودن مدخل‌های gitignore و مستندسازی env
  - افزودن `*service-account*.json` و فایل کلید Firebase به `.gitignore`
  - افزودن `FIREBASE_SERVICE_ACCOUNT` به `.env.example` با توضیح
  - _Requirements: 9.4, 9.6_

- [x] 11.2 verification گام ۱۱
  - اجرای `git check-ignore` روی فایل کلید نمونه و تأیید استثنا شدن
  - _Requirements: 9.6_

- [ ] 12. verification نهایی end-to-end
- [ ] 12.1 تست سرور با Firebase فعال
  - تنظیم `FIREBASE_SERVICE_ACCOUNT`، اجرای سرور، تست `/api/push/device-token` و یک ارسال آزمایشی
  - _Requirements: 1.1, 2.4, 3.2_
  - _verify-only_

- [ ] 12.2 تست end-to-end روی دستگاه
  - نصب APK، login، تأیید دریافت FCM token در سرور، بستن کامل اپ، ارسال پیام، مشاهده notification، لمس و باز شدن چت صحیح
  - تأیید عدم رگرسیون Web Push روی مرورگر/PWA
  - _Requirements: 1.1, 1.2, 7.1, 7.2, 10.1, 10.2_
  - _verify-only_

## Notes

- تسک‌های `verify-only` (12.1, 12.2) نیازمند اقدامات دستی کاربر هستند: ساخت Service Account key از Firebase Console، تنظیم env روی سرور، و نصب APK روی دستگاه واقعی.
- Track A (سرور: تسک‌های ۱ تا ۵) و Track B (اندروید: تسک‌های ۶ تا ۹) مستقل‌اند و می‌توانند موازی پیش بروند.
- هیچ تست خودکاری افزوده نمی‌شود (پروژه فریم‌ورک تست ندارد)؛ verification دستی است مطابق Testing Strategy در design.
- نقطه بازگشت (rollback): حذف `FIREBASE_SERVICE_ACCOUNT` کافی است تا سیستم به رفتار فقط-Web-Push برگردد.
