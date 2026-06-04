# Requirements Document

## Introduction

این سند نیازمندی‌های قابلیت **Mobile Push Notifications** را برای پروژه BirdX تعریف می‌کند. هدف اصلی این است که کاربر اپلیکیشن Android (Capacitor) حتی زمانی که اپ به‌طور کامل بسته است (closed/killed) یا در پس‌زمینه (background) قرار دارد، هنگام دریافت پیام یا تماس یک push notification دریافت کند.

برای رسیدن به این هدف، **Firebase Cloud Messaging (FCM)** به اپ بومی Android اضافه می‌شود و با سرور Express موجود یکپارچه می‌گردد. FCM در کنار سیستم Web Push (VAPID) فعلی قرار می‌گیرد و آن را جایگزین نمی‌کند: کاربران مرورگر/PWA همچنان از Web Push استفاده می‌کنند و اپ بومی Android از FCM استفاده می‌کند.

این قابلیت شامل مهاجرت دارایی‌های آماده‌شده از پوشه work2 (شامل اسکریپت `native-bridge.js`، آیکون‌ها، `google-services.json`، و فایل‌های پیکربندی Capacitor) و افزودن یکپارچه‌سازی سمت سرور (Firebase Admin SDK)، سمت کلاینت وب (تشخیص native context و ارسال FCM token)، و سمت Android (permissions، manifest، Gradle) است.

محدوده اصلی روی هدف «دریافت notification هنگام بسته بودن اپ» و یکپارچه‌سازی بومی پشتیبان آن متمرکز است. آیکون‌ها و سایر قابلیت‌های گسترده‌تر native bridge (badge، haptics، biometric و غیره) بخشی از مهاجرت هستند اما نسبت به notifications در اولویت دوم قرار دارند.

## Glossary

- **Native_App**: اپلیکیشن Android مبتنی بر Capacitor در مسیر `apps/mobile` که یک WebView است و `https://app.birdx.chat` را بارگذاری می‌کند. شناسه بسته (package / appId): `chat.birdx.app`.
- **Web_Client**: اپلیکیشن React (در مسیر `client/`) که هم به‌صورت PWA در مرورگر و هم درون WebView اپ بومی اجرا می‌شود.
- **Server**: سرور Node.js + Express در مسیر `server/` که شامل Socket.IO و پایگاه‌داده SQLite (از طریق sql.js) است.
- **Native_Bridge**: اسکریپت `native-bridge.js` که در مسیر `apps/mobile/www/` قرار می‌گیرد و درون WebView تزریق می‌شود؛ پلاگین‌های Capacitor را مقداردهی اولیه می‌کند، رویدادهای DOM CustomEvent را منتشر می‌کند و API `window.BirdXNative` را در اختیار می‌گذارد.
- **FCM**: Firebase Cloud Messaging، سرویس ارسال پیام push گوگل برای دستگاه‌های بومی.
- **FCM_Token**: توکن ثبت دستگاه (device registration token) که توسط FCM به هر نصب اپ بومی اختصاص داده می‌شود.
- **Web_Push**: سامانه فعلی push مبتنی بر VAPID که برای مرورگر و PWA استفاده می‌شود و در `server/lib/push.js` و `server/api/push.js` پیاده‌سازی شده است.
- **Firebase_Admin_SDK**: کتابخانه سمت سرور Firebase که Server برای ارسال پیام‌های FCM از آن استفاده می‌کند.
- **Service_Account_Key**: اعتبارنامه (credential) حساب سرویس Firebase که Firebase_Admin_SDK برای احراز هویت با FCM به آن نیاز دارد.
- **POST_NOTIFICATIONS**: مجوز زمان‌اجرا (runtime permission) در Android نسخه ۱۳ و بالاتر (API 33+) که برای نمایش notification لازم است.
- **Notification_Channel**: کانال اعلان Android با شناسه `birdx_messages` که صدا، رنگ و رفتار notification را تعیین می‌کند.
- **DND**: حالت Do Not Disturb کاربر که از طریق ستون `dnd_until` در جدول `users` نگهداری می‌شود.
- **Notifications_Paused**: وضعیت توقف اعلان‌های کاربر که از طریق ستون `notifications_paused` در جدول `users` نگهداری می‌شود.
- **Native_Context_Flag**: متغیر سراسری `window.__BIRDX_NATIVE__` (به همراه وجود `window.BirdXNative`) که نشان می‌دهد Web_Client درون Native_App اجرا می‌شود.
- **Open_Chat_Event**: رویداد `birdx:open-chat` که توسط Native_Bridge هنگام لمس یک notification منتشر می‌شود و شناسه چت هدف را حمل می‌کند.
- **Device_Token_Store**: محل ذخیره‌سازی FCM_Token ها در پایگاه‌داده، جدا از جدول `push_subscriptions` مربوط به Web_Push.

