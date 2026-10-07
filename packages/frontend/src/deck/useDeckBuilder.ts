// Deck builder state (first version). Holds a selection of card ids -> count,
// validates against deck rules, and expands into a CardDefinition[] for battle.

import { create } from "zustand";
import { ALL_CARD_POOL as CARD_POOL, isCreatureCard, type CardDefinition } from "@card-game/engine";

export const DECK_SIZE = 20;
export const COPY_LIMIT = 2;

export interface DeckValidation {
  total: number;
  legal: boolean;
  issues: string[];
}

interface DeckBuilderStore {
  /** card id -> count */
  selection: Record<string, number>;
  add: (cardId: string) => void;
  remove: (cardId: string) => void;
  clear: () => void;
  validation: () => DeckValidation;
  build: () => CardDefinition[] | null;
}

function isBattleLegalCard(card: CardDefinition): boolean {
  // Only Basics are playable in battle this milestone (evolution deferred).
  return isCreatureCard(card) && card.stage === "basic";
}

export const useDeckBuilder = create<DeckBuilderStore>((set, get) => ({
  selection: {},

  add: (cardId) => {
    const card = CARD_POOL[cardId];
    if (!card) return;
    const current = get().selection[cardId] ?? 0;
    const total = Object.values(get().selection).reduce((a, b) => a + b, 0);
    if (current >= COPY_LIMIT) return;
    if (total >= DECK_SIZE) return;
    set({ selection: { ...get().selection, [cardId]: current + 1 } });
  },

  remove: (cardId) => {
    const current = get().selection[cardId] ?? 0;
    if (current <= 0) return;
    const next = { ...get().selection };
    if (current === 1) delete next[cardId];
    else next[cardId] = current - 1;
    set({ selection: next });
  },

  clear: () => set({ selection: {} }),

  validation: () => {
    const selection = get().selection;
    const total = Object.values(selection).reduce((a, b) => a + b, 0);
    const issues: string[] = [];

    if (total !== DECK_SIZE) issues.push(`Deck must have exactly ${DECK_SIZE} cards (currently ${total}).`);

    for (const [id, count] of Object.entries(selection)) {
      if (count > COPY_LIMIT) {
        issues.push(`Too many copies of ${CARD_POOL[id]?.name ?? id} (max ${COPY_LIMIT}).`);
      }
    }

    const hasBasic = Object.keys(selection).some((id) => {
      const c = CARD_POOL[id];
      return c ? isBattleLegalCard(c) : false;
    });
    if (!hasBasic) issues.push("Deck must include at least one Basic mon.");

    return { total, legal: issues.length === 0, issues };
  },

  build: () => {
    if (!get().validation().legal) return null;
    const cards: CardDefinition[] = [];
    for (const [id, count] of Object.entries(get().selection)) {
      const card = CARD_POOL[id];
      if (!card) continue;
      for (let i = 0; i < count; i++) cards.push(card);
    }
    return cards;
  },
}));
