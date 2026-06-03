import mediasoup from "mediasoup";
import { readEnvString } from "../../settings/env.js";

const MEDIA_CODECS = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: { "x-google-start-bitrate": 1000 },
  },
];

function getListenIps() {
  const listenIp = readEnvString("MEDIASOUP_LISTEN_IP", "0.0.0.0");
  const announcedIp = readEnvString("MEDIASOUP_ANNOUNCED_IP", "");
  const entry = { ip: listenIp };
  if (announcedIp) entry.announcedIp = announcedIp;
  return [entry];
}

/** @type {import("mediasoup").types.Worker | null} */
let worker = null;
/** @type {Map<string, { router: import("mediasoup").types.Router, peers: Map<string, PeerState> }>} */
const rooms = new Map();

/**
 * @typedef {object} PeerState
 * @property {string} socketId
 * @property {import("mediasoup-client").types.RtpCapabilities | null} rtpCapabilities
 * @property {Map<string, import("mediasoup").types.WebRtcTransport>} transports
 * @property {Map<string, import("mediasoup").types.Producer>} producers
 * @property {Map<string, import("mediasoup").types.Consumer>} consumers
 */

async function ensureWorker() {
  if (worker) return worker;
  worker = await mediasoup.createWorker({
    logLevel: "warn",
    rtcMinPort: Number(process.env.MEDIASOUP_RTC_MIN_PORT || 40000),
    rtcMaxPort: Number(process.env.MEDIASOUP_RTC_MAX_PORT || 49999),
  });
  worker.on("died", () => {
    console.error("[sfu] mediasoup worker died");
    worker = null;
    rooms.clear();
  });
  return worker;
}

async function getOrCreateRoom(roomId) {
  const id = String(roomId || "");
  if (!id) throw new Error("Room id is required.");
  let room = rooms.get(id);
  if (room) return room;
  const activeWorker = await ensureWorker();
  const router = await activeWorker.createRouter({ mediaCodecs: MEDIA_CODECS });
  room = { router, peers: new Map() };
  rooms.set(id, room);
  return room;
}

function getPeer(room, socketId) {
  const id = String(socketId || "");
  if (!room.peers.has(id)) {
    room.peers.set(id, {
      socketId: id,
      rtpCapabilities: null,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });
  }
  return room.peers.get(id);
}

function serializeTransport(transport) {
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

function listProducers(room, excludeSocketId = "") {
  const items = [];
  for (const [socketId, peer] of room.peers.entries()) {
    if (socketId === excludeSocketId) continue;
    for (const [producerId, producer] of peer.producers.entries()) {
      items.push({
        producerId,
        socketId,
        kind: producer.kind,
      });
    }
  }
  return items;
}

async function createWebRtcTransport(room, peer) {
  const transport = await room.router.createWebRtcTransport({
    listenIps: getListenIps(),
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  });
  peer.transports.set(transport.id, transport);
  transport.on("dtlsstatechange", (state) => {
    if (state === "closed") {
      transport.close();
      peer.transports.delete(transport.id);
    }
  });
  return transport;
}

function removePeer(roomId, socketId) {
  const room = rooms.get(String(roomId || ""));
  if (!room) return [];
  const peer = room.peers.get(String(socketId || ""));
  if (!peer) return [];
  const removedProducerIds = [...peer.producers.keys()];
  peer.consumers.forEach((consumer) => {
    try {
      consumer.close();
    } catch {
      // ignore
    }
  });
  peer.producers.forEach((producer) => {
    try {
      producer.close();
    } catch {
      // ignore
    }
  });
  peer.transports.forEach((transport) => {
    try {
      transport.close();
    } catch {
      // ignore
    }
  });
  room.peers.delete(String(socketId || ""));
  if (room.peers.size === 0) {
    try {
      room.router.close();
    } catch {
      // ignore
    }
    rooms.delete(String(roomId || ""));
  }
  return removedProducerIds;
}

export function createMediasoupHub() {
  return {
    async joinRoom({ roomId, socketId, rtpCapabilities }) {
      const room = await getOrCreateRoom(roomId);
      const peer = getPeer(room, socketId);
      peer.rtpCapabilities = rtpCapabilities || null;
      return {
        rtpCapabilities: room.router.rtpCapabilities,
        existingProducers: listProducers(room, socketId),
      };
    },

    async createTransport({ roomId, socketId }) {
      const room = await getOrCreateRoom(roomId);
      const peer = getPeer(room, socketId);
      const transport = await createWebRtcTransport(room, peer);
      return serializeTransport(transport);
    },

    async connectTransport({ roomId, socketId, transportId, dtlsParameters }) {
      const room = rooms.get(String(roomId || ""));
      if (!room) throw new Error("SFU room not found.");
      const peer = room.peers.get(String(socketId || ""));
      const transport = peer?.transports.get(String(transportId || ""));
      if (!transport) throw new Error("Transport not found.");
      await transport.connect({ dtlsParameters });
      return { connected: true };
    },

    async produce({ roomId, socketId, transportId, kind, rtpParameters }) {
      const room = rooms.get(String(roomId || ""));
      if (!room) throw new Error("SFU room not found.");
      const peer = room.peers.get(String(socketId || ""));
      const transport = peer?.transports.get(String(transportId || ""));
      if (!transport) throw new Error("Transport not found.");
      const producer = await transport.produce({ kind, rtpParameters });
      peer.producers.set(producer.id, producer);
      producer.on("transportclose", () => {
        peer.producers.delete(producer.id);
      });
      return { producerId: producer.id, kind: producer.kind };
    },

    async consume({
      roomId,
      socketId,
      producerId,
      rtpCapabilities,
      transportId,
    }) {
      const room = rooms.get(String(roomId || ""));
      if (!room) throw new Error("SFU room not found.");
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error("Cannot consume producer.");
      }
      const peer = getPeer(room, socketId);
      let transport = transportId
        ? peer.transports.get(String(transportId))
        : null;
      if (!transport) {
        transport = await createWebRtcTransport(room, peer);
      }
      const producerEntry = [...room.peers.values()]
        .flatMap((entry) => [...entry.producers.entries()])
        .find(([id]) => id === producerId);
      if (!producerEntry) throw new Error("Producer not found.");
      const producer = producerEntry[1];
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });
      peer.consumers.set(consumer.id, consumer);
      consumer.on("transportclose", () => {
        peer.consumers.delete(consumer.id);
      });
      consumer.on("producerclose", () => {
        peer.consumers.delete(consumer.id);
      });
      return {
        transport: serializeTransport(transport),
        consumer: {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          producerSocketId: [...room.peers.entries()].find(([, p]) =>
            p.producers.has(producerId),
          )?.[0],
        },
      };
    },

    async resumeConsumer({ roomId, socketId, consumerId }) {
      const room = rooms.get(String(roomId || ""));
      const peer = room?.peers.get(String(socketId || ""));
      const consumer = peer?.consumers.get(String(consumerId || ""));
      if (!consumer) throw new Error("Consumer not found.");
      await consumer.resume();
      return { resumed: true };
    },

    leaveRoom(roomId, socketId) {
      return removePeer(roomId, socketId);
    },

    getRoomPeerCount(roomId) {
      return rooms.get(String(roomId || ""))?.peers.size || 0;
    },
  };
}

export async function closeMediasoupHub() {
  for (const [roomId] of rooms) {
    removePeer(roomId, "");
    rooms.delete(roomId);
  }
  if (worker) {
    worker.close();
    worker = null;
  }
}
