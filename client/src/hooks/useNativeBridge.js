import { useCallback, useEffect, useRef } from "react";
import { registerDeviceToken, unregisterDeviceToken } from "../api/chatApi.js";

/**
 * Detects the native (Capacitor) context exposed by native-bridge.js and wires
 * the bridge's DOM CustomEvents into the React app:
 *  - `birdx:push-token`  → register the FCM token with the server
 *  - `birdx:open-chat`   → navigate to the target chat (notification tap)
 *
 * Outside the native app this hook is effectively a no-op so the PWA/desktop
 * behavior is unchanged.
 *
 * @param {object} params
 * @param {object|null} params.user            current authenticated user
 * @param {(chatId: number) => void} [params.onOpenChat]  open-chat handler
 */
export function useNativeBridge({ user, onOpenChat } = {}) {
  const isNative =
    typeof window !== "undefined" && window.__BIRDX_NATIVE__ === true;

  // Keep the latest FCM token so we can unregister it on logout.
  const currentTokenRef = useRef(null);
  const onOpenChatRef = useRef(onOpenChat);
  useEffect(() => {
    onOpenChatRef.current = onOpenChat;
  }, [onOpenChat]);

  // Register the FCM token when the bridge reports one (R2.3).
  useEffect(() => {
    if (!isNative || !user?.username) return undefined;
    const handler = (event) => {
      const token = event?.detail?.token;
      if (!token) return;
      currentTokenRef.current = token;
      registerDeviceToken({ username: user.username, token }).catch(() => {
        // best-effort; bridge will re-emit on next launch / refresh
      });
    };
    window.addEventListener("birdx:push-token", handler);
    return () => window.removeEventListener("birdx:push-token", handler);
  }, [isNative, user?.username]);

  // Open the target chat when a notification is tapped (R7.2).
  useEffect(() => {
    if (!isNative) return undefined;
    const handler = (event) => {
      const chatId = Number(event?.detail?.chatId || 0);
      if (chatId > 0) {
        onOpenChatRef.current?.(chatId);
      }
    };
    window.addEventListener("birdx:open-chat", handler);
    return () => window.removeEventListener("birdx:open-chat", handler);
  }, [isNative]);

  // Called from the logout flow to detach this device's token (R2.8).
  const unregisterCurrentDeviceToken = useCallback(
    async (username) => {
      const token = currentTokenRef.current;
      const name = username || user?.username;
      if (!isNative || !token || !name) return;
      try {
        await unregisterDeviceToken({ username: name, token });
      } catch {
        // ignore unregister failures
      } finally {
        currentTokenRef.current = null;
      }
    },
    [isNative, user?.username],
  );

  return { isNative, unregisterCurrentDeviceToken };
}
