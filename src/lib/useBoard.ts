"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { applyPatch } from "@/shared/apply-patch";
import type { BoardState, ClientToServer, Op, Patch, PresenceUser, ServerToClient } from "@/shared/protocol";
import type { Identity } from "./identity";

type ClientSocket = Socket<ServerToClient, ClientToServer>;
export type ConnectionStatus = "connecting" | "online" | "offline" | "error";

export interface RemoteCursor {
  x: number;
  y: number;
  at: number;
}

/** Traduce una operación a su patch para aplicarla en local antes de que responda el servidor. */
function optimisticPatch(state: BoardState, op: Op, identity: Identity): Patch | null {
  switch (op.type) {
    case "board.rename":
      return { kind: "board", board: { ...state.board, name: op.name } };
    case "column.create":
      return { kind: "column.upsert", column: { id: op.id, title: op.title, position: op.position } };
    case "column.rename": {
      const col = state.columns.find((c) => c.id === op.id);
      return col ? { kind: "column.upsert", column: { ...col, title: op.title } } : null;
    }
    case "column.delete":
      return { kind: "column.delete", id: op.id };
    case "card.create":
      return {
        kind: "card.upsert",
        card: {
          id: op.id,
          columnId: op.columnId,
          title: op.title,
          description: "",
          label: null,
          position: op.position,
          createdBy: identity.name,
          updatedAt: Date.now(),
        },
      };
    case "card.update": {
      const card = state.cards.find((c) => c.id === op.id);
      if (!card) return null;
      return {
        kind: "card.upsert",
        card: {
          ...card,
          title: op.title ?? card.title,
          description: op.description ?? card.description,
          label: op.label === undefined ? card.label : op.label,
          updatedAt: Date.now(),
        },
      };
    }
    case "card.move": {
      const card = state.cards.find((c) => c.id === op.id);
      return card ? { kind: "card.upsert", card: { ...card, columnId: op.columnId, position: op.position } } : null;
    }
    case "card.delete":
      return { kind: "card.delete", id: op.id };
  }
}

export function useBoard(boardId: string, identity: Identity | null) {
  const [state, setState] = useState<BoardState | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<ClientSocket | null>(null);
  const stateRef = useRef<BoardState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    if (!identity) return;
    const socket: ClientSocket = io({ path: "/socket", transports: ["websocket"] });
    socketRef.current = socket;

    const join = () =>
      socket.emit("board:join", { boardId, name: identity.name, color: identity.color }, (ok, err) => {
        if (ok) {
          setStatus("online");
          setError(null);
        } else {
          setStatus("error");
          setError(err ?? "No se pudo entrar al tablero");
        }
      });

    socket.on("connect", join);
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("connect_error", () => setStatus("offline"));
    socket.on("board:state", (s) => setState(s));
    socket.on("board:patch", (patch, activity) => setState((s) => (s ? applyPatch(s, patch, activity) : s)));
    socket.on("presence:list", (users) => {
      setPresence(users);
      setCursors((c) => Object.fromEntries(Object.entries(c).filter(([sid]) => users.some((u) => u.sid === sid))));
    });
    socket.on("presence:cursor", (sid, x, y) => setCursors((c) => ({ ...c, [sid]: { x, y, at: Date.now() } })));
    socket.on("presence:leave", (sid) =>
      setCursors((c) => {
        const { [sid]: _gone, ...rest } = c;
        return rest;
      }),
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, identity]);

  // Los cursores inactivos se desvanecen a los 5 s
  useEffect(() => {
    const t = setInterval(() => {
      const limit = Date.now() - 5000;
      setCursors((c) => {
        const alive = Object.entries(c).filter(([, v]) => v.at > limit);
        return alive.length === Object.keys(c).length ? c : Object.fromEntries(alive);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const send = useCallback(
    (op: Op) => {
      const socket = socketRef.current;
      const current = stateRef.current;
      if (!socket || !current || !identity) return;
      const patch = optimisticPatch(current, op, identity);
      if (patch) setState((s) => (s ? applyPatch(s, patch) : s));
      socket.emit("board:op", op, (ok, err) => {
        if (ok) return;
        setToast(err ?? "No se pudo guardar el cambio");
        // Rechazado: volvemos a pedir el estado real al servidor
        socket.emit("board:join", { boardId, name: identity.name, color: identity.color }, () => {});
      });
    },
    [boardId, identity],
  );

  /** Cambios solo locales mientras se arrastra (no se envían). */
  const setLocal = useCallback((fn: (s: BoardState) => BoardState) => setState((s) => (s ? fn(s) : s)), []);

  const lastCursor = useRef(0);
  const sendCursor = useCallback((x: number, y: number) => {
    const now = performance.now();
    if (now - lastCursor.current < 33) return; // ~30 fps
    lastCursor.current = now;
    socketRef.current?.emit("presence:cursor", { x: Math.round(x), y: Math.round(y) });
  }, []);

  const sendFocus = useCallback((cardId: string | null) => {
    socketRef.current?.emit("presence:focus", { cardId });
  }, []);

  const selfSid = socketRef.current?.id ?? null;

  return { state, presence, cursors, status, error, toast, send, setLocal, sendCursor, sendFocus, selfSid };
}
