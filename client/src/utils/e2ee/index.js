export {
  isE2eeMessage,
  wrapE2eeMessage,
  unwrapE2eeMessage,
  E2EE_MESSAGE_PREFIX,
} from "./crypto.js";

export {
  initializeE2ee,
  establishSession,
  encryptForPeer,
  decryptFromPeer,
  replenishPreKeysIfNeeded,
  isE2eeInitialized,
  checkPeerE2ee,
} from "./sessionManager.js";

export { getIdentityKeyPair } from "./keyStore.js";
