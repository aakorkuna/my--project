import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function newRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** @type {Map<string, {code: string, hostId: string, playerCount: number, started: boolean, players: Map<string, number>, state: any | null}>} */
const rooms = new Map();

function rosterSnapshot(room) {
  const indices = Array.from(room.players.values()).filter((n) => Number.isFinite(n));
  indices.sort((a, b) => a - b);
  return {
    roomCode: room.code,
    playerCount: room.playerCount,
    connected: room.players.size,
    indices,
    started: room.started,
  };
}

function broadcastRoster(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("room:roster", rosterSnapshot(room));
}

function lobbySnapshot() {
  const list = [];
  for (const room of rooms.values()) {
    const connected = room.players.size;
    const openSeats = Math.max(0, room.playerCount - connected);
    // Only show rooms that are joinable right now.
    if (room.started) continue;
    if (openSeats <= 0) continue;
    list.push({
      roomCode: room.code,
      playerCount: room.playerCount,
      connected,
      openSeats,
    });
  }
  list.sort((a, b) => a.roomCode.localeCompare(b.roomCode));
  return list;
}

function broadcastLobbies() {
  io.emit("lobbies:update", { lobbies: lobbySnapshot() });
}

await app.prepare();

const httpServer = createServer((req, res) => handle(req, res));

const io = new Server(httpServer, {
  // Same-origin in LAN; this keeps things simple for dev.
  cors: { origin: true, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  // Send the current lobby list immediately.
  socket.emit("lobbies:update", { lobbies: lobbySnapshot() });

  socket.on("lobbies:list", (_payload, ack) => {
    ack?.({ ok: true, lobbies: lobbySnapshot() });
  });

  socket.on("room:create", (payload, ack) => {
    try {
      const pcRaw = payload && typeof payload === "object" ? payload.playerCount : 2;
      const playerCount = Math.max(1, Math.min(5, Math.floor(Number(pcRaw) || 2)));

      let code = newRoomCode();
      while (rooms.has(code)) code = newRoomCode();

      const players = new Map();
      players.set(socket.id, 0);

      rooms.set(code, {
        code,
        hostId: socket.id,
        playerCount,
        started: false,
        players,
        state: null,
      });

      socket.join(code);
      broadcastLobbies();
      broadcastRoster(code);

      const room = rooms.get(code);
      if (room) {
        // Ensure creator gets the roster even if their client sets roomCode slightly later.
        socket.emit("room:roster", rosterSnapshot(room));
      }

      ack?.({
        ok: true,
        roomCode: code,
        playerIndex: 0,
        playerCount,
        isHost: true,
        started: false,
        roster: room ? rosterSnapshot(room) : null,
        state: room ? room.state : null,
      });
    } catch (e) {
      ack?.({ ok: false, reason: e instanceof Error ? e.message : "Failed to create room" });
    }
  });

  socket.on("room:join", (payload, ack) => {
    try {
      const roomCode = payload && typeof payload === "object" ? String(payload.roomCode || "") : "";
      const code = roomCode.trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack?.({ ok: false, reason: "Room not found" });

      const used = new Set(room.players.values());
      let nextIdx = -1;
      for (let i = 0; i < room.playerCount; i++) {
        if (!used.has(i)) {
          nextIdx = i;
          break;
        }
      }
      if (nextIdx < 0) return ack?.({ ok: false, reason: "Room is full" });

      room.players.set(socket.id, nextIdx);
      socket.join(code);

      broadcastLobbies();

      // Notify host that a player joined (so host can show count if desired)
      io.to(room.hostId).emit("room:player_joined", { playerIndex: nextIdx });

      broadcastRoster(code);

      // Push current roster/state to the joining socket so it can render the right screen immediately.
      socket.emit("room:roster", rosterSnapshot(room));
      if (room.state) socket.emit("room:state", { state: room.state });
      if (room.started) socket.emit("room:started", { roomCode: code });

      ack?.({
        ok: true,
        roomCode: code,
        playerIndex: nextIdx,
        playerCount: room.playerCount,
        isHost: false,
        started: room.started,
        roster: rosterSnapshot(room),
        state: room.state,
      });
    } catch (e) {
      ack?.({ ok: false, reason: e instanceof Error ? e.message : "Failed to join room" });
    }
  });

  socket.on("room:start", (payload, ack) => {
    try {
      const roomCode = payload && typeof payload === "object" ? String(payload.roomCode || "") : "";
      const code = roomCode.trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack?.({ ok: false, reason: "Room not found" });
      if (room.hostId !== socket.id) return ack?.({ ok: false, reason: "Only host can start" });
      if (room.started) return ack?.({ ok: true });

      room.started = true;
      io.to(code).emit("room:started", { roomCode: code });
      broadcastLobbies();
      broadcastRoster(code);
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, reason: e instanceof Error ? e.message : "Failed to start" });
    }
  });

  socket.on("room:state", (payload) => {
    // Host sends authoritative snapshot; server caches and broadcasts.
    try {
      if (!payload || typeof payload !== "object") return;
      const code = String(payload.roomCode || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return;
      if (room.hostId !== socket.id) return;

      room.state = payload.state ?? null;
      io.to(code).emit("room:state", { state: room.state });
    } catch {
      // ignore
    }
  });

  socket.on("room:action", (payload, ack) => {
    // Non-host clients send actions; server forwards to host.
    try {
      if (!payload || typeof payload !== "object") return ack?.({ ok: false, reason: "Invalid action" });
      const code = String(payload.roomCode || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack?.({ ok: false, reason: "Room not found" });

      const fromPlayerIndex = room.players.get(socket.id);
      if (typeof fromPlayerIndex !== "number") return ack?.({ ok: false, reason: "Not in room" });

      io.to(room.hostId).emit("room:action", { fromPlayerIndex, action: payload.action });
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, reason: e instanceof Error ? e.message : "Failed to forward" });
    }
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      if (!room.players.has(socket.id)) continue;

      const wasHost = room.hostId === socket.id;
      room.players.delete(socket.id);

      if (wasHost) {
        io.to(code).emit("room:closed", { reason: "Host disconnected" });
        rooms.delete(code);
        broadcastLobbies();
      } else {
        io.to(room.hostId).emit("room:player_left", { playerIndex: null });
        broadcastLobbies();
        broadcastRoster(code);
      }
    }
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`[server] Listening on http://${hostname}:${port}`);
});
