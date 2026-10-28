"use client";

import { useState } from "react";
import { COLORS } from "@/shared/protocol";
import type { Identity } from "@/lib/identity";

export function NameGate({ onDone, boardHint }: { onDone: (id: Identity) => void; boardHint?: string }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<Identity["color"]>(COLORS[Math.floor(Math.random() * COLORS.length)]);

  return (
    <div className="pcb-bg fixed inset-0 z-50 grid place-items-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onDone({ name: name.trim().slice(0, 24), color });
        }}
        className="animate-slide-in w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-2xl shadow-black/40"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">// identifícate</p>
        <h2 className="mt-2 text-lg font-semibold">¿Cómo te verán los demás?</h2>
        {boardHint && <p className="mt-1 text-sm text-muted">Vas a entrar en un tablero compartido.</p>}

        <label htmlFor="display-name" className="mt-5 block text-xs text-muted">
          Nombre
        </label>
        <input
          id="display-name"
          autoFocus
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-line bg-void px-3 text-sm outline-none focus:border-accent"
        />

        <p className="mt-4 text-xs text-muted">Color</p>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className="size-7 rounded-full ring-offset-2 ring-offset-surface transition"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${c}` : undefined }}
            />
          ))}
        </div>

        <button
          disabled={!name.trim()}
          className="mt-6 h-10 w-full rounded-lg bg-accent text-sm font-semibold text-void transition hover:brightness-110 disabled:opacity-40"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
