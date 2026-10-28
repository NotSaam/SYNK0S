"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useBoard } from "@/lib/useBoard";
import { loadIdentity, rememberBoard, saveIdentity, type Identity } from "@/lib/identity";
import { byPosition, positionAt, positionBetween } from "@/shared/position";
import type { BoardState, CardDTO } from "@/shared/protocol";
import { ActivityPanel } from "./ActivityPanel";
import { Avatar } from "./Avatar";
import { CardBody } from "./CardItem";
import { CardModal } from "./CardModal";
import { ColumnView } from "./ColumnView";
import { Cursors } from "./Cursors";
import { InlineEdit } from "./InlineEdit";
import { Wordmark } from "./Logo";
import { NameGate } from "./NameGate";

const STATUS_TEXT = {
  connecting: ["conectando", "#F2B84B"],
  online: ["en línea", "#2BC4B2"],
  offline: ["reconectando", "#F2B84B"],
  error: ["error", "#FF6B8A"],
} as const;

export function BoardScreen({ boardId }: { boardId: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setIdentity(loadIdentity());
    setReady(true);
  }, []);

  const { state, presence, cursors, status, error, toast, send, setLocal, sendCursor, sendFocus, selfSid } = useBoard(
    boardId,
    identity,
  );
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dragSnapshot = useRef<BoardState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state) rememberBoard(state.board);
  }, [state?.board.id, state?.board.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sendFocus(openCardId);
  }, [openCardId, sendFocus]);

  const columns = useMemo(() => (state ? [...state.columns].sort(byPosition) : []), [state]);
  const cardsByColumn = useMemo(() => {
    const map = new Map<string, CardDTO[]>();
    for (const col of columns) map.set(col.id, []);
    for (const card of state?.cards ?? []) map.get(card.columnId)?.push(card);
    for (const list of map.values()) list.sort(byPosition);
    return map;
  }, [state, columns]);

  const others = presence.filter((p) => p.sid !== selfSid);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Drag & drop ─────────────────────────────────────────────
  const columnOf = useCallback(
    (overId: string | undefined, overData: Record<string, unknown> | undefined) => {
      if (!overId) return null;
      if (overData?.type === "column") return overData.columnId as string;
      return state?.cards.find((c) => c.id === overId)?.columnId ?? null;
    },
    [state],
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    dragSnapshot.current = state;
  }

  // Al cruzar a otra columna, la movemos en local para que el hueco aparezca en su sitio
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || !state) return;
    const card = state.cards.find((c) => c.id === active.id);
    const toColumn = columnOf(String(over.id), over.data.current);
    if (!card || !toColumn || toColumn === card.columnId) return;
    const target = (cardsByColumn.get(toColumn) ?? []).filter((c) => c.id !== card.id);
    const overIndex = target.findIndex((c) => c.id === over.id);
    const position = positionAt(target, overIndex === -1 ? target.length : overIndex);
    setLocal((s) => ({
      ...s,
      cards: s.cards.map((c) => (c.id === card.id ? { ...c, columnId: toColumn, position } : c)),
    }));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const before = dragSnapshot.current?.cards.find((c) => c.id === active.id);
    dragSnapshot.current = null;
    if (!over || !state || !before) return;

    const card = state.cards.find((c) => c.id === active.id);
    if (!card) return;
    const columnId = card.columnId;
    const list = cardsByColumn.get(columnId) ?? [];
    const oldIndex = list.findIndex((c) => c.id === card.id);
    const overIndex = list.findIndex((c) => c.id === over.id);
    const newIndex = overIndex === -1 ? list.length - 1 : overIndex;
    const moved = arrayMove(list, oldIndex, newIndex);
    const i = moved.findIndex((c) => c.id === card.id);
    const position = positionBetween(moved[i - 1]?.position ?? null, moved[i + 1]?.position ?? null);

    if (before.columnId === columnId && before.position === position) return;
    send({ type: "card.move", id: card.id, columnId, position });
  }

  function onDragCancel() {
    if (dragSnapshot.current) {
      const snap = dragSnapshot.current;
      setLocal(() => snap);
    }
    dragSnapshot.current = null;
    setActiveId(null);
  }

  // ── Acciones ────────────────────────────────────────────────
  function addCard(columnId: string, title: string) {
    const list = cardsByColumn.get(columnId) ?? [];
    send({ type: "card.create", id: nanoid(12), columnId, title, position: positionAt(list, list.length) });
  }

  function addColumn() {
    send({ type: "column.create", id: nanoid(12), title: "Nueva columna", position: positionAt(columns, columns.length) });
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* el navegador no deja copiar: la URL sigue en la barra */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    sendCursor(e.clientX - rect.left + el.scrollLeft, e.clientY - rect.top + el.scrollTop);
  }

  // ── Render ──────────────────────────────────────────────────
  if (!ready) return null;
  if (!identity)
    return (
      <NameGate
        boardHint={boardId}
        onDone={(id) => {
          saveIdentity(id);
          setIdentity(id);
        }}
      />
    );

  if (error)
    return (
      <main className="pcb-bg grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-danger">// error</p>
          <h1 className="mt-3 text-2xl font-semibold">{error}</h1>
          <Link href="/" className="mt-6 inline-block font-mono text-sm text-accent hover:underline">
            ← volver al inicio
          </Link>
        </div>
      </main>
    );

  const openCard = state?.cards.find((c) => c.id === openCardId);
  const activeCard = state?.cards.find((c) => c.id === activeId);
  const [statusLabel, statusColor] = STATUS_TEXT[status];

  return (
    <main className="pcb-bg flex h-dvh flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-void/80 px-4 py-2.5 backdrop-blur">
        <Link href="/" aria-label="Inicio">
          <Wordmark />
        </Link>
        <span className="h-5 w-px bg-line" />
        {state ? (
          <InlineEdit
            value={state.board.name}
            onSave={(name) => send({ type: "board.rename", name })}
            className="min-w-0 truncate text-sm font-medium"
            label="Nombre del tablero"
          />
        ) : (
          <span className="h-4 w-40 animate-pulse rounded bg-raised" />
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-muted sm:flex" aria-live="polite">
            <span className="animate-pulse-dot size-1.5 rounded-full" style={{ background: statusColor }} />
            {statusLabel}
          </span>
          <div className="flex -space-x-2" aria-label={`${presence.length} personas conectadas`}>
            {presence.slice(0, 6).map((p) => (
              <Avatar key={p.sid} name={p.sid === selfSid ? `${p.name} (tú)` : p.name} color={p.color} ring />
            ))}
            {presence.length > 6 && (
              <span className="grid size-7 place-items-center rounded-full bg-raised font-mono text-[10px] text-muted ring-2 ring-surface">
                +{presence.length - 6}
              </span>
            )}
          </div>
          <button
            onClick={share}
            className="h-8 rounded-lg border border-accent/40 bg-accent-soft px-3 font-mono text-xs text-accent transition hover:border-accent"
          >
            {copied ? "✓ enlace copiado" : "compartir"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          ref={canvasRef}
          onPointerMove={onPointerMove}
          className="scrollbar-thin relative min-w-0 flex-1 overflow-auto"
        >
          <div className="relative flex h-full min-w-max items-start gap-4 p-5">
            {!state ? (
              [0, 1, 2].map((i) => <div key={i} className="h-64 w-72 animate-pulse rounded-xl border border-line bg-surface/60" />)
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
              >
                {columns.map((col) => (
                  <ColumnView
                    key={col.id}
                    column={col}
                    cards={cardsByColumn.get(col.id) ?? []}
                    presence={others}
                    onOpenCard={setOpenCardId}
                    onAddCard={addCard}
                    onRename={(title) => send({ type: "column.rename", id: col.id, title })}
                    onDelete={() => send({ type: "column.delete", id: col.id })}
                  />
                ))}
                <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
                  {activeCard ? <CardBody card={activeCard} editors={[]} dragging /> : null}
                </DragOverlay>
              </DndContext>
            )}
            {state && columns.length < 12 && (
              <button
                onClick={addColumn}
                className="h-11 w-72 shrink-0 rounded-xl border border-dashed border-line font-mono text-xs text-muted transition hover:border-accent/60 hover:text-accent"
              >
                + nueva columna
              </button>
            )}
            <Cursors cursors={cursors} presence={others} />
          </div>
        </div>
        {state && <ActivityPanel items={state.activity} />}
      </div>

      {openCard && (
        <CardModal
          key={openCard.id}
          card={openCard}
          column={columns.find((c) => c.id === openCard.columnId)}
          viewers={others.filter((p) => p.focusCardId === openCard.id)}
          onClose={() => setOpenCardId(null)}
          onUpdate={(fields) => send({ type: "card.update", id: openCard.id, ...fields })}
          onDelete={() => {
            send({ type: "card.delete", id: openCard.id });
            setOpenCardId(null);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="animate-slide-in fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-danger/40 bg-surface px-4 py-2.5 text-sm text-ink shadow-xl"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
