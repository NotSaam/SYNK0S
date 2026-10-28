import { z } from "zod";

/**
 * Protocolo cliente ↔ servidor. Todo lo que llega por el socket se valida
 * aquí antes de tocar la base de datos: el cliente nunca es de fiar.
 */

export const ID_RE = /^[A-Za-z0-9_-]{8,32}$/;
const id = z.string().regex(ID_RE, "id no válido");
const title = z.string().trim().min(1).max(120);
const position = z.number().finite().min(-1e9).max(1e9);

export const LABELS = ["feature", "bug", "urgente", "idea", "diseño"] as const;
export type Label = (typeof LABELS)[number];

export const COLORS = ["#2BC4B2", "#7C5CFF", "#4C9EFF", "#F2B84B", "#FF6B8A", "#5EE08A"] as const;

export const joinSchema = z.object({
  boardId: id,
  name: z.string().trim().min(1).max(24),
  color: z.enum(COLORS),
});

export const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("board.rename"), name: title }),
  z.object({ type: z.literal("column.create"), id, title, position }),
  z.object({ type: z.literal("column.rename"), id, title }),
  z.object({ type: z.literal("column.delete"), id }),
  z.object({ type: z.literal("card.create"), id, columnId: id, title, position }),
  z.object({
    type: z.literal("card.update"),
    id,
    title: title.optional(),
    description: z.string().max(4000).optional(),
    label: z.enum(LABELS).nullable().optional(),
  }),
  z.object({ type: z.literal("card.move"), id, columnId: id, position }),
  z.object({ type: z.literal("card.delete"), id }),
]);

export const cursorSchema = z.object({
  x: z.number().finite().min(0).max(100000),
  y: z.number().finite().min(0).max(100000),
});

export const focusSchema = z.object({ cardId: id.nullable() });

export type JoinPayload = z.infer<typeof joinSchema>;
export type Op = z.infer<typeof opSchema>;

export interface BoardDTO {
  id: string;
  name: string;
}
export interface ColumnDTO {
  id: string;
  title: string;
  position: number;
}
export interface CardDTO {
  id: string;
  columnId: string;
  title: string;
  description: string;
  label: Label | null;
  position: number;
  createdBy: string;
  updatedAt: number;
}
export interface ActivityDTO {
  id: string;
  actor: string;
  color: string;
  message: string;
  createdAt: number;
}
export interface BoardState {
  board: BoardDTO;
  columns: ColumnDTO[];
  cards: CardDTO[];
  activity: ActivityDTO[];
}
export interface PresenceUser {
  sid: string;
  name: string;
  color: string;
  focusCardId: string | null;
}

/** Cambio ya aplicado que el servidor difunde a toda la sala. */
export type Patch =
  | { kind: "board"; board: BoardDTO }
  | { kind: "column.upsert"; column: ColumnDTO }
  | { kind: "column.delete"; id: string }
  | { kind: "card.upsert"; card: CardDTO }
  | { kind: "card.delete"; id: string };

export interface ServerToClient {
  "board:state": (state: BoardState) => void;
  "board:patch": (patch: Patch, activity: ActivityDTO | null) => void;
  "board:error": (message: string) => void;
  "presence:list": (users: PresenceUser[]) => void;
  "presence:cursor": (sid: string, x: number, y: number) => void;
  "presence:leave": (sid: string) => void;
}

export interface ClientToServer {
  "board:join": (payload: JoinPayload, ack: (ok: boolean, error?: string) => void) => void;
  "board:op": (op: Op, ack: (ok: boolean, error?: string) => void) => void;
  "presence:cursor": (pos: { x: number; y: number }) => void;
  "presence:focus": (payload: { cardId: string | null }) => void;
}
