import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type DB } from "../src/db";
import { applyOp, createBoard, getState, OpError } from "../src/server/board-service";
import { opSchema } from "../src/shared/protocol";
import { applyPatch } from "../src/shared/apply-patch";

const ana = { name: "Ana", color: "#2BC4B2" };
let db: DB;
let boardId: string;

beforeEach(() => {
  db = createDb(":memory:");
  boardId = createBoard(db, "Sprint 1");
});

const firstColumn = () => getState(db, boardId)!.columns[0];

describe("createBoard", () => {
  it("crea el tablero con cuatro columnas ordenadas", () => {
    const s = getState(db, boardId)!;
    expect(s.board.name).toBe("Sprint 1");
    expect(s.columns.map((c) => c.title)).toEqual(["Por hacer", "En curso", "Revisión", "Hecho"]);
  });
});

describe("applyOp", () => {
  it("crea, mueve y borra una tarjeta registrando actividad", () => {
    const [todo, doing] = getState(db, boardId)!.columns;
    applyOp(db, boardId, { type: "card.create", id: "card_000001", columnId: todo.id, title: "Login", position: 1024 }, ana);
    const moved = applyOp(db, boardId, { type: "card.move", id: "card_000001", columnId: doing.id, position: 512 }, ana);
    expect(moved.patch).toMatchObject({ kind: "card.upsert", card: { columnId: doing.id, position: 512 } });
    expect(moved.activity?.message).toContain("En curso");

    applyOp(db, boardId, { type: "card.delete", id: "card_000001" }, ana);
    const s = getState(db, boardId)!;
    expect(s.cards).toHaveLength(0);
    expect(s.activity).toHaveLength(3);
  });

  it("no deja tocar tarjetas de otro tablero aunque se conozca el id (IDOR)", () => {
    const other = createBoard(db, "Ajeno");
    const otherCol = getState(db, other)!.columns[0];
    applyOp(db, other, { type: "card.create", id: "secret_0001", columnId: otherCol.id, title: "Privada", position: 1 }, ana);

    expect(() => applyOp(db, boardId, { type: "card.delete", id: "secret_0001" }, ana)).toThrow(OpError);
    expect(() =>
      applyOp(db, boardId, { type: "card.move", id: "secret_0001", columnId: firstColumn().id, position: 1 }, ana),
    ).toThrow(OpError);
    expect(getState(db, other)!.cards).toHaveLength(1);
  });

  it("rechaza ids duplicados", () => {
    const col = firstColumn();
    applyOp(db, boardId, { type: "card.create", id: "dup_000001", columnId: col.id, title: "A", position: 1 }, ana);
    expect(() =>
      applyOp(db, boardId, { type: "card.create", id: "dup_000001", columnId: col.id, title: "B", position: 2 }, ana),
    ).toThrow(OpError);
  });

  it("borrar una columna borra sus tarjetas en cascada", () => {
    const col = firstColumn();
    applyOp(db, boardId, { type: "card.create", id: "casc_00001", columnId: col.id, title: "A", position: 1 }, ana);
    applyOp(db, boardId, { type: "column.delete", id: col.id }, ana);
    const s = getState(db, boardId)!;
    expect(s.columns).toHaveLength(3);
    expect(s.cards).toHaveLength(0);
  });

  it("editar la descripción no llena la actividad", () => {
    const col = firstColumn();
    applyOp(db, boardId, { type: "card.create", id: "desc_00001", columnId: col.id, title: "A", position: 1 }, ana);
    const r = applyOp(db, boardId, { type: "card.update", id: "desc_00001", description: "texto" }, ana);
    expect(r.activity).toBeNull();
  });
});

describe("opSchema", () => {
  it("rechaza entradas maliciosas o fuera de rango", () => {
    expect(opSchema.safeParse({ type: "card.delete", id: "../../etc" }).success).toBe(false);
    expect(opSchema.safeParse({ type: "card.create", id: "abcdefgh", columnId: "abcdefgh", title: "", position: 1 }).success).toBe(false);
    expect(opSchema.safeParse({ type: "card.move", id: "abcdefgh", columnId: "abcdefgh", position: Infinity }).success).toBe(false);
    expect(opSchema.safeParse({ type: "card.update", id: "abcdefgh", label: "hackeado" }).success).toBe(false);
    expect(opSchema.safeParse({ type: "drop.table" }).success).toBe(false);
  });
});

describe("applyPatch", () => {
  it("es idempotente: aplicar el eco del servidor dos veces no duplica nada", () => {
    const col = firstColumn();
    const { patch, activity } = applyOp(
      db,
      boardId,
      { type: "card.create", id: "idem_00001", columnId: col.id, title: "A", position: 1 },
      ana,
    );
    const base = getState(db, boardId)!;
    const once = applyPatch({ ...base, cards: [], activity: [] }, patch, activity);
    const twice = applyPatch(once, patch, activity);
    expect(twice.cards).toHaveLength(1);
    expect(twice.activity).toHaveLength(1);
  });
});