## Requirements

### Requirement 1: دریافت Notification هنگام بسته یا پس‌زمینه بودن اپ

**User Story:** به‌عنوان یک کاربر اپ Android، می‌خواهم حتی وقتی اپ کاملاً بسته است یا در پس‌زمینه قرار دارد، هنگام دریافت پیام یک notification دریافت کنم، تا از پیام‌های جدید مطلع شوم بدون آنکه اپ باز باشد.

#### Acceptance Criteria

1. WHEN یک پیام برای یک کاربر گیرنده‌ای که Native_App او بسته یا در پس‌زمینه است ارسال می‌شود AND یک FCM_Token معتبر برای آن کاربر ثبت شده است، THE Server SHALL یک پیام FCM از طریق Firebase_Admin_SDK به آن FCM_Token ارسال کند.
2. WHEN FCM یک پیام را در حالی که Native_App بسته یا در پس‌زمینه است تحویل می‌دهد، THE Native_App SHALL یک system notification با عنوان و متن دریافتی نمایش دهد.
3. THE FCM SHALL پیام‌ها را به‌صورت notification message با کلید `notification` ارسال کند تا تحویل notification در حالت بسته بودن اپ توسط سیستم‌عامل Android تضمین شود.
4. WHEN یک تماس صوتی یا تصویری برای کاربری که Native_App او بسته یا در پس‌زمینه است آغاز می‌شود AND یک FCM_Token معتبر برای آن کاربر ثبت شده است، THE Server SHALL یک پیام FCM برای اطلاع‌رسانی تماس به آن FCM_Token ارسال کند.
5. IF ارسال پیام FCM مربوط به یک تماس با خطا مواجه شود، THEN THE Server SHALL هم خطا را ثبت کند AND هم به ادامه کار (بدون تضمین تحویل آن notification تماس) بپردازد؛ هر دو عمل الزامی هستند.

### Requirement 2: ثبت و چرخه حیات FCM Device Token

**User Story:** به‌عنوان یک کاربر اپ Android، می‌خواهم دستگاه من به‌طور خودکار برای دریافت notification ثبت شود و این ثبت با ورود و خروج من هماهنگ بماند، تا notification ها فقط به دستگاه‌های مجاز و فعال ارسال شوند.

#### Acceptance Criteria

1. WHEN Native_App راه‌اندازی می‌شود AND کاربر احراز هویت شده است، THE Native_Bridge SHALL پلاگین `@capacitor/push-notifications` را مقداردهی اولیه کند و یک FCM_Token درخواست کند.
2. WHEN یک FCM_Token جدید توسط `@capacitor/push-notifications` دریافت می‌شود، THE Native_Bridge SHALL یک رویداد DOM CustomEvent با نام `birdx:push-token` حاوی مقدار توکن منتشر کند.
3. WHEN Web_Client رویداد `birdx:push-token` را دریافت می‌کند AND کاربر احراز هویت شده است، THE Web_Client SHALL مقدار FCM_Token را به endpoint ثبت توکن سرور ارسال کند.
4. WHEN Server یک درخواست ثبت FCM_Token معتبر دریافت می‌کند، THE Server SHALL آن FCM_Token را در Device_Token_Store به همراه شناسه کاربر احراز هویت‌شده ذخیره کند.
5. IF عملیات ذخیره‌سازی FCM_Token در Device_Token_Store با خطا مواجه شود، THEN THE Server SHALL یک پاسخ خطا به Web_Client بازگرداند AND عملیات ذخیره را مجدداً retry نکند.
6. IF یک FCM_Token دریافتی از قبل در Device_Token_Store موجود است، THEN THE Server SHALL رکورد موجود را به‌روزرسانی کند به‌جای ایجاد رکورد تکراری، تا برای هر دستگاه فقط یک رکورد نگهداری شود.
7. IF به‌روزرسانی رکورد یک FCM_Token موجود با خطا مواجه شود، THEN THE Server SHALL یک رکورد جدید برای آن FCM_Token ایجاد کند.
8. WHEN FCM یک FCM_Token را تازه‌سازی (refresh) می‌کند، THE Native_Bridge SHALL رویداد `birdx:push-token` را با مقدار توکن جدید منتشر کند تا Server رکورد را به‌روزرسانی کند.
9. WHEN کاربر از Native_App خارج می‌شود (logout)، THE Web_Client SHALL درخواست حذف FCM_Token مربوط به آن دستگاه را به Server ارسال کند.
10. WHEN Server یک درخواست حذف FCM_Token معتبر دریافت می‌کند، THE Server SHALL آن FCM_Token را از Device_Token_Store حذف کند.
11. IF Server هنگام ارسال یک پیام FCM پاسخ خطای توکن نامعتبر یا منقضی (`messaging/registration-token-not-registered`) دریافت کند، THEN THE Server SHALL آن FCM_Token را از Device_Token_Store حذف کند.

