/**
 * Manages multiple RTCPeerConnections for group voice/video calls (mesh).
 */
export function createMeshCallManager({
  iceServers,
  getLocalStream,
  emit,
  onParticipantStream,
  onParticipantRemoved,
}) {
  /** @type {Map<string, { pc: RTCPeerConnection, stream: MediaStream|null, pendingIce: RTCIceCandidateInit[] }>} */
  const peers = new Map();

  function getEntry(socketId) {
    return peers.get(String(socketId || "")) || null;
  }

  function ensurePeer(remoteSocketId, roomId) {
    const socketId = String(remoteSocketId || "");
    if (!socketId) return null;
    const existing = peers.get(socketId);
    if (existing?.pc && existing.pc.connectionState !== "closed") {
      return existing;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers || [],
      iceCandidatePoolSize: 4,
      iceTransportPolicy: (iceServers || []).some((s) =>
        [].concat(s?.urls || []).join(" ").includes("turn:")
      ) ? "relay" : "all",
    });

    const localStream = getLocalStream?.();
    localStream?.getTracks?.().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    const entry = { pc, stream: null, pendingIce: [] };
    peers.set(socketId, entry);

    pc.onicecandidate = (event) => {
      if (!event.candidate || !roomId) return;
      emit("ice-candidate", {
        roomId,
        candidate: event.candidate,
        targetSocketId: socketId,
      });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams || [];
      if (!remoteStream) return;
      entry.stream = remoteStream;
      onParticipantStream?.(socketId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        removePeer(socketId);
      }
    };

    return entry;
  }

  async function flushPendingIce(socketId) {
    const entry = getEntry(socketId);
    if (!entry?.pc?.remoteDescription || !entry.pendingIce.length) return;
    const queued = [...entry.pendingIce];
    entry.pendingIce = [];
    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn("[mesh] queued ICE failed:", error);
      }
    }
  }

  async function createOfferTo(remoteSocketId, roomId) {
    const entry = ensurePeer(remoteSocketId, roomId);
    if (!entry?.pc || entry.pc.signalingState !== "stable") return;
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    emit("offer", {
      roomId,
      offer: entry.pc.localDescription || offer,
      targetSocketId: remoteSocketId,
    });
  }

  async function handleOffer({ roomId, offer, fromSocketId, mySocketId }) {
    const remoteSocketId = String(fromSocketId || "");
    if (!remoteSocketId || remoteSocketId === mySocketId) return;
    const entry = ensurePeer(remoteSocketId, roomId);
    if (!entry?.pc) return;

    const sessionDescription = offer?.type ? offer : offer?.sdp ? offer : null;
    if (!sessionDescription) return;

    if (entry.pc.signalingState === "stable") {
      await entry.pc.setRemoteDescription(
        new RTCSessionDescription(sessionDescription),
      );
      await flushPendingIce(remoteSocketId);
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      emit("answer", {
        roomId,
        answer: entry.pc.localDescription || answer,
        targetSocketId: remoteSocketId,
      });
      return;
    }

    if (entry.pc.signalingState === "have-local-offer") {
      // Glare resolution: we both sent offers. Rollback local first, then apply remote.
      await entry.pc.setLocalDescription({ type: "rollback" });
      await entry.pc.setRemoteDescription(
        new RTCSessionDescription(sessionDescription),
      );
      await flushPendingIce(remoteSocketId);
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      emit("answer", {
        roomId,
        answer: entry.pc.localDescription || answer,
        targetSocketId: remoteSocketId,
      });
    }
  }

  async function handleAnswer({ answer, fromSocketId }) {
    const remoteSocketId = String(fromSocketId || "");
    const entry = getEntry(remoteSocketId);
    if (!entry?.pc || entry.pc.signalingState !== "have-local-offer") return;
    const sessionDescription = answer?.type ? answer : answer;
    if (!sessionDescription) return;
    await entry.pc.setRemoteDescription(
      new RTCSessionDescription(sessionDescription),
    );
    await flushPendingIce(remoteSocketId);
  }

  async function handleIceCandidate({ candidate, fromSocketId }) {
    const remoteSocketId = String(fromSocketId || "");
    const entry = getEntry(remoteSocketId);
    if (!entry?.pc) return;
    const iceCandidate = candidate?.candidate ? candidate : candidate;
    if (!iceCandidate) return;
    if (!entry.pc.remoteDescription) {
      entry.pendingIce.push(iceCandidate);
      return;
    }
    await entry.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
  }

  function removePeer(socketId) {
    const id = String(socketId || "");
    const entry = peers.get(id);
    if (!entry) return;
    try {
      entry.pc?.close?.();
    } catch {
      // ignore
    }
    peers.delete(id);
    onParticipantRemoved?.(id);
  }

  function closeAll() {
    for (const socketId of [...peers.keys()]) {
      removePeer(socketId);
    }
  }

  function listParticipants() {
    return [...peers.entries()].map(([socketId, entry]) => ({
      socketId,
      stream: entry.stream,
    }));
  }

  return {
    peers,
    ensurePeer,
    createOfferTo,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    closeAll,
    listParticipants,
  };
}
