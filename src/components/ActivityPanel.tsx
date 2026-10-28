"use client";

import { useEffect, useState } from "react";
import type { ActivityDTO } from "@/shared/protocol";

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "ahora";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function ActivityPanel({ items }: { items: ActivityDTO[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface/70 backdrop-blur xl:flex">
      <p className="border-b border-line px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
        Actividad
      </p>
      <ol className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {items.length === 0 && <li className="text-xs text-muted">Todavía no ha pasado nada aquí.</li>}
        {items.map((a) => (
          <li key={a.id} className="animate-slide-in flex gap-2.5 text-xs leading-relaxed">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
            <p className="min-w-0 flex-1 text-muted">
              <span className="font-medium" style={{ color: a.color }}>
                {a.actor}
              </span>{" "}
              {a.message}
            </p>
            <time className="shrink-0 font-mono text-[10px] text-faint" dateTime={new Date(a.createdAt).toISOString()}>
              {ago(a.createdAt, now)}
            </time>
          </li>
        ))}
      </ol>
    </aside>
  );
}
