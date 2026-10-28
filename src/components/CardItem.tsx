"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardDTO, PresenceUser } from "@/shared/protocol";
import { Avatar } from "./Avatar";
import { LabelPill } from "./LabelPill";

export function CardBody({ card, editors, dragging }: { card: CardDTO; editors: PresenceUser[]; dragging?: boolean }) {
  const editor = editors[0];
  return (
    <div
      className={`group relative rounded-lg border bg-raised px-3 py-2.5 text-left transition ${
        dragging ? "rotate-[1.5deg] border-accent shadow-xl shadow-black/50" : "border-line hover:border-line-strong"
      }`}
      style={editor ? { borderColor: editor.color, boxShadow: `0 0 0 1px ${editor.color}55` } : undefined}
    >
      {card.label && (
        <div className="mb-1.5">
          <LabelPill label={card.label} />
        </div>
      )}
      <p className="text-[13px] leading-snug text-ink">{card.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-faint">
          {card.description ? "≡ " : ""}
          {card.createdBy}
        </span>
        {editor && (
          <span className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: editor.color }}>
            <span className="animate-pulse-dot size-1.5 rounded-full" style={{ background: editor.color }} />
            {editor.name} edita
            <Avatar name={editor.name} color={editor.color} size={16} />
          </span>
        )}
      </div>
    </div>
  );
}

export function CardItem({
  card,
  editors,
  onOpen,
}: {
  card: CardDTO;
  editors: PresenceUser[];
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.columnId },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "opacity-30" : undefined}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(card.id)}
        className="block w-full cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        aria-label={`Tarjeta ${card.title}`}
      >
        <CardBody card={card} editors={editors} />
      </button>
    </li>
  );
}
