/**
 * Ordenación fraccional: cada elemento guarda un número y para insertar entre
 * dos vecinos se usa el punto medio. Mover una tarjeta toca una sola fila,
 * sin reescribir el orden de toda la columna.
 */
export const STEP = 1024;

export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return STEP;
  if (before === null) return (after as number) - STEP;
  if (after === null) return before + STEP;
  return (before + after) / 2;
}

/** Posición para dejar un elemento en `index` dentro de una lista ya ordenada (sin él). */
export function positionAt(sorted: { position: number }[], index: number): number {
  const i = Math.max(0, Math.min(index, sorted.length));
  const before = i > 0 ? sorted[i - 1].position : null;
  const after = i < sorted.length ? sorted[i].position : null;
  return positionBetween(before, after);
}

export function byPosition<T extends { position: number; id: string }>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}
