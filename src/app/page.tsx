"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Logo";
import { loadRecent, type RecentBoard } from "@/lib/identity";

const FEATURES = [
  ["Tiempo real", "WebSockets: cada cambio llega al resto en milisegundos."],
  ["Presencia", "Ves quién está dentro, dónde tiene el cursor y qué tarjeta edita."],
  ["Sin registro", "Creas un tablero, compartes el enlace y a trabajar."],
] as const;

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentBoard[]>([]);

  useEffect(() => setRecent(loadRecent()), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };
      router.push(`/b/${id}`);
    } catch {
      setError("No se pudo crear el tablero. ¿Está el servidor arrancado?");
      setBusy(false);
    }
  }

  return (
    <main className="pcb-bg min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Wordmark />
        <a
          href="https://github.com/NotSaam"
          className="font-mono text-xs text-muted transition hover:text-accent"
          target="_blank"
          rel="noreferrer"
        >
          github/NotSaam
        </a>
      </header>

      <section className="mx-auto grid max-w-5xl gap-12 px-5 pb-20 pt-10 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">// kanban colaborativo</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Tableros que se sincronizan <span className="text-accent">mientras escribes</span>.
          </h1>
          <p className="mt-5 max-w-md text-muted">
            Crea un tablero, pasa el enlace y trabajad a la vez: tarjetas, columnas, cursores y actividad en directo.
          </p>

          <form onSubmit={create} className="mt-8 flex max-w-md gap-2">
            <label htmlFor="board-name" className="sr-only">
              Nombre del tablero
            </label>
            <input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Sprint 14, mudanza, TFM…"
              className="h-11 flex-1 rounded-lg border border-line bg-surface px-3.5 text-sm outline-none transition placeholder:text-faint focus:border-accent"
            />
            <button
              disabled={busy || !name.trim()}
              className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-void transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Creando…" : "Crear tablero"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <ul className="mt-12 grid gap-4 sm:grid-cols-3">
            {FEATURES.map(([title, text]) => (
              <li key={title} className="border-l border-line pl-3">
                <p className="font-mono text-xs font-medium text-ink">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="self-start rounded-xl border border-line bg-surface/80 p-5 backdrop-blur">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Tableros recientes</p>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aún no has abierto ninguno en este navegador.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((b) => (
                <li key={b.id}>
                  <a href={`/b/${b.id}`} className="group flex items-center justify-between py-2.5 text-sm">
                    <span className="truncate transition group-hover:text-accent">{b.name}</span>
                    <span className="ml-3 shrink-0 font-mono text-[11px] text-faint">
                      {new Date(b.visitedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </main>
  );
}
