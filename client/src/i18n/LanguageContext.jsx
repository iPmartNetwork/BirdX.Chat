import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export const LANGUAGE_STORAGE_KEY = "birdx-language";

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    htmlLang: "en",
  },
  {
    code: "fa",
    name: "Persian",
    nativeName: "فارسی",
    dir: "rtl",
    htmlLang: "fa",
  },
];

const TRANSLATIONS = {
  en: {
    "settings.profile": "Edit profile",
    "settings.security": "Security",
    "settings.data": "Data",
    "settings.language": "Language",
    "settings.savedMessages": "Saved messages",
    "settings.notifications": "Notifications",
    "settings.notifications.enable": "Enable notifications",
    "settings.notifications.testNotification": "Test notification",
    "settings.notifications.sent": "Sent",
    "settings.notifications.test": "Test",
    "settings.adminPanel": "Admin panel",
    "settings.whatsNew": "What's new",
    "settings.about": "About",
    "settings.logout": "Log out",
    "settings.lightMode": "Light mode",
    "settings.darkMode": "Dark mode",
    "settings.back": "Back",
    "settings.done": "Done",
    "settings.close": "Close",
    "settings.language.title": "Language",
    "settings.language.subtitle": "Choose the interface language and layout direction for this device.",
    "settings.language.current": "Current language",
    "settings.language.interface": "Interface language",
    "settings.language.english": "English",
    "settings.language.persian": "Persian",
    "settings.language.ltr": "Left to right",
    "settings.language.rtl": "Right to left",
    "settings.language.saved": "Saved on this device",
    "settings.language.note": "Messages still keep their own automatic text direction.",
    "settings.data.cachedSize": "Cached Size",
    "settings.data.chatEntries": "Chat entries",
    "settings.data.messageCache": "Message cache",
    "settings.data.mediaThumbnails": "Media thumbnails",
    "settings.data.videoPosters": "Video posters",
    "settings.data.voiceWaveforms": "Voice waveforms",
    "settings.data.clearCache": "Clear cache",
    "settings.data.clearTitle": "Clear cached data",
    "settings.data.clearDescription": "This only removes local cached data from this device. You'll need to reload to refresh the cache.",
    "settings.cancel": "Cancel",
    "settings.clear": "Clear",
    "settings.about.version": "App version",
    "settings.about.loading": "Loading...",
    "settings.about.unknown": "Unknown",
    "settings.about.checkUpdates": "Check for updates",
    "settings.about.supportProject": "Support the project",
    "settings.about.supportIntro": "If BirdX is useful to you, you can support ongoing development with these wallets:",
    "settings.about.checking": "Checking",
    "settings.about.failed": "Failed",
    "settings.about.updateAvailable": "Update available",
    "settings.about.upToDate": "Already up to date",
    "settings.about.check": "Check",
    "settings.about.rights": "All rights reserved. BirdX is a free and open-source project, licensed under the MIT License.",
    "settings.about.freedom": "For Freedom",
    "settings.about.copy": "Copy",
    "settings.about.copied": "Copied",
  },
  fa: {
    "settings.profile": "ویرایش پروفایل",
    "settings.security": "امنیت",
    "settings.data": "داده‌ها",
    "settings.language": "زبان",
    "settings.savedMessages": "پیام‌های ذخیره‌شده",
    "settings.notifications": "اعلان‌ها",
    "settings.notifications.enable": "فعال‌سازی اعلان‌ها",
    "settings.notifications.testNotification": "اعلان آزمایشی",
    "settings.notifications.sent": "ارسال شد",
    "settings.notifications.test": "تست",
    "settings.adminPanel": "پنل مدیریت",
    "settings.whatsNew": "تازه‌ها",
    "settings.about": "درباره",
    "settings.logout": "خروج",
    "settings.lightMode": "حالت روشن",
    "settings.darkMode": "حالت تاریک",
    "settings.back": "بازگشت",
    "settings.done": "تمام",
    "settings.close": "بستن",
    "settings.language.title": "زبان",
    "settings.language.subtitle": "زبان رابط کاربری و جهت نمایش این دستگاه را انتخاب کنید.",
    "settings.language.current": "زبان فعلی",
    "settings.language.interface": "زبان رابط کاربری",
    "settings.language.english": "انگلیسی",
    "settings.language.persian": "فارسی",
    "settings.language.ltr": "چپ به راست",
    "settings.language.rtl": "راست به چپ",
    "settings.language.saved": "روی همین دستگاه ذخیره می‌شود",
    "settings.language.note": "پیام‌ها همچنان جهت متن خودشان را به صورت خودکار حفظ می‌کنند.",
    "settings.data.cachedSize": "حجم کش",
    "settings.data.chatEntries": "فهرست چت‌ها",
    "settings.data.messageCache": "کش پیام‌ها",
    "settings.data.mediaThumbnails": "تصویرک‌های رسانه",
    "settings.data.videoPosters": "پوسترهای ویدیو",
    "settings.data.voiceWaveforms": "موج‌های صوتی",
    "settings.data.clearCache": "پاک‌کردن کش",
    "settings.data.clearTitle": "پاک‌کردن داده‌های کش‌شده",
    "settings.data.clearDescription": "این کار فقط داده‌های کش‌شده روی همین دستگاه را حذف می‌کند. برای تازه‌سازی کش باید صفحه را دوباره بارگذاری کنید.",
    "settings.cancel": "لغو",
    "settings.clear": "پاک‌کردن",
    "settings.about.version": "نسخه برنامه",
    "settings.about.loading": "در حال بارگذاری...",
    "settings.about.unknown": "نامشخص",
    "settings.about.checkUpdates": "بررسی بروزرسانی",
    "settings.about.supportProject": "حمایت از پروژه",
    "settings.about.supportIntro": "اگر BirdX برای شما مفید است، می‌توانید توسعه پروژه را با این کیف‌پول‌ها حمایت کنید:",
    "settings.about.checking": "در حال بررسی",
    "settings.about.failed": "ناموفق",
    "settings.about.updateAvailable": "بروزرسانی موجود است",
    "settings.about.upToDate": "بروز است",
    "settings.about.check": "بررسی",
    "settings.about.rights": "تمام حقوق محفوظ است. BirdX یک پروژه آزاد و متن‌باز با مجوز MIT است.",
    "settings.about.freedom": "برای آزادی",
    "settings.about.copy": "کپی",
    "settings.about.copied": "کپی شد",
  },
};

const LanguageContext = createContext(null);

function normalizeLanguage(code) {
  const normalized = String(code || "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.some((language) => language.code === normalized)
    ? normalized
    : "en";
}

function readStoredLanguage() {
  if (typeof window === "undefined") return "en";
  try {
    return normalizeLanguage(window.localStorage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const currentLanguage = useMemo(
    () =>
      SUPPORTED_LANGUAGES.find((item) => item.code === language) ||
      SUPPORTED_LANGUAGES[0],
    [language],
  );

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    try {
      window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures; the in-memory language still updates.
    }
  }, []);

  const t = useCallback(
    (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key,
    [language],
  );

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("lang", currentLanguage.htmlLang);
    root.setAttribute("dir", currentLanguage.dir);
    root.dataset.language = currentLanguage.code;
  }, [currentLanguage]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      direction: currentLanguage.dir,
      currentLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      isRtl: currentLanguage.dir === "rtl",
    }),
    [currentLanguage, language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return value;
}
