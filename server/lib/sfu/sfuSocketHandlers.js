import { GROUP_CALL_MODE } from "../groupCallConfig.js";
import { createMediasoupHub } from "./mediasoupHub.js";

const hub = createMediasoupHub();

function withAck(callback) {
  return async (payload, ack) => {
    try {
      const result = await callback(payload);
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (error) {
      console.warn("[sfu] socket action failed:", error?.message || error);
      if (typeof ack === "function") {
        ack({ ok: false, error: error?.message || "SFU action failed." });
      }
    }
  };
}

export function registerSfuSocketHandlers(io, socket) {
  if (GROUP_CALL_MODE !== "sfu") return () => {};

  const emitToRoomExcept = (roomId, excludeSocketId, event, data) => {
    socket.to(roomId).emit(event, data);
    if (excludeSocketId !== socket.id) {
      socket.emit(event, data);
    }
  };

  socket.on(
    "sfu-join",
    withAck(async ({ roomId, rtpCapabilities }) => {
      if (!roomId) throw new Error("roomId is required.");
      socket.join(roomId);
      const joined = await hub.joinRoom({
        roomId,
        socketId: socket.id,
        rtpCapabilities,
      });
      return joined;
    }),
  );

  socket.on(
    "sfu-create-transport",
    withAck(async ({ roomId }) => {
      const transport = await hub.createTransport({
        roomId,
        socketId: socket.id,
      });
      return { transport };
    }),
  );

  socket.on(
    "sfu-connect-transport",
    withAck(async ({ roomId, transportId, dtlsParameters }) => {
      await hub.connectTransport({
        roomId,
        socketId: socket.id,
        transportId,
        dtlsParameters,
      });
      return {};
    }),
  );

  socket.on(
    "sfu-produce",
    withAck(async ({ roomId, transportId, kind, rtpParameters }) => {
      const produced = await hub.produce({
        roomId,
        socketId: socket.id,
        transportId,
        kind,
        rtpParameters,
      });
      socket.to(roomId).emit("sfu-new-producer", {
        roomId,
        socketId: socket.id,
        producerId: produced.producerId,
        kind: produced.kind,
      });
      return produced;
    }),
  );

  socket.on(
    "sfu-consume",
    withAck(async ({ roomId, producerId, rtpCapabilities, transportId }) => {
      const consumed = await hub.consume({
        roomId,
        socketId: socket.id,
        producerId,
        rtpCapabilities,
        transportId,
      });
      return consumed;
    }),
  );

  socket.on(
    "sfu-resume-consumer",
    withAck(async ({ roomId, consumerId }) => {
      await hub.resumeConsumer({
        roomId,
        socketId: socket.id,
        consumerId,
      });
      return {};
    }),
  );

  socket.on("sfu-leave", ({ roomId }) => {
    if (!roomId) return;
    const removed = hub.leaveRoom(roomId, socket.id);
    socket.leave(roomId);
    socket.to(roomId).emit("sfu-peer-left", {
      roomId,
      socketId: socket.id,
      producerIds: removed,
    });
  });

  const onDisconnect = () => {
    for (const roomId of socket.rooms || []) {
      if (!String(roomId).startsWith("chat-")) continue;
      const removed = hub.leaveRoom(roomId, socket.id);
      socket.to(roomId).emit("sfu-peer-left", {
        roomId,
        socketId: socket.id,
        producerIds: removed,
      });
    }
  };

  socket.on("disconnect", onDisconnect);

  return () => {
    socket.off("disconnect", onDisconnect);
  };
}

export { hub as mediasoupHub };
