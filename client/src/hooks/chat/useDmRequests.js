import { useCallback, useEffect, useState } from "react";
import {
  acceptDmRequest,
  fetchDmRequests,
  rejectDmRequest,
} from "../../api/chatApi.js";

export function useDmRequests({ user, enabled = true, refreshKey = 0 }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!enabled || !user?.username) {
      setRequests([]);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await fetchDmRequests(user.username);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load requests.");
      }
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      setError(err.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.username]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const accept = useCallback(
    async (chatId) => {
      if (!user?.username || !chatId) return false;
      const res = await acceptDmRequest({ username: user.username, chatId });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to accept request.");
      }
      await load();
      return true;
    },
    [load, user?.username],
  );

  const reject = useCallback(
    async (chatId) => {
      if (!user?.username || !chatId) return false;
      const res = await rejectDmRequest({ username: user.username, chatId });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to decline request.");
      }
      await load();
      return true;
    },
    [load, user?.username],
  );

  return { requests, loading, error, reload: load, accept, reject };
}
