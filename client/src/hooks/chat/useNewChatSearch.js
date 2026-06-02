import { useEffect, useState } from "react";

const USERNAME_PATTERN = /^[a-z0-9._]{3,32}$/;

export function useNewChatSearch({
  user,
  dmUsernamesRef,
  lookupUserExact,
  debounceMs,
}) {
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState("");
  const [newChatError, setNewChatError] = useState("");
  const [newChatResults, setNewChatResults] = useState([]);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatSelection, setNewChatSelection] = useState(null);

  useEffect(() => {
    if (!newChatOpen) return;
    const normalized = newChatUsername.trim().toLowerCase().replace(/^@+/, "");
    if (!normalized) {
      setNewChatResults([]);
      setNewChatSelection(null);
      return;
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      setNewChatResults([]);
      setNewChatSelection(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setNewChatLoading(true);
        const res = await lookupUserExact({
          exclude: user.username,
          username: normalized,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Unable to look up user.");
        }
        const dmUsernames = dmUsernamesRef.current;
        const candidate = data.user || null;
        if (
          candidate &&
          !dmUsernames.has(String(candidate.username || "").toLowerCase())
        ) {
          setNewChatResults([candidate]);
          if (
            String(candidate.username || "").toLowerCase() === normalized
          ) {
            setNewChatSelection(candidate);
          } else {
            setNewChatSelection(null);
          }
        } else {
          setNewChatResults([]);
          setNewChatSelection(null);
        }
      } catch (err) {
        setNewChatError(err.message);
        setNewChatResults([]);
        setNewChatSelection(null);
      } finally {
        setNewChatLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [
    debounceMs,
    dmUsernamesRef,
    lookupUserExact,
    newChatOpen,
    newChatUsername,
    user.username,
  ]);

  return {
    newChatOpen,
    setNewChatOpen,
    newChatUsername,
    setNewChatUsername,
    newChatError,
    setNewChatError,
    newChatResults,
    setNewChatResults,
    newChatLoading,
    newChatSelection,
    setNewChatSelection,
  };
}
