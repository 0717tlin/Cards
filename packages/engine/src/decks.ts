import { ALL_CARD_POOL } from "./cards.js";
import { isFighterCard, type EnergyType } from "./types.js";

export const DECK_SIZE = 20;
export const COPY_LIMIT = 2;
export type DeckSelection = Record<string, number>;
export const DECK_ENERGY_TYPES: EnergyType[] = ["fire", "water", "grass", "lightning", "psychic", "fighting"];
export interface SharedDeck { name: string; selection: DeckSelection; energyTypes: EnergyType[] }

export function validateDeckSelection(selection: DeckSelection) {
  const total = Object.values(selection).reduce((sum, count) => sum + count, 0);
  const issues: string[] = [];
  if (total !== DECK_SIZE) issues.push(`Deck must have exactly ${DECK_SIZE} cards (currently ${total}).`);
  for (const [id, count] of Object.entries(selection)) {
    const known = Object.prototype.hasOwnProperty.call(ALL_CARD_POOL, id);
    if (!known) issues.push(`Unknown card: ${id}.`);
    if (!Number.isInteger(count) || count < 1 || count > COPY_LIMIT) issues.push(`Use 1–${COPY_LIMIT} copies of ${known ? ALL_CARD_POOL[id]!.name : id}.`);
  }
  if (!Object.keys(selection).some(id => {
    const card = Object.prototype.hasOwnProperty.call(ALL_CARD_POOL, id) ? ALL_CARD_POOL[id] : undefined;
    return card && isFighterCard(card) && card.stage === "basic";
  })) issues.push("Deck must include at least one Basic or Prospect fighter.");
  return { total, legal: issues.length === 0, issues };
}

/** Validate untrusted code payloads and return an independent, normalized snapshot. */
export function readSharedDeck(value: unknown): SharedDeck | null {
  if (!value || typeof value !== "object") return null;
  const deck = value as Record<string, unknown>;
  if (typeof deck.name !== "string" || !deck.name.trim() || deck.name.trim().length > 60) return null;
  if (!deck.selection || typeof deck.selection !== "object" || Array.isArray(deck.selection)) return null;
  if (!Object.values(deck.selection).every(count => typeof count === "number" && Number.isInteger(count))) return null;
  const selection = deck.selection as DeckSelection;
  if (!validateDeckSelection(selection).legal) return null;
  if (!Array.isArray(deck.energyTypes) || !deck.energyTypes.length || !deck.energyTypes.every(type => DECK_ENERGY_TYPES.includes(type))) return null;
  return { name: deck.name.trim(), selection: { ...selection }, energyTypes: [...new Set(deck.energyTypes)] };
}
