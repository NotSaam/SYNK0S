import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DB } from "../db";
import { activity, boards, cards, columns } from "../db/schema";
import type { ActivityDTO, BoardState, CardDTO, ColumnDTO, Label, Op, Patch } from "../shared/protocol";
import { STEP } from "../shared/position";

export class OpError extends Error {}

export interface Actor {
  name: string;
  color: string;
}

const DEFAULT_COLUMNS = ["Por hacer", "En curso", "Revisión", "Hecho"];
const ACTIVITY_LIMIT = 40;

export function createBoard(db: DB, name: string): string {
  const id = nanoid(12);
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(boards).values({ id, name, createdAt: now, updatedAt: now }).run();
    DEFAULT_COLUMNS.forEach((title, i) => {
      tx.insert(columns)
        .values({ id: nanoid(12), boardId: id, title, position: (i + 1) * STEP })
        .run();
    });
  });
  return id;
}

export function boardExists(db: DB, boardId: string): boolean {
  return !!db.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).get();
}

function toCard(row: typeof cards.$inferSelect): CardDTO {
  return {
    id: row.id,
    columnId: row.columnId,
    title: row.title,
    description: row.description,
    label: (row.label as Label | null) ?? null,
    position: row.position,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.getTime(),
  };
}

function toColumn(row: typeof columns.$inferSelect): ColumnDTO {
  return { id: row.id, title: row.title, position: row.position };
}

function toActivity(row: typeof activity.$inferSelect): ActivityDTO {
  return { ...row, createdAt: row.createdAt.getTime() };
}

export function getState(db: DB, boardId: string): BoardState | null {
  const board = db.select().from(boards).where(eq(boards.id, boardId)).get();
  if (!board) return null;
  return {
    board: { id: board.id, name: board.name },
    columns: db.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.position)).all().map(toColumn),
    cards: db.select().from(cards).where(eq(cards.boardId, boardId)).orderBy(asc(cards.position)).all().map(toCard),
    activity: db
      .select()
      .from(activity)
      .where(eq(activity.boardId, boardId))
      .orderBy(desc(activity.createdAt))
      .limit(ACTIVITY_LIMIT)
      .all()
      .map(toActivity),
  };
}

/**
 * Aplica una operación ya validada. Cada consulta filtra también por boardId:
 * conocer el id de una tarjeta de otro tablero no permite tocarla (anti-IDOR).
 */
export function applyOp(
  db: DB,
  boardId: string,
  op: Op,
  actor: Actor,
): { patch: Patch; activity: ActivityDTO | null } {
  return db.transaction((tx) => {
    const now = new Date();
    let patch: Patch;
    let message: string | null = null;

    const getColumn = (id: string) => {
      const c = tx.select().from(columns).where(and(eq(columns.id, id), eq(columns.boardId, boardId))).get();
      if (!c) throw new OpError("La columna no existe");
      return c;
    };
    const getCard = (id: string) => {
      const c = tx.select().from(cards).where(and(eq(cards.id, id), eq(cards.boardId, boardId))).get();
      if (!c) throw new OpError("La tarjeta no existe");
      return c;
    };

    switch (op.type) {
      case "board.rename": {
        tx.update(boards).set({ name: op.name, updatedAt: now }).where(eq(boards.id, boardId)).run();
        patch = { kind: "board", board: { id: boardId, name: op.name } };
        message = `renombró el tablero a «${op.name}»`;
        break;
      }
      case "column.create": {
        const count = tx.select({ id: columns.id }).from(columns).where(eq(columns.boardId, boardId)).all().length;
        if (count >= 12) throw new OpError("Máximo 12 columnas por tablero");
        const exists = tx.select({ id: columns.id }).from(columns).where(eq(columns.id, op.id)).get();
        if (exists) throw new OpError("Id duplicado");
        const row = { id: op.id, boardId, title: op.title, position: op.position };
        tx.insert(columns).values(row).run();
        patch = { kind: "column.upsert", column: toColumn(row) };
        message = `creó la columna «${op.title}»`;
        break;
      }
      case "column.rename": {
        const col = getColumn(op.id);
        tx.update(columns).set({ title: op.title }).where(eq(columns.id, op.id)).run();
        patch = { kind: "column.upsert", column: toColumn({ ...col, title: op.title }) };
        message = `renombró «${col.title}» a «${op.title}»`;
        break;
      }
      case "column.delete": {
        const col = getColumn(op.id);
        tx.delete(columns).where(eq(columns.id, op.id)).run();
        patch = { kind: "column.delete", id: op.id };
        message = `eliminó la columna «${col.title}»`;
        break;
      }
      case "card.create": {
        const col = getColumn(op.columnId);
        const count = tx.select({ id: cards.id }).from(cards).where(eq(cards.boardId, boardId)).all().length;
        if (count >= 500) throw new OpError("Máximo 500 tarjetas por tablero");
        const exists = tx.select({ id: cards.id }).from(cards).where(eq(cards.id, op.id)).get();
        if (exists) throw new OpError("Id duplicado");
        const row = {
          id: op.id,
          boardId,
          columnId: op.columnId,
          title: op.title,
          description: "",
          label: null,
          position: op.position,
          createdBy: actor.name,
          createdAt: now,
          updatedAt: now,
        };
        tx.insert(cards).values(row).run();
        patch = { kind: "card.upsert", card: toCard(row) };
        message = `añadió «${op.title}» en ${col.title}`;
        break;
      }
      case "card.update": {
        const card = getCard(op.id);
        const next = {
          ...card,
          title: op.title ?? card.title,
          description: op.description ?? card.description,
          label: op.label === undefined ? card.label : op.label,
          updatedAt: now,
        };
        tx.update(cards)
          .set({ title: next.title, description: next.description, label: next.label, updatedAt: now })
          .where(eq(cards.id, op.id))
          .run();
        patch = { kind: "card.upsert", card: toCard(next) };
        // Las ediciones de texto no generan actividad: se guardan a cada pausa al escribir.
        if (op.title !== undefined && op.title !== card.title) message = `renombró «${card.title}» a «${op.title}»`;
        else if (op.label !== undefined && op.label !== card.label)
          message = op.label ? `etiquetó «${card.title}» como ${op.label}` : `quitó la etiqueta de «${card.title}»`;
        break;
      }
      case "card.move": {
        const card = getCard(op.id);
        const to = getColumn(op.columnId);
        tx.update(cards)
          .set({ columnId: op.columnId, position: op.position, updatedAt: now })
          .where(eq(cards.id, op.id))
          .run();
        patch = { kind: "card.upsert", card: toCard({ ...card, columnId: op.columnId, position: op.position, updatedAt: now }) };
        if (card.columnId !== op.columnId) message = `movió «${card.title}» a ${to.title}`;
        break;
      }
      case "card.delete": {
        const card = getCard(op.id);
        tx.delete(cards).where(eq(cards.id, op.id)).run();
        patch = { kind: "card.delete", id: op.id };
        message = `eliminó «${card.title}»`;
        break;
      }
    }

    let entry: ActivityDTO | null = null;
    if (message) {
      const row = { id: nanoid(12), boardId, actor: actor.name, color: actor.color, message, createdAt: now };
      tx.insert(activity).values(row).run();
      entry = toActivity(row);
    }
    tx.update(boards).set({ updatedAt: now }).where(eq(boards.id, boardId)).run();
    return { patch, activity: entry };
  });
}
