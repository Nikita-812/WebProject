import { create } from "zustand";
import type { BoardSnapshot, Card, Column, UUID } from "../types";

interface BoardState {
  columns: Column[];
  cards: Card[];
  hydrate: (snapshot: BoardSnapshot) => void;
  upsertCard: (card: Card) => void;
  moveCard: (payload: { id: UUID; toColumnId: UUID; position: number; version?: number }) => void;
  addColumn: (column: Column) => void;
  updateColumn: (column: Column) => void;
  removeColumn: (columnId: UUID) => void;
  deleteCard: (cardId: UUID) => void;
  clear: () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  columns: [],
  cards: [],
  hydrate: (snapshot) => set({ columns: snapshot.columns, cards: snapshot.cards }),
  upsertCard: (card) => {
    const cards = get().cards;
    const idx = cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      const next = [...cards];
      next[idx] = card;
      set({ cards: next });
    } else {
      set({ cards: [...cards, card] });
    }
  },
  moveCard: ({ id, toColumnId, position, version }) => {
    set(({ cards }) => ({
      cards: cards.map((card) =>
        card.id === id ? { ...card, column_id: toColumnId, position, version: version ?? card.version } : card
      ),
    }));
  },
  addColumn: (column) => set(({ columns }) => ({ columns: [...columns, column] })),
  updateColumn: (column) =>
    set(({ columns }) => ({
      columns: columns.map((col) => (col.id === column.id ? column : col)),
    })),
  removeColumn: (columnId) =>
    set(({ columns, cards }) => ({
      columns: columns.filter((column) => column.id !== columnId),
      cards: cards.filter((card) => card.column_id !== columnId),
    })),
  deleteCard: (cardId) =>
    set(({ cards }) => ({
      cards: cards.filter((card) => card.id !== cardId),
    })),
  clear: () => set({ columns: [], cards: [] }),
}));
