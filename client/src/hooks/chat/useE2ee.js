/**
 * useE2ee Hook
 *
 * Provides E2EE state and operations for the chat page.
 * Handles key initialization, session management, and message encryption/decryption.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initializeE2ee,
  encryptForPeer,
  decryptFromPeer,
  isE2eeMessage,
  isE2eeInitialized,
  checkPeerE2ee,
  replenishPreKeysIfNeeded,
} from "../../utils/e2ee/index.js";

export function useE2ee({ user, activeChatId, chats }) {
  const [e2eeEnabled, setE2eeEnabled] = useState(false);
  const [e2eeInitializing, setE2eeInitializing] = useState(false);
  const [peerE2eeSupported, setPeerE2eeSupported] = useState(false);
  const [e2eeError, setE2eeError] = useState("");
  const peerE2eeCacheRef = useRef(new Map());
  const replenishTimerRef = useRef(null);

  const userId = Number(user?.id || 0);
  const username = String(user?.username || "");

  // Check if current user has E2EE initialized
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    isE2eeInitialized(userId).then((initialized) => {
      if (!cancelled) setE2eeEnabled(initialized);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Check if the active DM peer supports E2EE
  useEffect(() => {
    if (!activeChatId || !userId) {
      setPeerE2eeSupported(false);
      return;
    }

    const activeChat = chats.find((c) => Number(c?.id) === Number(activeChatId));
    if (!activeChat || String(activeChat.type || "").toLowerCase() !== "dm") {
      setPeerE2eeSupported(false);
      return;
    }

    const peerMember = (activeChat.members || []).find(
      (m) => Number(m?.id) !== userId,
    );
    const peerUserId = Number(peerMember?.id || 0);
    if (!peerUserId) {
      setPeerE2eeSupported(false);
      return;
    }

    // Check cache first
    const cached = peerE2eeCacheRef.current.get(peerUserId);
    if (cached !== undefined) {
      setPeerE2eeSupported(cached);
      return;
    }

    let cancelled = false;
    checkPeerE2ee(peerUserId).then((supported) => {
      if (cancelled) return;
      peerE2eeCacheRef.current.set(peerUserId, supported);
      setPeerE2eeSupported(supported);
    }).catch(() => {
      if (!cancelled) setPeerE2eeSupported(false);
    });

    return () => { cancelled = true; };
  }, [activeChatId, chats, userId]);

  // Periodically replenish prekeys
  useEffect(() => {
    if (!e2eeEnabled || !userId || !username) return;
    const replenish = () => {
      replenishPreKeysIfNeeded(userId, username).catch(() => {});
    };
    replenish();
    replenishTimerRef.current = window.setInterval(replenish, 5 * 60 * 1000);
    return () => {
      if (replenishTimerRef.current) {
        window.clearInterval(replenishTimerRef.current);
      }
    };
  }, [e2eeEnabled, userId, username]);

  // Initialize E2EE for the current user
  const enableE2ee = useCallback(async () => {
    if (!userId || !username) return;
    setE2eeInitializing(true);
    setE2eeError("");
    try {
      await initializeE2ee(userId, username);
      setE2eeEnabled(true);
    } catch (error) {
      setE2eeError(error?.message || "Failed to enable E2EE");
      console.error("[e2ee] initialization failed:", error);
    } finally {
      setE2eeInitializing(false);
    }
  }, [userId, username]);

  // Encrypt a message body before sending
  const encryptMessageBody = useCallback(async (peerUserId, plaintext) => {
    if (!userId || !peerUserId || !plaintext) return plaintext;
    try {
      return await encryptForPeer(userId, peerUserId, plaintext);
    } catch (error) {
      console.warn("[e2ee] encryption failed, sending plaintext:", error);
      return plaintext;
    }
  }, [userId]);

  // Decrypt a message body after receiving
  const decryptMessageBody = useCallback(async (peerUserId, encryptedBody) => {
    if (!userId || !peerUserId || !isE2eeMessage(encryptedBody)) {
      return encryptedBody;
    }
    try {
      return await decryptFromPeer(userId, peerUserId, encryptedBody);
    } catch (error) {
      console.warn("[e2ee] decryption failed:", error);
      return "🔒 Unable to decrypt message";
    }
  }, [userId]);

  // Decrypt an array of messages
  const decryptMessages = useCallback(async (messages, peerUserId) => {
    if (!userId || !peerUserId || !Array.isArray(messages)) return messages;

    const results = await Promise.all(
      messages.map(async (msg) => {
        if (!isE2eeMessage(msg?.body)) return msg;
        const decrypted = await decryptMessageBody(peerUserId, msg.body);
        return { ...msg, body: decrypted, _e2ee: true };
      }),
    );
    return results;
  }, [userId, decryptMessageBody]);

  // Get the peer user ID for the active DM chat
  const getActivePeerUserId = useCallback(() => {
    if (!activeChatId || !userId) return null;
    const activeChat = chats.find((c) => Number(c?.id) === Number(activeChatId));
    if (!activeChat || String(activeChat.type || "").toLowerCase() !== "dm") return null;
    const peerMember = (activeChat.members || []).find(
      (m) => Number(m?.id) !== userId,
    );
    return Number(peerMember?.id || 0) || null;
  }, [activeChatId, chats, userId]);

  // Check if E2EE should be used for the current chat
  const shouldUseE2ee = e2eeEnabled && peerE2eeSupported;

  return {
    e2eeEnabled,
    e2eeInitializing,
    e2eeError,
    peerE2eeSupported,
    shouldUseE2ee,
    enableE2ee,
    encryptMessageBody,
    decryptMessageBody,
    decryptMessages,
    getActivePeerUserId,
    isE2eeMessage,
  };
}
