import {
  decryptMessage,
  encryptMessage,
  exportPublicKey,
  generateKeyPair,
  importPrivateKey,
  importPublicKey,
  x3dhInitiate,
  x3dhRespond,
} from "./crypto.js";
import {
  deleteOneTimePreKey,
  getIdentityKeyPair,
  getLatestSignedPreKey,
  getOneTimePreKey,
  getSignedPreKey,
} from "./keyStore.js";
import { apiFetch } from "../../api/chatApi.js";

export const GROUP_KEY_WRAP_PREFIX = "gkw1:";

async function fetchKeyBundle(targetUserId) {
  const res = await apiFetch(
    `/api/e2ee/keys/bundle/${encodeURIComponent(targetUserId)}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to fetch E2EE key bundle.");
  }
  return res.json();
}

/**
 * Wrap a raw group key for a member using a one-off X3DH handshake.
 */
export async function wrapGroupKeyForMember(
  wrappingUserId,
  targetUserId,
  groupKeyRawBase64,
) {
  const bundle = await fetchKeyBundle(targetUserId);
  if (!bundle?.identityKey || !bundle?.signedPreKey?.publicKey) {
    throw new Error("Member has not set up end-to-end encryption.");
  }

  const identityData = await getIdentityKeyPair(wrappingUserId);
  if (!identityData?.privateKey) {
    throw new Error("Enable personal E2EE before securing group chats.");
  }

  const identityPrivateKey = await importPrivateKey(identityData.privateKey);
  const ephemeralKeyPair = await generateKeyPair();
  const recipientIdentityKeyPublic = await importPublicKey(bundle.identityKey);
  const recipientSignedPreKeyPublic = await importPublicKey(
    bundle.signedPreKey.publicKey,
  );
  const recipientOneTimePreKeyPublic = bundle.oneTimePreKey?.publicKey
    ? await importPublicKey(bundle.oneTimePreKey.publicKey)
    : null;

  const aesKey = await x3dhInitiate({
    identityKeyPrivate: identityPrivateKey,
    ephemeralKeyPrivate: ephemeralKeyPair.privateKey,
    recipientIdentityKeyPublic,
    recipientSignedPreKeyPublic,
    recipientOneTimePreKeyPublic,
  });

  const ct = await encryptMessage(aesKey, groupKeyRawBase64);
  const envelope = {
    v: 1,
    ik: identityData.publicKey,
    ek: await exportPublicKey(ephemeralKeyPair.publicKey),
    otpkId: bundle.oneTimePreKey?.keyId || null,
    ct,
  };

  return GROUP_KEY_WRAP_PREFIX + btoa(JSON.stringify(envelope));
}

/**
 * Unwrap the caller's group key blob using local identity + prekeys.
 */
export async function unwrapGroupKeyForMember(userId, wrappedKey) {
  const raw = String(wrappedKey || "");
  if (!raw.startsWith(GROUP_KEY_WRAP_PREFIX)) {
    throw new Error("Invalid group key wrap.");
  }

  let envelope;
  try {
    envelope = JSON.parse(atob(raw.slice(GROUP_KEY_WRAP_PREFIX.length)));
  } catch {
    throw new Error("Invalid group key envelope.");
  }

  const identityData = await getIdentityKeyPair(userId);
  if (!identityData?.privateKey) {
    throw new Error("E2EE is not initialized on this device.");
  }

  const identityPrivateKey = await importPrivateKey(identityData.privateKey);
  const latestSpk = await getLatestSignedPreKey(userId);
  const spkData = await getSignedPreKey(userId, latestSpk?.keyId || 1);
  if (!spkData?.privateKey) {
    throw new Error("Signed prekey not found.");
  }

  const signedPreKeyPrivate = await importPrivateKey(spkData.privateKey);
  let oneTimePreKeyPrivate = null;
  if (envelope.otpkId) {
    const otpkData = await getOneTimePreKey(userId, envelope.otpkId);
    if (otpkData?.privateKey) {
      oneTimePreKeyPrivate = await importPrivateKey(otpkData.privateKey);
      await deleteOneTimePreKey(userId, envelope.otpkId);
    }
  }

  const senderIdentityKeyPublic = await importPublicKey(envelope.ik);
  const senderEphemeralKeyPublic = await importPublicKey(envelope.ek);
  const aesKey = await x3dhRespond({
    identityKeyPrivate: identityPrivateKey,
    signedPreKeyPrivate,
    oneTimePreKeyPrivate,
    senderIdentityKeyPublic,
    senderEphemeralKeyPublic,
  });

  return decryptMessage(aesKey, envelope.ct);
}
