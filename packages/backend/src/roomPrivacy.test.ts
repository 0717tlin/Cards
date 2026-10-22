import { describe, expect, it } from "vitest";
import { CARD_POOL, DECK_AI, DECK_PLAYER, createBattle } from "@card-game/engine";
import { privateBattleView, roomView } from "./roomPrivacy.js";

describe("multiplayer privacy", () => {
  it("hides both deck orders, the opponent's hand, RNG, and private search logs", () => {
    const state = createBattle({ seed: 123456, deckP1: DECK_PLAYER, deckP2: DECK_AI, energyTypeP1: "fire", energyTypeP2: "water" });
    state.log.push("P2 added SECRET DRAW to their hand.");
    state.events.push({ kind: "deckPeeked", player: "P2", card: CARD_POOL["diego-lopes"]! });
    const original = structuredClone(state);
    const view = privateBattleView(state, "P1");
    expect(view.players.P1.hand).toEqual(state.players.P1.hand);
    expect(view.players.P2.hand.every(card => card.id === "hidden")).toBe(true);
    expect(view.players.P1.deck.every(card => card.id === "hidden")).toBe(true);
    expect(view.players.P2.deck.every(card => card.id === "hidden")).toBe(true);
    expect(view.players.P2.hand).toHaveLength(state.players.P2.hand.length);
    expect(view.players.P1.deck).toHaveLength(state.players.P1.deck.length);
    expect(view).not.toHaveProperty("rngState");
    expect(JSON.stringify(view)).not.toContain("SECRET DRAW");
    expect(view.events.some(event => event.kind === "deckPeeked")).toBe(false);
    expect(state).toEqual(original);
  });

  it("puts either viewer at the bottom and maps events, phases, turns and results consistently", () => {
    const state = createBattle({ seed: 2, deckP1: DECK_PLAYER, deckP2: DECK_AI, energyTypeP1: "fire", energyTypeP2: "water" });
    state.turnPlayer = "P2"; state.winner = "P2";
    state.phase = { kind: "awaitAttackSwitch", player: "P2", continues: false };
    state.events.push({ kind: "deckPeeked", player: "P2", card: CARD_POOL["diego-lopes"]! });
    const view = privateBattleView(state, "P2");
    expect(view.players.P1.hand).toEqual(state.players.P2.hand);
    expect(view.players.P1.id).toBe("P1"); expect(view.players.P2.id).toBe("P2");
    expect(view.turnPlayer).toBe("P1"); expect(view.winner).toBe("P1");
    expect(view.phase).toMatchObject({ player: "P1" });
    expect(view.events.at(-1)).toMatchObject({ kind: "deckPeeked", player: "P1", card: { id: "diego-lopes" } });
  });

  it("only sends the acting player's legal moves", () => {
    const state = createBattle({ seed: 3, deckP1: DECK_PLAYER, deckP2: DECK_AI, energyTypeP1: "fire", energyTypeP2: "water" });
    state.turnPlayer = "P2";
    const guests = { P1: { name: "A", connected: true, ready: true }, P2: { name: "B", connected: true, ready: true } };
    expect(roomView("ABC123", "P1", 1, guests, state).legalMoves).toEqual([]);
    expect(roomView("ABC123", "P2", 1, guests, state).legalMoves.length).toBeGreaterThan(0);
  });
});
