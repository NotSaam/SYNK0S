import type { ActivityDTO, BoardState, Patch } from "./protocol";

/**
 * Aplica un patch al estado del tablero. Es idempotente (upsert por id), así
 * que da igual recibir el eco del servidor de un cambio que ya aplicamos en
 * local de forma optimista.
 */
export function applyPatch(state: BoardState, patch: Patch, activity: ActivityDTO | null = null): BoardState {
  let next: BoardState;
  switch (patch.kind) {
    case "board":
      next = { ...state, board: patch.board };
      break;
    case "column.upsert": {
      const exists = state.columns.some((c) => c.id === patch.column.id);
      next = {
        ...state,
        columns: exists
          ? state.columns.map((c) => (c.id === patch.column.id ? patch.column : c))
          : [...state.columns, patch.column],
      };
      break;
    }
    case "column.delete":
      next = {
        ...state,
        columns: state.columns.filter((c) => c.id !== patch.id),
        cards: state.cards.filter((c) => c.columnId !== patch.id),
      };
      break;
    case "card.upsert": {
      const exists = state.cards.some((c) => c.id === patch.card.id);
      next = {
        ...state,
        cards: exists ? state.cards.map((c) => (c.id === patch.card.id ? patch.card : c)) : [...state.cards, patch.card],
      };
      break;
    }
    case "card.delete":
      next = { ...state, cards: state.cards.filter((c) => c.id !== patch.id) };
      break;
  }
  if (activity && !next.activity.some((a) => a.id === activity.id)) {
    next = { ...next, activity: [activity, ...next.activity].slice(0, 40) };
  }
  return next;
}
