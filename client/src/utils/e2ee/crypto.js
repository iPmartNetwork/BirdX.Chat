/**
 * BirdX E2EE Crypto Module
 *
 * Implements X25519 key exchange (via ECDH P-256 as Web Crypto fallback),
 * AES-256-GCM symmetric encryption, and HKDF key derivation.
 *
 * All private keys stay in the client. The server only sees public keys
 * and encrypted ciphertext.
 */

const CURVE = "P-256";
const AES_KEY_BITS = 256;
const HKDF_INFO = new TextEncoder().encode("BirdX-E2EE-v1");
const HKDF_SALT = new Uint8Array(32); // Zero salt for initial derivation

// --- Utility ---

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function concatBuffers(...buffers) {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

// --- Key Generation ---

export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: CURVE },
    true,
    ["deriveBits"],
  );
  return keyPair;
}

export async function exportPublicKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

export async function importPublicKey(base64) {
  const raw = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: CURVE },
    true,
    [],
  );
}

export async function exportPrivateKey(key) {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

export async function importPrivateKey(jwkString) {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: CURVE },
    true,
    ["deriveBits"],
  );
}

// --- Signing (for signed prekeys) ---

export async function generateSigningKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: CURVE },
    true,
    ["sign", "verify"],
  );
}

export async function signData(privateKey, data) {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    typeof data === "string" ? new TextEncoder().encode(data) : data,
  );
  return arrayBufferToBase64(signature);
}

export async function verifySignature(publicKey, signature, data) {
  const sigBuffer = base64ToArrayBuffer(signature);
  const dataBuffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    sigBuffer,
    dataBuffer,
  );
}

// --- Diffie-Hellman ---

export async function deriveSharedSecret(privateKey, publicKey) {
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  return bits;
}

// --- HKDF Key Derivation ---

async function hkdfDerive(inputKeyMaterial, info = HKDF_INFO, salt = HKDF_SALT) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    inputKeyMaterial,
    "HKDF",
    false,
    ["deriveBits", "deriveKey"],
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info,
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_BITS },
    true,
    ["encrypt", "decrypt"],
  );

  return derivedKey;
}

// --- X3DH Key Agreement ---

/**
 * Perform X3DH as the initiator (Alice).
 * Returns a shared secret derived from multiple DH operations.
 */
export async function x3dhInitiate({
  identityKeyPrivate,
  ephemeralKeyPrivate,
  recipientIdentityKeyPublic,
  recipientSignedPreKeyPublic,
  recipientOneTimePreKeyPublic,
}) {
  // DH1: identity_A x signed_prekey_B
  const dh1 = await deriveSharedSecret(identityKeyPrivate, recipientSignedPreKeyPublic);

  // DH2: ephemeral_A x identity_B
  const dh2 = await deriveSharedSecret(ephemeralKeyPrivate, recipientIdentityKeyPublic);

  // DH3: ephemeral_A x signed_prekey_B
  const dh3 = await deriveSharedSecret(ephemeralKeyPrivate, recipientSignedPreKeyPublic);

  let combined;
  if (recipientOneTimePreKeyPublic) {
    // DH4: ephemeral_A x one_time_prekey_B
    const dh4 = await deriveSharedSecret(ephemeralKeyPrivate, recipientOneTimePreKeyPublic);
    combined = concatBuffers(dh1, dh2, dh3, dh4);
  } else {
    combined = concatBuffers(dh1, dh2, dh3);
  }

  return hkdfDerive(combined);
}

/**
 * Perform X3DH as the responder (Bob).
 * Returns the same shared secret as the initiator.
 */
export async function x3dhRespond({
  identityKeyPrivate,
  signedPreKeyPrivate,
  oneTimePreKeyPrivate,
  senderIdentityKeyPublic,
  senderEphemeralKeyPublic,
}) {
  // DH1: signed_prekey_B x identity_A
  const dh1 = await deriveSharedSecret(signedPreKeyPrivate, senderIdentityKeyPublic);

  // DH2: identity_B x ephemeral_A
  const dh2 = await deriveSharedSecret(identityKeyPrivate, senderEphemeralKeyPublic);

  // DH3: signed_prekey_B x ephemeral_A
  const dh3 = await deriveSharedSecret(signedPreKeyPrivate, senderEphemeralKeyPublic);

  let combined;
  if (oneTimePreKeyPrivate) {
    // DH4: one_time_prekey_B x ephemeral_A
    const dh4 = await deriveSharedSecret(oneTimePreKeyPrivate, senderEphemeralKeyPublic);
    combined = concatBuffers(dh1, dh2, dh3, dh4);
  } else {
    combined = concatBuffers(dh1, dh2, dh3);
  }

  return hkdfDerive(combined);
}

// --- Symmetric Encryption (AES-256-GCM) ---

export async function encryptMessage(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // Format: base64(iv) + "." + base64(ciphertext)
  return `${arrayBufferToBase64(iv)}.${arrayBufferToBase64(ciphertext)}`;
}

export async function decryptMessage(key, encrypted) {
  const [ivBase64, ciphertextBase64] = encrypted.split(".");
  if (!ivBase64 || !ciphertextBase64) {
    throw new Error("Invalid encrypted message format");
  }

  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

// --- Ratchet Step (simplified symmetric ratchet) ---

export async function ratchetKey(currentKey) {
  const rawKey = await crypto.subtle.exportKey("raw", currentKey);
  const info = new TextEncoder().encode("BirdX-Ratchet-v1");
  return hkdfDerive(rawKey, info);
}

// --- Message Envelope ---

export const E2EE_MESSAGE_PREFIX = "🔒e2ee:";

export function isE2eeMessage(body) {
  return String(body || "").startsWith(E2EE_MESSAGE_PREFIX);
}

export function wrapE2eeMessage(encryptedPayload) {
  return `${E2EE_MESSAGE_PREFIX}${encryptedPayload}`;
}

export function unwrapE2eeMessage(body) {
  if (!isE2eeMessage(body)) return null;
  return String(body).slice(E2EE_MESSAGE_PREFIX.length);
}
