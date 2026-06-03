import { Device } from "mediasoup-client";

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error("Call service is not connected."));
      return;
    }
    socket.emit(event, payload, (response) => {
      if (!response?.ok) {
        reject(new Error(response?.error || `${event} failed.`));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * SFU client for group calls via mediasoup.
 */
export function createSfuCallManager({
  socket,
  iceServers = [],
  getLocalStream,
  onParticipantStream,
  onParticipantRemoved,
  resolveParticipantName,
  onTransportFailure,
}) {
  /** @type {Device | null} */
  let device = null;
  /** @type {import("mediasoup-client").types.Transport | null} */
  let sendTransport = null;
  /** @type {import("mediasoup-client").types.Transport | null} */
  let recvTransport = null;
  let roomId = "";
  let reconnecting = false;
  const consumerByProducerId = new Map();
  const remoteStreams = new Map();

  function resetTransports() {
    consumerByProducerId.forEach((consumer) => {
      try {
        consumer.close();
      } catch {
        // ignore
      }
    });
    consumerByProducerId.clear();
    remoteStreams.clear();
    try {
      sendTransport?.close();
    } catch {
      // ignore
    }
    try {
      recvTransport?.close();
    } catch {
      // ignore
    }
    sendTransport = null;
    recvTransport = null;
  }

  function bindTransportFailure(transport) {
    if (!transport || typeof onTransportFailure !== "function") return;
    transport.on("connectionstatechange", (state) => {
      if (state === "failed" || state === "disconnected") {
        onTransportFailure?.({ roomId, state });
      }
    });
    transport.on("iceconnectionstatechange", (state) => {
      if (state === "failed" || state === "disconnected") {
        onTransportFailure?.({ roomId, state });
      }
    });
  }

  async function ensureDevice(rtpCapabilities) {
    if (device) return device;
    device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    return device;
  }

  async function ensureSendTransport() {
    if (sendTransport) return sendTransport;
    const { transport } = await emitAck(socket, "sfu-create-transport", { roomId });
    sendTransport = device.createSendTransport({
      ...transport,
      iceServers,
    });
    bindTransportFailure(sendTransport);
    sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      emitAck(socket, "sfu-connect-transport", {
        roomId,
        transportId: sendTransport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch((error) => errback(error));
    });
    sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
      emitAck(socket, "sfu-produce", {
        roomId,
        transportId: sendTransport.id,
        kind,
        rtpParameters,
      })
        .then(({ producerId }) => callback({ id: producerId }))
        .catch((error) => errback(error));
    });
    return sendTransport;
  }

  async function ensureRecvTransport() {
    if (recvTransport) return recvTransport;
    const { transport } = await emitAck(socket, "sfu-create-transport", { roomId });
    recvTransport = device.createRecvTransport({
      ...transport,
      iceServers,
    });
    bindTransportFailure(recvTransport);
    recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      emitAck(socket, "sfu-connect-transport", {
        roomId,
        transportId: recvTransport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch((error) => errback(error));
    });
    return recvTransport;
  }

  async function publishLocalTracks() {
    const stream = getLocalStream?.();
    if (!stream) return;
    const transport = await ensureSendTransport();
    for (const track of stream.getTracks()) {
      if (track.readyState !== "live") continue;
      try {
        await transport.produce({ track });
      } catch (error) {
        console.warn("[sfu] produce failed:", error);
      }
    }
  }

  async function consumeProducer({ producerId, socketId, kind }) {
    if (!producerId || consumerByProducerId.has(producerId)) return;
    await ensureRecvTransport();
    const consumed = await emitAck(socket, "sfu-consume", {
      roomId,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
      transportId: recvTransport.id,
    });
    const { consumer: consumerParams } = consumed;
    const consumer = await recvTransport.consume({
      id: consumerParams.id,
      producerId: consumerParams.producerId,
      kind: consumerParams.kind,
      rtpParameters: consumerParams.rtpParameters,
    });
    consumerByProducerId.set(producerId, consumer);
    await emitAck(socket, "sfu-resume-consumer", {
      roomId,
      consumerId: consumer.id,
    });
    await consumer.resume();

    const remoteSocketId = consumerParams.producerSocketId || socketId;
    let stream = remoteStreams.get(remoteSocketId);
    if (!stream) {
      stream = new MediaStream();
      remoteStreams.set(remoteSocketId, stream);
    }
    stream.addTrack(consumer.track);
    onParticipantStream?.(remoteSocketId, stream, {
      name: resolveParticipantName?.(remoteSocketId) || "Participant",
    });
  }

  async function joinRoom(nextRoomId) {
    roomId = String(nextRoomId || "");
    if (!roomId) throw new Error("roomId is required.");
    const joined = await emitAck(socket, "sfu-join", {
      roomId,
      rtpCapabilities: device?.rtpCapabilities,
    });
    await ensureDevice(joined.rtpCapabilities);
    await publishLocalTracks();
    for (const producer of joined.existingProducers || []) {
      await consumeProducer(producer);
    }
  }

  return {
    async join(nextRoomId) {
      resetTransports();
      await joinRoom(nextRoomId);
    },

    async reconnect(nextRoomId) {
      const targetRoom = String(nextRoomId || roomId || "");
      if (!targetRoom || reconnecting) return;
      reconnecting = true;
      try {
        resetTransports();
        roomId = targetRoom;
        await joinRoom(targetRoom);
      } finally {
        reconnecting = false;
      }
    },

    async handleNewProducer(payload) {
      if (payload?.roomId !== roomId) return;
      await consumeProducer(payload);
    },

    handlePeerLeft(payload) {
      const remoteSocketId = String(payload?.socketId || "");
      if (!remoteSocketId) return;
      remoteStreams.delete(remoteSocketId);
      onParticipantRemoved?.(remoteSocketId);
    },

    listParticipants() {
      return [...remoteStreams.entries()].map(([socketId, stream]) => ({
        socketId,
        stream,
      }));
    },

    close() {
      resetTransports();
      device = null;
      if (roomId) {
        socket?.emit?.("sfu-leave", { roomId });
      }
      roomId = "";
    },
  };
}
