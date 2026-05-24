/**
 * BirdX E2EE Key Store
 *
 * Manages local storage of E2EE keys in IndexedDB.
 * Private keys never leave this store (except as encrypted exports).
 */

const DB_NAME = "birdx-e2ee-keys";
const DB_VERSION = 1;
const STORE_IDENTITY = "identity";
const STORE_SIGNED_PREKEYS = "signedPreKeys";
const STORE_ONE_TIME_PREKEYS = "oneTimePreKeys";
const STORE_SESSIONS = "sessions";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  dbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
        db.createObjectStore(STORE_IDENTITY);
      }
      if (!db.objectStoreNames.contains(STORE_SIGNED_PREKEYS)) {
        db.createObjectStore(STORE_SIGNED_PREKEYS);
      }
      if (!db.objectStoreNames.contains(STORE_ONE_TIME_PREKEYS)) {
        db.createObjectStore(STORE_ONE_TIME_PREKEYS);
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = callback(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(storeName, key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// --- Identity Keys ---

export async function saveIdentityKeyPair(userId, identityPrivateJwk, identityPublicBase64) {
  return idbPut(STORE_IDENTITY, `identity:${userId}`, {
    privateKey: identityPrivateJwk,
    publicKey: identityPublicBase64,
    createdAt: Date.now(),
  });
}

export async function getIdentityKeyPair(userId) {
  return idbGet(STORE_IDENTITY, `identity:${userId}`);
}

export async function saveSigningKeyPair(userId, signingPrivateJwk, signingPublicBase64) {
  return idbPut(STORE_IDENTITY, `signing:${userId}`, {
    privateKey: signingPrivateJwk,
    publicKey: signingPublicBase64,
    createdAt: Date.now(),
  });
}

export async function getSigningKeyPair(userId) {
  return idbGet(STORE_IDENTITY, `signing:${userId}`);
}

// --- Signed PreKeys ---

export async function saveSignedPreKey(userId, keyId, privateKeyJwk, publicKeyBase64) {
  return idbPut(STORE_SIGNED_PREKEYS, `spk:${userId}:${keyId}`, {
    keyId,
    privateKey: privateKeyJwk,
    publicKey: publicKeyBase64,
    createdAt: Date.now(),
  });
}

export async function getSignedPreKey(userId, keyId) {
  return idbGet(STORE_SIGNED_PREKEYS, `spk:${userId}:${keyId}`);
}

export async function getLatestSignedPreKey(userId) {
  return idbGet(STORE_SIGNED_PREKEYS, `spk:${userId}:latest`);
}

export async function saveLatestSignedPreKeyId(userId, keyId) {
  return idbPut(STORE_SIGNED_PREKEYS, `spk:${userId}:latest`, { keyId });
}

// --- One-Time PreKeys ---

export async function saveOneTimePreKey(userId, keyId, privateKeyJwk, publicKeyBase64) {
  return idbPut(STORE_ONE_TIME_PREKEYS, `otpk:${userId}:${keyId}`, {
    keyId,
    privateKey: privateKeyJwk,
    publicKey: publicKeyBase64,
    createdAt: Date.now(),
  });
}

export async function getOneTimePreKey(userId, keyId) {
  return idbGet(STORE_ONE_TIME_PREKEYS, `otpk:${userId}:${keyId}`);
}

export async function deleteOneTimePreKey(userId, keyId) {
  return idbDelete(STORE_ONE_TIME_PREKEYS, `otpk:${userId}:${keyId}`);
}

// --- Sessions (shared secret with a peer) ---

export async function saveSession(userId, peerUserId, sessionData) {
  return idbPut(STORE_SESSIONS, `session:${userId}:${peerUserId}`, {
    ...sessionData,
    updatedAt: Date.now(),
  });
}

export async function getSession(userId, peerUserId) {
  return idbGet(STORE_SESSIONS, `session:${userId}:${peerUserId}`);
}

export async function deleteSession(userId, peerUserId) {
  return idbDelete(STORE_SESSIONS, `session:${userId}:${peerUserId}`);
}

// --- Check if E2EE is initialized ---

export async function isE2eeInitialized(userId) {
  const identity = await getIdentityKeyPair(userId);
  return Boolean(identity?.privateKey && identity?.publicKey);
}
