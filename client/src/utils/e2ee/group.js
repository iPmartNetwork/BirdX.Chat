import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decryptMessage,
  encryptMessage,
} from "./crypto.js";

export const GROUP_E2EE_PREFIX = "🔒ge2ee:";

const groupKeyCache = new Map();

export function isGroupE2eeMessage(body) {
  return String(body || "").startsWith(GROUP_E2EE_PREFIX);
}

export async function generateGroupKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportGroupKeyRaw(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

export async function importGroupKeyRaw(base64) {
  const raw = base64ToArrayBuffer(String(base64 || ""));
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export function cacheGroupKey(chatId, key) {
  groupKeyCache.set(Number(chatId), key);
}

export function getCachedGroupKey(chatId) {
  return groupKeyCache.get(Number(chatId)) || null;
}

export function clearCachedGroupKey(chatId) {
  groupKeyCache.delete(Number(chatId));
}

export async function encryptGroupMessage(chatId, plaintext) {
  const key = getCachedGroupKey(chatId);
  if (!key) {
    throw new Error("Group encryption key is not ready on this device.");
  }
  const encrypted = await encryptMessage(key, plaintext);
  return `${GROUP_E2EE_PREFIX}${encrypted}`;
}

export async function decryptGroupMessage(chatId, body) {
  if (!isGroupE2eeMessage(body)) return body;
  const key = getCachedGroupKey(chatId);
  if (!key) {
    throw new Error("Group encryption key is not ready on this device.");
  }
  const payload = String(body).slice(GROUP_E2EE_PREFIX.length);
  return decryptMessage(key, payload);
}
