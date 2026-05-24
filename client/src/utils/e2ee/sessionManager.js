/**
 * BirdX E2EE Session Manager
 *
 * High-level API for E2EE operations:
 * - Initialize keys (first-time setup)
 * - Establish session with a peer (X3DH)
 * - Encrypt/decrypt messages
 * - Replenish one-time prekeys
 */

import {
  generateKeyPair,
  generateSigningKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  signData,
  x3dhInitiate,
  x3dhRespond,
  encryptMessage,
  decryptMessage,
  E2EE_MESSAGE_PREFIX,
  isE2eeMessage,
  wrapE2eeMessage,
  unwrapE2eeMessage,
  arrayBufferToBase64,
} from "./crypto.js";

import {
  saveIdentityKeyPair,
  getIdentityKeyPair,
  saveSigningKeyPair,
  getSigningKeyPair,
  saveSignedPreKey,
  getSignedPreKey,
  saveLatestSignedPreKeyId,
  getLatestSignedPreKey,
  saveOneTimePreKey,
  getOneTimePreKey,
  deleteOneTimePreKey,
  saveSession,
  getSession,
  isE2eeInitialized,
} from "./keyStore.js";

import { apiFetch } from "../../api/chatApi.js";

const ONE_TIME_PREKEY_COUNT = 20;
const PREKEY_REPLENISH_THRESHOLD = 5;

// --- API Helpers ---

async function uploadKeys({ username, identityKey, signedPreKey, oneTimePreKeys }) {
  const res = await apiFetch("/api/e2ee/keys/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, identityKey, signedPreKey, oneTimePreKeys }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to upload E2EE keys");
  }
  return res.json();
}

