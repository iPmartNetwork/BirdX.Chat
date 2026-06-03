import { useCallback, useState } from "react";
import {
  acceptContactRequest as acceptContactRequestApi,
  cancelContactRequest as cancelContactRequestApi,
  fetchContacts,
  fetchIncomingContactRequests,
  fetchOutgoingContactRequests,
  fetchContactPeerStatus,
  rejectContactRequest as rejectContactRequestApi,
  removeContact as removeContactApi,
  sendContactRequest as sendContactRequestApi,
} from "../api/chatApi.js";

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export function useContacts(user) {
  const username = user?.username || "";
  const [contacts, setContacts] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!username) return;
    setLoadingContacts(true);
    try {
      const data = await readJson(await fetchContacts({ username }));
      setContacts(Array.isArray(data?.contacts) ? data.contacts : []);
    } catch (error) {
      console.warn("[contacts] load failed:", error);
    } finally {
      setLoadingContacts(false);
    }
  }, [username]);

  const loadIncomingRequests = useCallback(async () => {
    if (!username) return;
    setLoadingRequests(true);
    try {
      const data = await readJson(await fetchIncomingContactRequests({ username }));
      setIncomingRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch (error) {
      console.warn("[contacts] incoming requests load failed:", error);
    } finally {
      setLoadingRequests(false);
    }
  }, [username]);

  const loadOutgoingRequests = useCallback(async () => {
    if (!username) return;
    try {
      const data = await readJson(await fetchOutgoingContactRequests({ username }));
      setOutgoingRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch (error) {
      console.warn("[contacts] outgoing requests load failed:", error);
    }
  }, [username]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadContacts(), loadIncomingRequests(), loadOutgoingRequests()]);
  }, [loadContacts, loadIncomingRequests, loadOutgoingRequests]);

  const fetchPeerStatus = useCallback(
    async (peerUsername) => {
      if (!username || !peerUsername) {
        return { isContact: false };
      }
      return readJson(
        await fetchContactPeerStatus({ username, peerUsername }),
      );
    },
    [username],
  );

  const sendRequest = useCallback(
    async (toUsername) => {
      if (!username || !toUsername) return null;
      const data = await readJson(
        await sendContactRequestApi({ username, toUsername }),
      );
      await loadAll();
      return data;
    },
    [loadAll, username],
  );

  const acceptRequest = useCallback(
    async (requestId) => {
      if (!username || !requestId) return null;
      const data = await readJson(
        await acceptContactRequestApi({ username, requestId }),
      );
      await loadAll();
      return data;
    },
    [loadAll, username],
  );

  const rejectRequest = useCallback(
    async (requestId) => {
      if (!username || !requestId) return null;
      const data = await readJson(
        await rejectContactRequestApi({ username, requestId }),
      );
      await loadIncomingRequests();
      return data;
    },
    [loadIncomingRequests, username],
  );

  const cancelRequest = useCallback(
    async (requestId) => {
      if (!username || !requestId) return null;
      const data = await readJson(
        await cancelContactRequestApi({ username, requestId }),
      );
      await loadAll();
      return data;
    },
    [loadAll, username],
  );

  const removeContact = useCallback(
    async (contactUsername) => {
      if (!username || !contactUsername) return null;
      const data = await readJson(
        await removeContactApi({ username, contactUsername }),
      );
      await loadAll();
      return data;
    },
    [loadAll, username],
  );

  return {
    contacts,
    incomingRequests,
    outgoingRequests,
    loadingContacts,
    loadingRequests,
    loadContacts,
    loadIncomingRequests,
    loadOutgoingRequests,
    loadAll,
    fetchPeerStatus,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeContact,
    setContacts,
    setIncomingRequests,
    setOutgoingRequests,
  };
}
