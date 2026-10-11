import { describe, expect, it } from "vitest";
import { CARD_POOL, DECK_AI, DECK_PLAYER } from "./cards.js";
import { COPY_LIMIT, readSharedDeck, validateDeckSelection, type DeckSelection } from "./decks.js";

function selection(cards: typeof DECK_PLAYER): DeckSelection {
  return cards.reduce<DeckSelection>((result, card) => { result[card.id] = (result[card.id] ?? 0) + 1; return result; }, {});
}
describe("deck rules", () => {
  it.each([{ cards: DECK_PLAYER }, { cards: DECK_AI }])("keeps built-in decks legal under the two-copy limit", ({ cards }) => {
    expect(COPY_LIMIT).toBe(2);
    expect(validateDeckSelection(selection(cards)).legal).toBe(true);
  });
  it("rejects a third copy even when the deck has exactly twenty cards", () => {
    const deck = selection(DECK_PLAYER);
    deck["ilia-topuria"]!++;
    deck["merab"]!--;
    expect(validateDeckSelection(deck)).toMatchObject({ total: 20, legal: false });
  });
  it("rejects unknown cards, trainer-only decks, and malformed shared payloads", () => {
    const deck = { name: "My Deck", selection: selection(DECK_PLAYER), energyTypes: ["fire", "water"] };
    expect(readSharedDeck(deck)).toEqual(deck);
    for (const invalid of [null, { ...deck, name: " " }, { ...deck, energyTypes: [] }, { ...deck, energyTypes: ["colorless"] }, { ...deck, selection: { constructor: 20 } }, { ...deck, selection: { "bandages": 20 } }, { ...deck, selection: { "ilia-topuria": "20" } }]) {
      expect(readSharedDeck(invalid)).toBeNull();
    }
  });
  it("gives plain Common fighters one damage-only attack", () => {
    const plain = Object.values(CARD_POOL).filter(card => card.rarity === "common" && !card.ability && card.attacks.every(attack => !attack.effects?.length));
    expect(plain.length).toBeGreaterThan(10);
    expect(plain.every(card => card.attacks.length === 1)).toBe(true);
    expect(CARD_POOL["dan-ige"]!.attacks[0]!.id).toBe("ige-jab");
    expect(CARD_POOL["melquizael-costa"]!.attacks[0]!.id).toBe("costa-hook");
  });
});
