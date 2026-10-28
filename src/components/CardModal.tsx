"use client";

import { useEffect, useRef, useState } from "react";
import { LABELS, type CardDTO, type ColumnDTO, type Label, type PresenceUser } from "@/shared/protocol";
import { Avatar } from "./Avatar";
import { LabelPill } from "./LabelPill";

export function CardModal({
  card,
  column,
  viewers,
  onClose,
  onUpdate,
  onDelete,
}: {
  card: CardDTO;
  column: ColumnDTO | undefined;
  viewers: PresenceUser[];
  onClose: () => void;
  onUpdate: (fields: { title?: string; description?: string; label?: Label | null }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [saved, setSaved] = useState(true);
  const editingDesc = useRef(false);
  const editingTitle = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si otra persona cambia la tarjeta y no la estoy tocando yo, me llega su versión
  useEffect(() => {
    if (!editingTitle.current) setTitle(card.title);
    if (!editingDesc.current) setDescription(card.description);
  }, [card.title, card.description]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Si se cierra el modal con un guardado pendiente, se envía en el momento
  const pending = useRef<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) onUpdateRef.current({ description: pending.current });
    },
    [],
  );

  function scheduleDescription(value: string) {
    setDescription(value);
    setSaved(false);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onUpdate({ description: value });
      pending.current = null;
      setSaved(true);
    }, 500);
  }

  function commitTitle() {
    editingTitle.current = false;
    const t = title.trim();
    if (t && t !== card.title) onUpdate({ title: t });
    else setTitle(card.title);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${card.title}`}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in w-full max-w-lg rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {column?.title ?? "—"} <span className="text-faint">/ #{card.id.slice(0, 6)}</span>
          </p>
          <div className="flex items-center gap-3">
            {viewers.length > 0 && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
                también aquí
                <span className="flex -space-x-1.5">
                  {viewers.map((v) => (
                    <Avatar key={v.sid} name={v.name} color={v.color} size={20} ring />
                  ))}
                </span>
              </span>
            )}
            <button onClick={onClose} className="grid size-7 place-items-center rounded text-muted hover:bg-raised" aria-label="Cerrar">
              ×
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <input
            value={title}
            maxLength={120}
            onFocus={() => (editingTitle.current = true)}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Título"
            className="w-full rounded-md border border-transparent bg-transparent px-1 text-lg font-semibold outline-none hover:border-line focus:border-accent"
          />

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Etiqueta</p>
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map((l) => (
                <button
                  key={l}
                  onClick={() => onUpdate({ label: card.label === l ? null : l })}
                  className={`rounded border transition ${card.label === l ? "border-line-strong" : "border-line opacity-70 hover:opacity-100"}`}
                  aria-pressed={card.label === l}
                >
                  <LabelPill label={l} active={card.label === l} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Descripción</p>
              <span className="font-mono text-[10px] text-faint">{saved ? "✓ guardado" : "guardando…"}</span>
            </div>
            <textarea
              value={description}
              maxLength={4000}
              rows={7}
              onFocus={() => (editingDesc.current = true)}
              onBlur={() => (editingDesc.current = false)}
              onChange={(e) => scheduleDescription(e.target.value)}
              placeholder="Detalles, enlaces, criterios de aceptación…"
              className="scrollbar-thin w-full resize-y rounded-lg border border-line bg-void px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="font-mono text-[10px] text-faint">creada por {card.createdBy}</span>
          <button onClick={onDelete} className="rounded-md px-2.5 py-1.5 text-xs text-danger transition hover:bg-danger/10">
            Eliminar tarjeta
          </button>
        </div>
      </div>
    </div>
  );
}