async function fetchKeyBundle(targetUserId) {
  const res = await apiFetch(`/api/e2ee/keys/bundle/${encodeURIComponent(targetUserId)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to fetch key bundle");
  }
  return res.json();
}

async function fetchPreKeyCount(username) {
  const res = await apiFetch(
    `/api/e2ee/keys/prekey-count?username=${encodeURIComponent(username)}`,
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data?.count || 0);
}

async function checkPeerE2ee(targetUserId) {
  const res = await apiFetch(`/api/e2ee/keys/check/${encodeURIComponent(targetUserId)}`);
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data?.e2eeEnabled);
}

// --- Key Initialization ---

/**
 * Generate and upload all E2EE keys for a user.
 * Called once when user enables E2EE.
 */
export async function initializeE2ee(userId, username) {
  // 1. Generate identity key pair
  const identityKeyPair = await generateKeyPair();
  const identityPublic = await exportPublicKey(identityKeyPair.publicKey);
  const identityPrivate = await exportPrivateKey(identityKeyPair.privateKey);

  // 2. Generate signing key pair (for signing prekeys)
  const signingKeyPair = await generateSigningKeyPair();
  const signingPublic = await exportPublicKey(signingKeyPair.publicKey);
  const signingPrivate = await exportPrivateKey(signingKeyPair.privateKey);

  // 3. Generate signed prekey
  const signedPreKeyPair = await generateKeyPair();
  const signedPreKeyPublic = await exportPublicKey(signedPreKeyPair.publicKey);
  const signedPreKeyPrivate = await exportPrivateKey(signedPreKeyPair.privateKey);
  const signedPreKeyId = 1;
  const signature = await signData(signingKeyPair.privateKey, signedPreKeyPublic);

  // 4. Generate one-time prekeys
  const oneTimePreKeys = [];
  for (let i = 0; i < ONE_TIME_PREKEY_COUNT; i++) {
    const otpk = await generateKeyPair();
    const otpkPublic = await exportPublicKey(otpk.publicKey);
    const otpkPrivate = await exportPrivateKey(otpk.privateKey);
    oneTimePreKeys.push({
      keyId: i + 1,
      publicKey: otpkPublic,
      privateKey: otpkPrivate,
    });
  }

  // 5. Save all private keys locally
  await saveIdentityKeyPair(userId, identityPrivate, identityPublic);
  await saveSigningKeyPair(userId, signingPrivate, signingPublic);
  await saveSignedPreKey(userId, signedPreKeyId, signedPreKeyPrivate, signedPreKeyPublic);
  await saveLatestSignedPreKeyId(userId, signedPreKeyId);

  for (const otpk of oneTimePreKeys) {
    await saveOneTimePreKey(userId, otpk.keyId, otpk.privateKey, otpk.publicKey);
  }

  // 6. Upload public keys to server
  await uploadKeys({
    username,
    identityKey: identityPublic,
    signedPreKey: {
      keyId: signedPreKeyId,
      publicKey: signedPreKeyPublic,
      signature,
    },
    oneTimePreKeys: oneTimePreKeys.map((k) => ({
      keyId: k.keyId,
      publicKey: k.publicKey,
    })),
  });

  return { identityPublic, signedPreKeyPublic };
}

// --- Session Establishment ---

/**
 * Establish an E2EE session with a peer (as initiator).
 * Fetches the peer's key bundle and performs X3DH.
 */
export async function establishSession(userId, peerUserId) {
  // Check if session already exists
  const existingSession = await getSession(userId, peerUserId);
  if (existingSession?.sharedKeyBase64) {
    return existingSession;
  }

  // Fetch peer's key bundle
  const bundle = await fetchKeyBundle(peerUserId);

  // Load our identity key
  const identityData = await getIdentityKeyPair(userId);
  if (!identityData) {
    throw new Error("E2EE not initialized. Please enable E2EE first.");
  }

  const identityPrivateKey = await importPrivateKey(identityData.privateKey);

  // Generate ephemeral key for this session
  const ephemeralKeyPair = await generateKeyPair();
  const ephemeralPublic = await exportPublicKey(ephemeralKeyPair.publicKey);

  // Import peer's public keys
  const recipientIdentityKey = await importPublicKey(bundle.identityKey);
  const recipientSignedPreKey = await importPublicKey(bundle.signedPreKey.publicKey);
  const recipientOneTimePreKey = bundle.oneTimePreKey
    ? await importPublicKey(bundle.oneTimePreKey.publicKey)
    : null;

  // Perform X3DH
  const sharedKey = await x3dhInitiate({
    identityKeyPrivate: identityPrivateKey,
    ephemeralKeyPrivate: ephemeralKeyPair.privateKey,
    recipientIdentityKeyPublic: recipientIdentityKey,
    recipientSignedPreKeyPublic: recipientSignedPreKey,
    recipientOneTimePreKeyPublic: recipientOneTimePreKey,
  });

  // Export shared key for storage
  const sharedKeyRaw = await crypto.subtle.exportKey("raw", sharedKey);
  const sharedKeyBase64 = arrayBufferToBase64(sharedKeyRaw);

  // Save session
  const sessionData = {
    peerUserId,
    sharedKeyBase64,
    ephemeralPublicKey: ephemeralPublic,
    peerIdentityKey: bundle.identityKey,
    peerSignedPreKeyId: bundle.signedPreKey.keyId,
    peerOneTimePreKeyId: bundle.oneTimePreKey?.keyId || null,
    messageCount: 0,
    established: true,
  };

  await saveSession(userId, peerUserId, sessionData);
  return sessionData;
}

/**
 * Respond to an incoming E2EE session (as responder).
 * Called when receiving the first E2EE message from a peer.
 */
export async function respondToSession(userId, peerUserId, initialMessage) {
  const { senderIdentityKey, senderEphemeralKey, usedOneTimePreKeyId } = initialMessage;

  // Load our keys
  const identityData = await getIdentityKeyPair(userId);
  if (!identityData) {
    throw new Error("E2EE not initialized.");
  }

  const identityPrivateKey = await importPrivateKey(identityData.privateKey);

  // Load signed prekey
  const latestSpk = await getLatestSignedPreKey(userId);
  const spkData = await getSignedPreKey(userId, latestSpk?.keyId || 1);
  if (!spkData) {
    throw new Error("Signed prekey not found.");
  }
  const signedPreKeyPrivate = await importPrivateKey(spkData.privateKey);

  // Load one-time prekey if used
  let oneTimePreKeyPrivate = null;
  if (usedOneTimePreKeyId) {
    const otpkData = await getOneTimePreKey(userId, usedOneTimePreKeyId);
    if (otpkData) {
      oneTimePreKeyPrivate = await importPrivateKey(otpkData.privateKey);
      // Delete used one-time prekey
      await deleteOneTimePreKey(userId, usedOneTimePreKeyId);
    }
  }

  // Import sender's public keys
  const senderIdentityKeyPublic = await importPublicKey(senderIdentityKey);
  const senderEphemeralKeyPublic = await importPublicKey(senderEphemeralKey);

  // Perform X3DH (responder side)
  const sharedKey = await x3dhRespond({
    identityKeyPrivate: identityPrivateKey,
    signedPreKeyPrivate,
    oneTimePreKeyPrivate,
    senderIdentityKeyPublic,
    senderEphemeralKeyPublic,
  });

  // Export and save
  const sharedKeyRaw = await crypto.subtle.exportKey("raw", sharedKey);
  const sharedKeyBase64 = arrayBufferToBase64(sharedKeyRaw);

  const sessionData = {
    peerUserId,
    sharedKeyBase64,
    peerIdentityKey: senderIdentityKey,
    peerEphemeralKey: senderEphemeralKey,
    messageCount: 0,
    established: true,
  };

  await saveSession(userId, peerUserId, sessionData);
  return sessionData;
}

// --- Message Encryption/Decryption ---

/**
 * Encrypt a message for a peer.
 * Returns the encrypted body ready to send.
 */
export async function encryptForPeer(userId, peerUserId, plaintext) {
  let session = await getSession(userId, peerUserId);

  if (!session?.sharedKeyBase64) {
    // Establish session first
    session = await establishSession(userId, peerUserId);
  }

  // Import shared key
  const keyRaw = Uint8Array.from(atob(session.sharedKeyBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  // Encrypt
  const encrypted = await encryptMessage(key, plaintext);

  // Build envelope
  const envelope = JSON.stringify({
    v: 1,
    ik: (await getIdentityKeyPair(userId))?.publicKey || "",
    ek: session.ephemeralPublicKey || "",
    otpkId: session.peerOneTimePreKeyId || null,
    ct: encrypted,
  });

  // Update message count
  session.messageCount = (session.messageCount || 0) + 1;
  await saveSession(userId, peerUserId, session);

  return wrapE2eeMessage(envelope);
}

/**
 * Decrypt a message from a peer.
 * Returns the plaintext.
 */
export async function decryptFromPeer(userId, peerUserId, encryptedBody) {
  const payload = unwrapE2eeMessage(encryptedBody);
  if (!payload) {
    throw new Error("Not an E2EE message");
  }

  let envelope;
  try {
    envelope = JSON.parse(payload);
  } catch {
    throw new Error("Invalid E2EE envelope");
  }

  let session = await getSession(userId, peerUserId);

  // If no session exists, establish one from the incoming message
  if (!session?.sharedKeyBase64) {
    session = await respondToSession(userId, peerUserId, {
      senderIdentityKey: envelope.ik,
      senderEphemeralKey: envelope.ek,
      usedOneTimePreKeyId: envelope.otpkId,
    });
  }

  // Import shared key
  const keyRaw = Uint8Array.from(atob(session.sharedKeyBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  // Decrypt
  return decryptMessage(key, envelope.ct);
}

// --- Prekey Replenishment ---

export async function replenishPreKeysIfNeeded(userId, username) {
  const count = await fetchPreKeyCount(username);
  if (count >= PREKEY_REPLENISH_THRESHOLD) return;

  const signingData = await getSigningKeyPair(userId);
  if (!signingData) return;

  const toGenerate = ONE_TIME_PREKEY_COUNT - count;
  const startId = Date.now(); // Use timestamp as unique key ID base
  const newKeys = [];

  for (let i = 0; i < toGenerate; i++) {
    const otpk = await generateKeyPair();
    const otpkPublic = await exportPublicKey(otpk.publicKey);
    const otpkPrivate = await exportPrivateKey(otpk.privateKey);
    const keyId = startId + i;
    newKeys.push({ keyId, publicKey: otpkPublic, privateKey: otpkPrivate });
    await saveOneTimePreKey(userId, keyId, otpkPrivate, otpkPublic);
  }

  await uploadKeys({
    username,
    oneTimePreKeys: newKeys.map((k) => ({ keyId: k.keyId, publicKey: k.publicKey })),
  });
}

// --- Utility Exports ---

export { isE2eeMessage, isE2eeInitialized, checkPeerE2ee };