### Requirement 3: ارسال FCM سمت سرور و همزیستی با Web Push

**User Story:** به‌عنوان توسعه‌دهنده، می‌خواهم جریان اطلاع‌رسانی موجود سرور هم Web Push و هم FCM را فعال کند، تا کاربران مرورگر و کاربران اپ بومی هر دو notification دریافت کنند بدون اینکه یکی دیگری را مختل کند.

#### Acceptance Criteria

1. WHEN تابع `sendPushNotificationToUsers(userIds, payload)` فراخوانی می‌شود، THE Server SHALL هم به subscription های Web_Push (در جدول `push_subscriptions`) و هم به FCM_Token های موجود (در Device_Token_Store) برای کاربران هدف ارسال کند.
2. WHERE یک کاربر هدف هم subscription فعال Web_Push و هم FCM_Token فعال دارد، THE Server SHALL notification را به‌صورت همزمان از طریق هر دو مسیر (Web_Push و FCM) ارسال کند بدون اولویت‌دادن یکی بر دیگری.
3. WHERE Service_Account_Key پیکربندی شده است، THE Server SHALL Firebase_Admin_SDK را مقداردهی اولیه کند و ارسال FCM را فعال نماید.
4. WHERE Service_Account_Key پیکربندی نشده است، THE Server SHALL ارسال FCM را غیرفعال کند و فقط Web_Push را اجرا کند.
5. IF ارسال یک پیام FCM با خطا مواجه شود، THEN THE Server SHALL خطا را مدیریت کند و به ارسال سایر notification ها (شامل Web_Push) ادامه دهد.
6. THE Server SHALL محتوای payload یکسانی (عنوان، متن، و داده مسیریابی چت) را برای هر دو مسیر Web_Push و FCM استفاده کند.
7. WHEN یک پیام FCM برای باز کردن یک چت مشخص ارسال می‌شود، THE Server SHALL شناسه چت هدف را در بخش `data` پیام FCM قرار دهد.

### Requirement 4: مجوزها و Manifest در Android

**User Story:** به‌عنوان یک کاربر اپ Android، می‌خواهم اپ مجوزهای لازم برای نمایش notification و انجام تماس را داشته باشد، تا notification ها نمایش داده شوند و تماس‌های صوتی و تصویری کار کنند.

#### Acceptance Criteria

1. THE Native_App SHALL مجوز `android.permission.POST_NOTIFICATIONS` را در `AndroidManifest.xml` اعلام کند.
2. THE Native_App SHALL مجوز `android.permission.RECORD_AUDIO` را در `AndroidManifest.xml` اعلام کند.
3. THE Native_App SHALL مجوز `android.permission.CAMERA` را در `AndroidManifest.xml` اعلام کند.
4. THE Native_App SHALL مجوز `android.permission.VIBRATE` را در `AndroidManifest.xml` اعلام کند.
5. THE Native_App SHALL سرویس Firebase Messaging مورد نیاز FCM را در `AndroidManifest.xml` اعلام کند.
6. WHEN Native_App روی Android نسخه ۱۳ (API 33) یا بالاتر برای اولین بار پس از احراز هویت اجرا می‌شود، THE Native_App SHALL درخواست زمان‌اجرای POST_NOTIFICATIONS را یک بار به کاربر نمایش دهد، حتی اگر این مجوز قبلاً اعطا شده باشد.
7. IF درخواست زمان‌اجرای POST_NOTIFICATIONS در اولین اجرا پس از احراز هویت نمایش داده نشود، THEN THE Native_App SHALL در اجراهای بعدی آن درخواست را به‌صورت خودکار تکرار نکند.
8. IF کاربر مجوز POST_NOTIFICATIONS را رد کند، THEN THE Native_App SHALL بدون crash به کار ادامه دهد و از تلاش برای نمایش system notification خودداری کند.
9. THE Native_App SHALL مجوز `android.permission.INTERNET` موجود را حفظ کند.

### Requirement 5: آیکون‌های اپ و اعلان و Notification Channel

**User Story:** به‌عنوان یک کاربر اپ Android، می‌خواهم اپ و notification ها آیکون، رنگ و صدای صحیح برند BirdX را داشته باشند، تا notification ها قابل تشخیص و حرفه‌ای به نظر برسند.

