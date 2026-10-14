import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, createBattle, DECK_ENERGY_TYPES, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

describe("Steel and revised card costs", () => {
  it("can generate Steel energy and pay typed Steel attacks", () => {
    expect(DECK_ENERGY_TYPES).toContain("steel");
    const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL["chris-curtis"]!), deckP2: Array(20).fill(CARD_POOL.merab!), energyTypeP1: "steel", energyTypeP2: "water" });
    state.turnPlayer = "P1"; state.turnNumber = 4; state.players.P1.pendingEnergy = "steel";
    state.players.P1.active!.attached = ["fire"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "curtis-cross" });
    const charged = applyMove(state, { type: "attachEnergy", targetUid: state.players.P1.active!.uid });
    expect(getLegalMoves(charged)).toContainEqual({ type: "attack", attackId: "curtis-cross" });
    expect(CARD_POOL["tommy-mcmillan"]!.type).toBe("steel");
  });

  it("requires Grass plus one other energy for DO NOT REDEEM", () => {
    const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL["anshul-jubli"]!), deckP2: Array(20).fill(CARD_POOL.merab!), energyTypeP1: "grass", energyTypeP2: "water" });
    state.turnPlayer = "P1"; state.turnNumber = 4;
    state.players.P1.active!.attached = ["water", "fire"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "do-not-redeem" });
    state.players.P1.active!.attached = ["grass", "fire"];
    expect(getLegalMoves(state)).toContainEqual({ type: "attack", attackId: "do-not-redeem" });
  });

  it("gives the new Common Steel basics exactly one effect-free attack", () => {
    for (const id of ["chris-curtis", "marcin-tybura"]) {
      const card = CARD_POOL[id]!;
      expect(card).toMatchObject({ type: "steel", rarity: "common", stage: "basic" });
      expect(card.attacks).toHaveLength(1); expect(card.attacks[0]!.effects).toBeUndefined();
    }
    expect(toInPlay(CARD_POOL["islam-makhachev-contender"]!).card.attacks[0]).toMatchObject({ name: "Calf Kick", damage: 40, cost: ["water", "colorless"] });
  });
});
