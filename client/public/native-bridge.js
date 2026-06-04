/**
 * BirdX Native Bridge
 * Connects the web app with native Capacitor plugins
 * This script is injected into the WebView to provide native capabilities
 */
(function () {
  'use strict';

  // Only run in Capacitor native context
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  const { Capacitor, CapacitorPlugins } = window;

  // Mark as native app so web app skips PWA-only features
  window.__BIRDX_NATIVE__ = true;
  // Override standalone detection
  Object.defineProperty(navigator, 'standalone', { value: true, writable: false });

  // --- Push Notifications ---
  async function initPushNotifications() {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Create the BirdX notification channel (sound/color) before registering.
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.createChannel({
          id: 'birdx_messages',
          name: 'Messages',
          description: 'BirdX message and call notifications',
          importance: 5,
          visibility: 1,
          sound: 'notification_sound.mp3',
          lights: true,
          lightColor: '#10b981',
          vibration: true
        });
      } catch (e) { /* channel creation best-effort */ }

      // Always request once after auth (R4.6): on Android, if already granted the
      // OS resolves immediately without showing the dialog again.
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === 'granted') {
        await PushNotifications.register();
      }

      PushNotifications.addListener('registration', (token) => {
        // Send FCM token to BirdX server
        window.dispatchEvent(new CustomEvent('birdx:push-token', {
          detail: { token: token.value }
        }));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        window.dispatchEvent(new CustomEvent('birdx:notification', {
          detail: notification
        }));
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data;
        if (data && data.chatId) {
          window.dispatchEvent(new CustomEvent('birdx:open-chat', {
            detail: { chatId: data.chatId }
          }));
        }
      });
    } catch (e) {
      console.warn('[BirdX] Push notifications not available:', e.message);
    }
  }

  // --- App Lifecycle & Back Button ---
  async function initAppLifecycle() {
    try {
      const { App } = await import('@capacitor/app');

      // Set status bar immersive
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#00000000' });
      } catch (e) { /* silent */ }

      App.addListener('backButton', ({ canGoBack }) => {
        // Let the web app handle back navigation first
        const event = new CustomEvent('birdx:back-button', {
          detail: { canGoBack },
          cancelable: true
        });
        const handled = !window.dispatchEvent(event);
        if (!handled && !canGoBack) {
          App.minimizeApp();
        }
      });

      App.addListener('appStateChange', ({ isActive }) => {
        window.dispatchEvent(new CustomEvent('birdx:app-state', {
          detail: { isActive }
        }));
      });

      App.addListener('appUrlOpen', ({ url }) => {
        window.dispatchEvent(new CustomEvent('birdx:deep-link', {
          detail: { url }
        }));
      });
    } catch (e) {
      console.warn('[BirdX] App plugin not available:', e.message);
    }
  }

  // --- Network Status ---
  async function initNetwork() {
    try {
      const { Network } = await import('@capacitor/network');

      Network.addListener('networkStatusChange', (status) => {
        window.dispatchEvent(new CustomEvent('birdx:network-change', {
          detail: status
        }));
        document.body.classList.toggle('offline', !status.connected);
      });

      const status = await Network.getStatus();
      document.body.classList.toggle('offline', !status.connected);
    } catch (e) {
      console.warn('[BirdX] Network plugin not available:', e.message);
    }
  }

  // --- Keyboard ---
  async function initKeyboard() {
    try {
      const { Keyboard } = await import('@capacitor/keyboard');

      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        document.body.classList.add('keyboard-open');
      });

      Keyboard.addListener('keyboardWillHide', () => {
        document.body.style.setProperty('--keyboard-height', '0px');
        document.body.classList.remove('keyboard-open');
      });
    } catch (e) {
      console.warn('[BirdX] Keyboard plugin not available:', e.message);
    }
  }

  // --- Expose Native API to Web App ---
  window.BirdXNative = {
    isNative: true,
    platform: Capacitor.getPlatform(),

    async haptic(type = 'medium') {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        const styles = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy
        };
        await Haptics.impact({ style: styles[type] || ImpactStyle.Medium });
      } catch (e) { /* silent */ }
    },

    async vibrate() {
      try {
        const { Haptics } = await import('@capacitor/haptics');
        await Haptics.vibrate({ duration: 100 });
      } catch (e) { /* silent */ }
    },

    async share(title, text, url) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title, text, url });
      } catch (e) { /* silent */ }
    },

    async setBadge(count) {
      try {
        const { Badge } = await import('@capawesome/capacitor-badge');
        if (count > 0) {
          await Badge.set({ count });
        } else {
          await Badge.clear();
        }
      } catch (e) { /* silent */ }
    },

    async takePicture() {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
          allowEditing: false,
          width: 1920,
          height: 1920
        });
        return photo;
      } catch (e) {
        return null;
      }
    },

    async pickFile() {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        // Use native file picker via input element (Capacitor handles it natively)
        return null;
      } catch (e) {
        return null;
      }
    },

    async secureStore(key, value) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: `secure_${key}`, value });
      } catch (e) { /* silent */ }
    },

    async secureGet(key) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key: `secure_${key}` });
        return value;
      } catch (e) {
        return null;
      }
    },

    async secureRemove(key) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key: `secure_${key}` });
      } catch (e) { /* silent */ }
    },

    async authenticateBiometric() {
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        await BiometricAuth.authenticate({
          reason: 'احراز هویت برای ورود به BirdX',
          cancelTitle: 'لغو',
          allowDeviceCredential: true
        });
        return true;
      } catch (e) {
        return false;
      }
    },

    async isBiometricAvailable() {
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const result = await BiometricAuth.checkBiometry();
        return result.isAvailable;
      } catch (e) {
        return false;
      }
    },

    async showLocalNotification(title, body, data = {}) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');

        // Request permission if needed
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') return;

        await LocalNotifications.schedule({
          notifications: [{
            title,
            body,
            id: Math.floor(Math.random() * 2147483647),
            extra: data,
            smallIcon: 'ic_notification',
            iconColor: '#10b981',
            channelId: 'birdx_messages',
            sound: 'notification_sound.mp3'
          }]
        });
      } catch (e) { /* silent */ }
    },

    async openInBrowser(url) {
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url });
      } catch (e) {
        window.open(url, '_blank');
      }
    }
  };

  // --- Initialize all native features ---
  async function init() {
    // Add native-app class to body for CSS enhancements
    document.body.classList.add('native-app');

    // Disable PWA install prompt in native context
    window.addEventListener('beforeinstallprompt', (e) => e.preventDefault());

    // Disable service worker in native (Capacitor handles caching)
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      registrations.forEach((reg) => reg.unregister());
    }

    // Set viewport meta for native
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }

    // Unlock orientation when video goes fullscreen
    document.addEventListener('fullscreenchange', function() {
      try {
        if (document.fullscreenElement) {
          // Video fullscreen → allow rotation
          screen.orientation.unlock();
        } else {
          // Exit fullscreen → lock to portrait
          screen.orientation.lock('portrait').catch(function() {});
        }
      } catch(e) { /* silent */ }
    });

    await Promise.allSettled([
      initPushNotifications(),
      initAppLifecycle(),
      initNetwork(),
      initKeyboard()
    ]);

    window.dispatchEvent(new Event('birdx:native-ready'));
    console.log('[BirdX] Native bridge initialized');
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