#### Acceptance Criteria

1. THE Native_App SHALL آیکون‌های launcher اپ (منابع `mipmap-*/ic_launcher*.png` و XML آیکون adaptive) را در پروژه Android شامل شود.
2. THE Native_Bridge SHALL پلاگین `@capacitor/local-notifications` را با آیکون کوچک (smallIcon) `ic_notification` و رنگ `#10b981` پیکربندی کند.
3. THE Native_Bridge SHALL یک Notification_Channel با شناسه `birdx_messages` ایجاد کند.
4. THE Notification_Channel SHALL از فایل صدای `notification_sound.mp3` برای صدای اعلان استفاده کند.
5. THE Native_App SHALL منبع drawable با نام `ic_notification` را برای استفاده به‌عنوان آیکون status bar اعلان شامل شود.

### Requirement 6: یکپارچه‌سازی Native Bridge و تشخیص Native Context

**User Story:** به‌عنوان توسعه‌دهنده، می‌خواهم Web_Client تشخیص دهد که درون اپ بومی اجرا می‌شود و به رویدادهای bridge پاسخ دهد، تا منطق بومی فقط در context صحیح فعال شود و با رفتار PWA تداخل نکند.

#### Acceptance Criteria

1. THE Native_Bridge SHALL متغیر `window.__BIRDX_NATIVE__` را برابر `true` قرار دهد و API `window.BirdXNative` را در WebView در دسترس کند.
2. WHEN Web_Client بارگذاری می‌شود، THE Web_Client SHALL با بررسی `window.__BIRDX_NATIVE__` و وجود `window.BirdXNative` تشخیص دهد که درون Native_App اجرا می‌شود.
3. WHILE Web_Client درون Native_App اجرا می‌شود، THE Web_Client SHALL از مسیر ثبت Web_Push (service worker / VAPID) استفاده نکند و به‌جای آن از مسیر ثبت FCM_Token استفاده کند.
4. WHILE Web_Client به‌صورت PWA مستقل و خارج از Native_App اجرا می‌شود، THE Web_Client SHALL از مسیر FCM_Token استفاده نکند و فقط از مسیر Web_Push استفاده کند.
5. WHILE Web_Client درون Native_App اجرا می‌شود، THE Native_Bridge SHALL درخواست نصب PWA (install prompt) و ثبت service worker را به‌عنوان دو مکانیزم مستقل غیرفعال کند.
6. IF غیرفعال‌سازی هر یک از دو مکانیزم (install prompt یا service worker) با خطا مواجه شود، THEN THE Native_Bridge SHALL غیرفعال‌سازی مکانیزم دیگر را مستقل از آن ادامه دهد.
7. WHEN Web_Client درون Native_App اجرا می‌شود، THE Web_Client SHALL برای رویدادهای DOM CustomEvent منتشرشده توسط Native_Bridge (شامل `birdx:open-chat` و `birdx:back-button`) listener ثبت کند.
8. THE Native_Bridge SHALL در مسیر `apps/mobile/www/` قرار گیرد.

### Requirement 7: باز شدن چت صحیح با لمس Notification

**User Story:** به‌عنوان یک کاربر اپ Android، می‌خواهم با لمس یک notification، اپ باز شود و مستقیماً چت مربوط به آن notification را نشان دهد، تا سریع به مکالمه دسترسی پیدا کنم.

#### Acceptance Criteria

1. WHEN کاربر یک notification مربوط به یک چت را لمس می‌کند، THE Native_Bridge SHALL رویداد Open_Chat_Event (`birdx:open-chat`) حاوی شناسه چت هدف را منتشر کند.
2. WHEN Web_Client رویداد Open_Chat_Event را دریافت می‌کند، THE Web_Client SHALL به نمای چت با همان شناسه چت هدایت کند.
3. IF Open_Chat_Event در حالی دریافت شود که Native_App تازه از حالت بسته راه‌اندازی شده است، THEN THE Web_Client SHALL پس از کامل شدن احراز هویت و بارگذاری اولیه، به چت هدف هدایت کند.
4. IF شناسه چت موجود در Open_Chat_Event نامعتبر یا غیرقابل دسترس برای کاربر باشد، THEN THE Web_Client SHALL نمای پیش‌فرض (لیست چت‌ها) را نمایش دهد.

### Requirement 8: حریم خصوصی و امنیت Notification

**User Story:** به‌عنوان یک کاربر، می‌خواهم تنظیمات اعلان من (DND و توقف اعلان) در notification های بومی نیز رعایت شود و توکن‌ها به نشست احراز هویت‌شده من گره بخورند، تا کنترل و امنیت اعلان‌ها حفظ شود.

