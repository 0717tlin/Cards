import { create } from "zustand";
import { ALL_CARD_POOL, DECK_PLAYER, isFighterCard, type CardDefinition, type EnergyType } from "@card-game/engine";
export const DECK_SIZE = 20;
export const COPY_LIMIT = 4;
export type DeckSelection = Record<string, number>;
export interface SavedDeck { id: string; name: string; selection: DeckSelection; energyTypes: EnergyType[] }
export const ENERGY_OPTIONS: EnergyType[] = ["fire", "water", "grass", "lightning", "psychic", "fighting"];
export function deckEnergies(selection: DeckSelection, types?: unknown): EnergyType[] {
  if (Array.isArray(types)) {
    const valid = [...new Set(types.filter((type): type is EnergyType => ENERGY_OPTIONS.includes(type)))];
    if (valid.length) return valid;
  }
  const counts = new Map<EnergyType, number>();
  for (const [id, count] of Object.entries(selection)) {
    const card = ALL_CARD_POOL[id];
    if (card && isFighterCard(card) && card.type !== "colorless") counts.set(card.type, (counts.get(card.type) ?? 0) + count);
  }
  return [[...counts].sort((a,b) => b[1] - a[1])[0]?.[0] ?? "fire"];
}
const STORAGE_KEY = "card-battle.saved-decks.v1";
export function validateDeck(selection: DeckSelection) {
  const total = Object.values(selection).reduce((sum, count) => sum + count, 0);
  const issues: string[] = [];
  if (total !== DECK_SIZE) issues.push(`Deck must have exactly ${DECK_SIZE} cards (currently ${total}).`);
  for (const [id, count] of Object.entries(selection)) {
    if (!Object.prototype.hasOwnProperty.call(ALL_CARD_POOL, id)) issues.push(`Unknown card: ${id}.`);
    if (!Number.isInteger(count) || count < 1 || count > COPY_LIMIT) issues.push(`Use 1–${COPY_LIMIT} copies of ${ALL_CARD_POOL[id]?.name ?? id}.`);
  }
  if (!Object.keys(selection).some(id => { const card = ALL_CARD_POOL[id]; return card && isFighterCard(card) && card.stage === "basic"; })) issues.push("Deck must include at least one Basic fighter.");
  return { total, legal: issues.length === 0, issues };
}
export function buildDeck(selection: DeckSelection): CardDefinition[] | null {
  if (!validateDeck(selection).legal) return null;
  return Object.entries(selection).flatMap(([id, count]) => Array(count).fill(ALL_CARD_POOL[id]!));
}
function starter(): SavedDeck {
  const selection: DeckSelection = {};
  for (const card of DECK_PLAYER) selection[card.id] = (selection[card.id] ?? 0) + 1;
  return { id: "starter", name: "Starter Deck", selection, energyTypes: ["fire"] };
}
function load(): SavedDeck[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(raw)) return [starter()];
    const decks = raw.filter((d): d is SavedDeck => !!d && typeof d === "object" && typeof d.id === "string" && typeof d.name === "string" && !!d.selection && typeof d.selection === "object" && !Array.isArray(d.selection) && Object.values(d.selection).every(c => Number.isInteger(c) && Number(c) > 0));
    // Remove entire decks containing retired cards, including their stored copy.
    const current = decks.filter(deck => Object.keys(deck.selection).every(id => Object.prototype.hasOwnProperty.call(ALL_CARD_POOL, id)))
      .map(deck => ({...deck, energyTypes: deckEnergies(deck.selection, deck.energyTypes)}));
    if (current.length !== raw.length) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); }
      catch { /* Keep retired decks out of the game even when storage is unavailable. */ }
    }
    return current;
  } catch { return [starter()]; }
}
interface SavedDeckStore {
  decks: SavedDeck[];
  error: string | null;
  save: (id: string | null, name: string, selection: DeckSelection, energyTypes?: EnergyType[]) => string | null;
}
export const useSavedDecks = create<SavedDeckStore>((set, get) => ({
  decks: load(), error: null,
  save: (id, name, selection, energyTypes) => {
    if (energyTypes && !energyTypes.length) return null;
    if (!name.trim() || !validateDeck(selection).legal) return null;
    const deck: SavedDeck = { id: id ?? crypto.randomUUID(), name: name.trim(), selection: { ...selection }, energyTypes: deckEnergies(selection, energyTypes) };
    const decks = get().decks.some(d => d.id === deck.id) ? get().decks.map(d => d.id === deck.id ? deck : d) : [...get().decks, deck];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(decks)); }
    catch { set({error:"Couldn't save this deck. Browser storage may be disabled or full."}); return null; }
    set({decks,error:null});
    return deck.id;
  },
}));
