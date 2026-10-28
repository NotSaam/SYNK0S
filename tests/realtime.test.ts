import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { createDb, type DB } from "../src/db";
import { createBoard, getState } from "../src/server/board-service";
import { attachSocketServer } from "../src/server/socket";
import { COLORS, type BoardState, type ClientToServer, type Op, type Patch, type PresenceUser, type ServerToClient } from "../src/shared/protocol";

type Client = Socket<ServerToClient, ClientToServer>;

let http: HttpServer;
let db: DB;
let url: string;
let boardId: string;
const clients: Client[] = [];

beforeEach(async () => {
  db = createDb(":memory:");
  boardId = createBoard(db, "Realtime");
  http = createServer();
  attachSocketServer(http, db);
  await new Promise<void>((r) => http.listen(0, r));
  url = `http://localhost:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await new Promise((r) => http.close(r));
});

function once<E extends keyof ServerToClient>(c: Client, event: E): Promise<Parameters<ServerToClient[E]>> {
  return new Promise((resolve) => c.once(event, ((...args: unknown[]) => resolve(args as never)) as never));
}

async function join(name: string, color: (typeof COLORS)[number] = "#2BC4B2"): Promise<{ c: Client; state: BoardState }> {
  const c: Client = connect(url, { path: "/socket", transports: ["websocket"], forceNew: true });
  clients.push(c);
  const statePromise = once(c, "board:state");
  const ok = await new Promise<boolean>((r) => c.emit("board:join", { boardId, name, color }, (ok) => r(ok)));
  expect(ok).toBe(true);
  const [state] = await statePromise;
  return { c, state };
}

const op = (c: Client, o: Op) =>
  new Promise<{ ok: boolean; error?: string }>((r) => c.emit("board:op", o, (ok, error) => r({ ok, error })));

describe("sincronización en tiempo real", () => {
  it("un cambio de A le llega a B con su actividad", async () => {
    const a = await join("Ana");
    const b = await join("Bruno", "#7C5CFF");
    const col = a.state.columns[0];

    const received = once(b.c, "board:patch");
    expect((await op(a.c, { type: "card.create", id: "rt_card_01", columnId: col.id, title: "Deploy", position: 1 })).ok).toBe(true);
    const [patch, activity] = (await received) as [Patch, { actor: string } | null];

    expect(patch).toMatchObject({ kind: "card.upsert", card: { id: "rt_card_01", title: "Deploy", createdBy: "Ana" } });
    expect(activity?.actor).toBe("Ana");
    expect(getState(db, boardId)!.cards).toHaveLength(1);
  });

  it("la presencia refleja quién entra, qué tarjeta edita y quién sale", async () => {
    const a = await join("Ana");
    const listAfterB = once(a.c, "presence:list");
    const b = await join("Bruno", "#7C5CFF");
    let [users] = (await listAfterB) as [PresenceUser[]];
    expect(users.map((u) => u.name).sort()).toEqual(["Ana", "Bruno"]);

    const focused = once(a.c, "presence:list");
    b.c.emit("presence:focus", { cardId: "rt_card_01" });
    [users] = (await focused) as [PresenceUser[]];
    expect(users.find((u) => u.name === "Bruno")?.focusCardId).toBe("rt_card_01");

    const left = once(a.c, "presence:leave");
    b.c.disconnect();
    const [sid] = await left;
    expect(typeof sid).toBe("string");
  });

  it("reenvía los cursores al resto pero no al emisor", async () => {
    const a = await join("Ana");
    const b = await join("Bruno", "#7C5CFF");
    let selfEcho = false;
    a.c.on("presence:cursor", () => (selfEcho = true));
    const got = once(b.c, "presence:cursor");
    a.c.emit("presence:cursor", { x: 120, y: 80 });
    const [, x, y] = await got;
    expect([x, y]).toEqual([120, 80]);
    await new Promise((r) => setTimeout(r, 50));
    expect(selfEcho).toBe(false);
  });

  it("rechaza operaciones inválidas y de otros tableros", async () => {
    const a = await join("Ana");
    expect((await op(a.c, { type: "card.delete", id: "no_existe_1" })).ok).toBe(false);
    expect((await op(a.c, { type: "nope" } as unknown as Op)).ok).toBe(false);
  });

  it("no deja entrar en tableros que no existen", async () => {
    const c: Client = connect(url, { path: "/socket", transports: ["websocket"], forceNew: true });
    clients.push(c);
    const res = await new Promise<{ ok: boolean; err?: string }>((r) =>
      c.emit("board:join", { boardId: "inexistente1", name: "X", color: "#2BC4B2" }, (ok, err) => r({ ok, err })),
    );
    expect(res).toEqual({ ok: false, err: "Este tablero no existe" });
  });

  it("aplica rate limiting a quien inunda de operaciones", async () => {
    const a = await join("Ana");
    const results = await Promise.all(
      Array.from({ length: 60 }, () => op(a.c, { type: "board.rename", name: "spam" })),
    );
    expect(results.filter((r) => !r.ok).length).toBeGreaterThan(0);
  });
});