#### Acceptance Criteria

1. WHILE حالت DND یک کاربر فعال است (مقدار `dnd_until` در آینده است)، THE Server SHALL از ارسال پیام FCM به آن کاربر خودداری کند.
2. WHILE وضعیت Notifications_Paused یک کاربر فعال است، THE Server SHALL از ارسال پیام FCM به آن کاربر خودداری کند.
3. WHEN کاربر یک چت را mute کرده است، THE Server SHALL از ارسال پیام FCM مربوط به آن چت به آن کاربر خودداری کند.
4. WHEN Server یک درخواست ثبت یا حذف FCM_Token دریافت می‌کند، THE Server SHALL یک نشست احراز هویت‌شده معتبر را الزام کند.
5. IF نام کاربری ارائه‌شده در درخواست ثبت یا حذف توکن با نشست احراز هویت‌شده مطابقت نداشته باشد، THEN THE Server SHALL درخواست را همواره با خطای مجوز رد کند، و در صورت بروز خطا در تولید پاسخ خطای مجوز، THE Server SHALL از یک مکانیزم رد پیش‌فرض (fallback) برای رد درخواست استفاده کند.
6. THE Server SHALL هر FCM_Token را تنها به شناسه کاربر احراز هویت‌شده‌ای که آن را ثبت کرده است مرتبط کند.

### Requirement 9: پیکربندی Firebase و اعتبارنامه‌های سرور

**User Story:** به‌عنوان توسعه‌دهنده، می‌خواهم پیکربندی Firebase به‌درستی در پروژه قرار گیرد و اعتبارنامه‌های حساس سرور از طریق متغیرهای محیطی مدیریت شوند و در git ذخیره نشوند، تا ساخت اپ کار کند و اسرار افشا نشوند.

#### Acceptance Criteria

1. THE Native_App SHALL فایل `google-services.json` مربوط به پروژه Firebase (project_id `birdx-a0c02`، package `chat.birdx.app`) را در مسیر صحیح ماژول Android (`apps/mobile/android/app/`) شامل شود.
2. THE Android project SHALL پلاگین Gradle با نام `google-services` را اعمال کند، و این پلاگین SHALL حتی در صورت نبود فایل پیکربندی (`google-services.json`) بدون شکست build اعمال شود.
3. THE Android project SHALL وابستگی `firebase-messaging` را در پیکربندی Gradle شامل شود.
4. THE Server SHALL Service_Account_Key را از یک متغیر محیطی (environment variable) بخواند.
5. WHERE متغیر محیطی Service_Account_Key تنظیم نشده است، THE Server SHALL بدون crash راه‌اندازی شود و فقط Web_Push را فعال نگه دارد.
6. THE project SHALL فایل Service_Account_Key را از طریق `.gitignore` از کنترل نسخه (git) مستثنی کند تا commit نشود.
7. THE Web_Client SHALL پیکربندی FCM مورد نیاز سمت کلاینت (project_number `337205810249`) را برای ثبت توکن استفاده کند.

### Requirement 10: سازگاری با گذشته (Backward Compatibility)

**User Story:** به‌عنوان یک کاربر موجود مرورگر یا دسکتاپ، می‌خواهم notification های Web Push من بدون تغییر کار کنند، تا افزودن FCM تجربه فعلی من را مختل نکند.

#### Acceptance Criteria

1. WHEN یک کاربر از طریق مرورگر یا PWA (خارج از Native_App) به سیستم متصل است، THE Web_Client SHALL همچنان مسیر ثبت Web_Push مبتنی بر VAPID و service worker را اجرا کند.
2. WHEN یک پیام برای کاربری با subscription فعال Web_Push ارسال می‌شود، THE Server SHALL همچنان notification را از طریق Web_Push ارسال کند صرف‌نظر از اینکه FCM فعال است یا خیر.
3. THE Server SHALL endpoint های موجود `/api/push/subscribe`، `/api/push/unsubscribe`، `/api/push/public-key` و `/api/push/test` را بدون تغییر در رفتار فعلی حفظ کند، و SHALL تضمین کند تا زمانی که subscription فعالی وجود دارد، حداقل یکی از این endpoint ها عملیاتی باقی بماند.
4. THE Server SHALL جدول `push_subscriptions` و منطق Web_Push موجود را بدون تغییر در ساختار فعلی حفظ کند.
5. WHEN اپ دسکتاپ (Electron) اجرا می‌شود، THE Web_Client SHALL رفتار اعلان فعلی خود را بدون تأثیر از تغییرات FCM حفظ کند.
