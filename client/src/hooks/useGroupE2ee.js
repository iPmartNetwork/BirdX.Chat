import { useCallback, useEffect, useMemo, useState } from "react";
import {
  disableGroupE2ee,
  enableGroupE2ee,
  fetchGroupE2eeStatus,
  fetchGroupE2eeKeys,
  fetchMyGroupE2eeKey,
  uploadGroupE2eeKey,
} from "../api/chatApi.js";
import { isE2eeInitialized } from "../utils/e2ee/keyStore.js";
import {
  cacheGroupKey,
  clearCachedGroupKey,
  exportGroupKeyRaw,
  generateGroupKey,
  getCachedGroupKey,
  importGroupKeyRaw,
} from "../utils/e2ee/group.js";
import {
  unwrapGroupKeyForMember,
  wrapGroupKeyForMember,
} from "../utils/e2ee/groupKeyWrap.js";

async function readApiJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export function useGroupE2ee({
  chatId,
  chat,
  user,
  members = [],
  onChatUpdate,
}) {
  const numericChatId = Number(chatId || 0);
  const userId = Number(user?.id || 0);
  const isGroup = String(chat?.type || "").toLowerCase() === "group";

  const [enabled, setEnabled] = useState(Boolean(chat?.group_e2ee_enabled));
  const [keyReady, setKeyReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentRole = useMemo(() => {
    return String(
      members.find((member) => Number(member?.id) === userId)?.role || "",
    ).toLowerCase();
  }, [members, userId]);

  const canManage = currentRole === "owner" || currentRole === "admin";

  useEffect(() => {
    setEnabled(Boolean(chat?.group_e2ee_enabled));
  }, [chat?.group_e2ee_enabled]);

  const bootstrapLocalKey = useCallback(async () => {
    if (!numericChatId || !isGroup || !enabled || !userId) {
      setKeyReady(false);
      return false;
    }

    if (getCachedGroupKey(numericChatId)) {
      setKeyReady(true);
      return true;
    }

    try {
      const me = await readApiJson(await fetchMyGroupE2eeKey(numericChatId));
      if (!me?.wrappedKey) {
        setKeyReady(false);
        return false;
      }
      const raw = await unwrapGroupKeyForMember(userId, me.wrappedKey);
      const key = await importGroupKeyRaw(raw);
      cacheGroupKey(numericChatId, key);
      setKeyReady(true);
      return true;
    } catch (bootstrapErr) {
      console.warn("[ge2ee] key bootstrap failed:", bootstrapErr);
      setKeyReady(false);
      return false;
    }
  }, [enabled, isGroup, numericChatId, userId]);

  useEffect(() => {
    if (!enabled) {
      clearCachedGroupKey(numericChatId);
      setKeyReady(false);
      return;
    }
    void bootstrapLocalKey();
  }, [bootstrapLocalKey, enabled, numericChatId]);

  const distributeGroupKey = useCallback(
    async (groupKey, targetMembers = null) => {
      const raw = await exportGroupKeyRaw(groupKey);
      const roster = (Array.isArray(targetMembers) ? targetMembers : members).filter(
        (member) => Number(member?.id || 0) > 0,
      );
      for (const member of roster) {
        const memberId = Number(member.id);
        try {
          const wrapped = await wrapGroupKeyForMember(userId, memberId, raw);
          await readApiJson(
            await uploadGroupE2eeKey({
              chatId: numericChatId,
              wrappedKey: wrapped,
              userId: memberId,
            }),
          );
        } catch (memberErr) {
          console.warn(`[ge2ee] key distribution failed for ${memberId}:`, memberErr);
          if (memberId === userId) throw memberErr;
        }
      }
    },
    [members, numericChatId, userId],
  );

  const distributeMissingMemberKeys = useCallback(async () => {
    if (!enabled || !numericChatId || !userId || busy) return false;
    const initialized = await isE2eeInitialized(userId);
    if (!initialized) return false;
    if (!canManage && !keyReady) return false;

    let groupKey = getCachedGroupKey(numericChatId);
    if (!groupKey) {
      const bootstrapped = await bootstrapLocalKey();
      if (!bootstrapped) return false;
      groupKey = getCachedGroupKey(numericChatId);
    }
    if (!groupKey) return false;

    const keyPayload = await readApiJson(await fetchGroupE2eeKeys(numericChatId));
    const keyedUserIds = new Set(
      (Array.isArray(keyPayload?.keys) ? keyPayload.keys : [])
        .map((entry) => Number(entry?.userId || 0))
        .filter(Boolean),
    );
    const missingMembers = members.filter(
      (member) => Number(member?.id || 0) > 0 && !keyedUserIds.has(Number(member.id)),
    );
    if (!missingMembers.length) return true;

    await distributeGroupKey(groupKey, missingMembers);
    return true;
  }, [
    bootstrapLocalKey,
    busy,
    canManage,
    distributeGroupKey,
    enabled,
    keyReady,
    members,
    numericChatId,
    userId,
  ]);

  useEffect(() => {
    if (!enabled || !numericChatId || !isGroup || (!canManage && !keyReady)) return undefined;
    const timer = window.setTimeout(() => {
      void distributeMissingMemberKeys().catch((err) => {
        console.warn("[ge2ee] auto key distribution skipped:", err?.message || err);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    canManage,
    distributeMissingMemberKeys,
    enabled,
    isGroup,
    keyReady,
    members,
    numericChatId,
  ]);

  const refreshStatus = useCallback(async () => {
    if (!numericChatId) return;
    const data = await readApiJson(await fetchGroupE2eeStatus(numericChatId));
    setEnabled(Boolean(data?.enabled));
    onChatUpdate?.({ group_e2ee_enabled: data?.enabled ? 1 : 0 });
  }, [numericChatId, onChatUpdate]);

  const handleEnable = useCallback(async () => {
    if (!canManage || !numericChatId || !userId) return;
    setBusy(true);
    setError("");
    try {
      const initialized = await isE2eeInitialized(userId);
      if (!initialized) {
        throw new Error("Enable personal E2EE in Security settings first.");
      }
      await readApiJson(await enableGroupE2ee(numericChatId));
      const groupKey = await generateGroupKey();
      await distributeGroupKey(groupKey);
      cacheGroupKey(numericChatId, groupKey);
      setEnabled(true);
      setKeyReady(true);
      onChatUpdate?.({ group_e2ee_enabled: 1 });
    } catch (enableErr) {
      setError(enableErr?.message || "Unable to enable group encryption.");
      throw enableErr;
    } finally {
      setBusy(false);
    }
  }, [canManage, distributeGroupKey, numericChatId, onChatUpdate, userId]);

  const handleDisable = useCallback(async () => {
    if (!canManage || !numericChatId) return;
    setBusy(true);
    setError("");
    try {
      await readApiJson(await disableGroupE2ee(numericChatId));
      clearCachedGroupKey(numericChatId);
      setEnabled(false);
      setKeyReady(false);
      onChatUpdate?.({ group_e2ee_enabled: 0 });
    } catch (disableErr) {
      setError(disableErr?.message || "Unable to disable group encryption.");
      throw disableErr;
    } finally {
      setBusy(false);
    }
  }, [canManage, numericChatId, onChatUpdate]);

  const handleRedistributeKeys = useCallback(async () => {
    if (!canManage || !enabled || !numericChatId) return;
    setBusy(true);
    setError("");
    try {
      const initialized = await isE2eeInitialized(userId);
      if (!initialized) {
        throw new Error("Enable personal E2EE in Security settings first.");
      }
      let groupKey = getCachedGroupKey(numericChatId);
      if (!groupKey) {
        const me = await readApiJson(await fetchMyGroupE2eeKey(numericChatId));
        if (!me?.wrappedKey) {
          throw new Error("Group key is missing. Disable and re-enable encryption.");
        }
        const raw = await unwrapGroupKeyForMember(userId, me.wrappedKey);
        groupKey = await importGroupKeyRaw(raw);
      }
      await distributeGroupKey(groupKey);
      cacheGroupKey(numericChatId, groupKey);
      setKeyReady(true);
    } catch (rotateErr) {
      setError(rotateErr?.message || "Unable to refresh member keys.");
      throw rotateErr;
    } finally {
      setBusy(false);
    }
  }, [canManage, distributeGroupKey, enabled, numericChatId, userId]);

  return {
    isGroup,
    enabled,
    keyReady,
    busy,
    error,
    canManage,
    enable: handleEnable,
    disable: handleDisable,
    redistributeKeys: handleRedistributeKeys,
    distributeMissingMemberKeys,
    refreshStatus,
    bootstrapLocalKey,
  };
}
