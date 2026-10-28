"use client";

import { useEffect, useState } from "react";

/** Texto que se convierte en input al hacer doble clic. Guarda con Enter o al salir. */
export function InlineEdit({
  value,
  onSave,
  className,
  label,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
        className={`cursor-text text-left ${className ?? ""}`}
        title="Doble clic para editar"
        aria-label={`${label}: ${value}. Pulsa Enter para editar`}
      >
        {value}
      </button>
    );
  }

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== value) onSave(v.slice(0, 120));
  };

  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className={`rounded border border-accent/60 bg-raised px-1 outline-none ${className ?? ""}`}
    />
  );
}
