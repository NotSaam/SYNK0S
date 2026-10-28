"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CardDTO, ColumnDTO, PresenceUser } from "@/shared/protocol";
import { CardItem } from "./CardItem";
import { InlineEdit } from "./InlineEdit";

export function ColumnView({
  column,
  cards,
  presence,
  onOpenCard,
  onAddCard,
  onRename,
  onDelete,
}: {
  column: ColumnDTO;
  cards: CardDTO[];
  presence: PresenceUser[];
  onOpenCard: (id: string) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}`, data: { type: "column", columnId: column.id } });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);

  function submit() {
    const t = draft.trim();
    if (t) onAddCard(column.id, t);
    setDraft("");
  }

  return (
    <section
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl border bg-surface/90 backdrop-blur transition-colors ${
        isOver ? "border-accent/60" : "border-line"
      }`}
      aria-label={`Columna ${column.title}`}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="size-1.5 rounded-full bg-accent" />
        <InlineEdit
          value={column.title}
          onSave={onRename}
          className="min-w-0 flex-1 truncate font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink"
          label="Nombre de la columna"
        />
        <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">{cards.length}</span>
        {confirming ? (
          <span className="flex gap-1">
            <button onClick={onDelete} className="rounded px-1.5 font-mono text-[10px] text-danger hover:bg-danger/10">
              borrar
            </button>
            <button onClick={() => setConfirming(false)} className="rounded px-1.5 font-mono text-[10px] text-muted hover:bg-raised">
              no
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="grid size-6 place-items-center rounded text-faint transition hover:bg-raised hover:text-danger"
            aria-label={`Eliminar columna ${column.title}`}
            title="Eliminar columna"
          >
            ×
          </button>
        )}
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="scrollbar-thin flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              editors={presence.filter((p) => p.focusCardId === card.id)}
              onOpen={onOpenCard}
            />
          ))}
        </ul>
      </SortableContext>

      <div className="border-t border-line p-2">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              autoFocus
              value={draft}
              maxLength={120}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={() => {
                submit();
                setAdding(false);
              }}
              placeholder="Título de la tarjeta…"
              className="w-full resize-none rounded-lg border border-accent/50 bg-raised px-2.5 py-2 text-[13px] outline-none placeholder:text-faint"
            />
            <p className="px-1 font-mono text-[10px] text-faint">enter para añadir · esc para cerrar</p>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-lg px-2 py-1.5 text-left font-mono text-xs text-muted transition hover:bg-raised hover:text-accent"
          >
            + añadir tarjeta
          </button>
        )}
      </div>
    </section>
  );
}
