import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { DB } from "../db";
import {
  cursorSchema,
  focusSchema,
  joinSchema,
  opSchema,
  type ClientToServer,
  type PresenceUser,
  type ServerToClient,
} from "../shared/protocol";
import { applyOp, boardExists, getState, OpError } from "./board-service";
import { TokenBucket } from "./rate-limit";

interface SocketData {
  boardId?: string;
  user?: PresenceUser;
  opLimiter: TokenBucket;
  cursorLimiter: TokenBucket;
}

const room = (boardId: string) => `board:${boardId}`;

export function attachSocketServer(httpServer: HttpServer, db: DB) {
  const io = new Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>(httpServer, {
    path: "/socket",
    maxHttpBufferSize: 64 * 1024, // nadie necesita mandar más de 64 KB por mensaje
    // Sin CORS: el cliente se sirve desde el mismo origen que el socket.
  });

  const presence = (boardId: string): PresenceUser[] =>
    [...(io.sockets.adapter.rooms.get(room(boardId)) ?? [])]
      .map((sid) => io.sockets.sockets.get(sid)?.data.user)
      .filter((u): u is PresenceUser => !!u);

  const broadcastPresence = (boardId: string) => io.to(room(boardId)).emit("presence:list", presence(boardId));

  io.on("connection", (socket) => {
    socket.data.opLimiter = new TokenBucket(30, 10);
    socket.data.cursorLimiter = new TokenBucket(60, 40);

    socket.on("board:join", (raw, ack) => {
      if (typeof ack !== "function") return;
      const parsed = joinSchema.safeParse(raw);
      if (!parsed.success) return ack(false, "Datos de entrada no válidos");
      const { boardId, name, color } = parsed.data;
      if (!boardExists(db, boardId)) return ack(false, "Este tablero no existe");

      if (socket.data.boardId) {
        socket.leave(room(socket.data.boardId));
        io.to(room(socket.data.boardId)).emit("presence:leave", socket.id);
      }
      socket.data.boardId = boardId;
      socket.data.user = { sid: socket.id, name, color, focusCardId: null };
      socket.join(room(boardId));

      const state = getState(db, boardId);
      if (state) socket.emit("board:state", state);
      broadcastPresence(boardId);
      ack(true);
    });

    socket.on("board:op", (raw, ack) => {
      if (typeof ack !== "function") return;
      const { boardId, user } = socket.data;
      if (!boardId || !user) return ack(false, "No estás en ningún tablero");
      if (!socket.data.opLimiter.take()) return ack(false, "Vas demasiado rápido, espera un momento");
      const parsed = opSchema.safeParse(raw);
      if (!parsed.success) return ack(false, "Operación no válida");

      try {
        const result = applyOp(db, boardId, parsed.data, user);
        io.to(room(boardId)).emit("board:patch", result.patch, result.activity);
        ack(true);
      } catch (err) {
        if (err instanceof OpError) return ack(false, err.message);
        console.error("[op]", err);
        ack(false, "Error interno");
      }
    });

    socket.on("presence:cursor", (raw) => {
      const { boardId } = socket.data;
      if (!boardId || !socket.data.cursorLimiter.take()) return;
      const parsed = cursorSchema.safeParse(raw);
      if (!parsed.success) return;
      socket.to(room(boardId)).volatile.emit("presence:cursor", socket.id, parsed.data.x, parsed.data.y);
    });

    socket.on("presence:focus", (raw) => {
      const { boardId, user } = socket.data;
      if (!boardId || !user) return;
      const parsed = focusSchema.safeParse(raw);
      if (!parsed.success) return;
      user.focusCardId = parsed.data.cardId;
      broadcastPresence(boardId);
    });

    socket.on("disconnect", () => {
      const { boardId } = socket.data;
      if (!boardId) return;
      io.to(room(boardId)).emit("presence:leave", socket.id);
      broadcastPresence(boardId);
    });
  });

  return io;
}
