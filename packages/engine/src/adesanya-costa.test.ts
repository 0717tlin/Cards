import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, createBattle, getFighterStageLabel, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

const israel = CARD_POOL["israel-adesanya"]!;
const paulo = CARD_POOL["paulo-costa"]!;
const juice = CARD_POOL["secret-juice"]!;
function battle(card = paulo) {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(card), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "fighting", energyTypeP2: "water" });
  state.turnNumber = 4; state.turnPlayer = "P1";
  state.players.P1.active = toInPlay(card);
  state.players.P1.active.attached = ["fighting", "fighting", "water"];
  state.players.P1.bench = [];
  state.players.P1.pendingEnergy = null;
  state.players.P2.active = toInPlay({ ...CARD_POOL["tai-tuivasa"]!, weakness: null });
  return state;
}

describe("Adesanya and Costa cards", () => {
  it("uses Prospect labels for both starting fighters and Identity for Secret Juice", () => {
    expect(getFighterStageLabel(israel)).toBe("Prospect");
    expect(getFighterStageLabel(paulo)).toBe("Prospect");
    expect(getFighterStageLabel(juice)).toBe("Identity");
    expect(israel).toMatchObject({ hp: 70, type: "psychic", rarity: "uncommon", retreatCost: 1 });
    expect(paulo).toMatchObject({ hp: 70, type: "fighting", rarity: "common", retreatCost: 1 });
    expect(juice).toMatchObject({ hp: 140, type: "fighting", rarity: "uncommon", retreatCost: 2 });
  });
  it("uses Adesanya's Colorless Feint to boost the next turn's attack without initial damage", () => {
    let state = battle(israel);
    state.players.P1.active!.attached = ["water"];
    state = applyMove(state, { type: "attack", attackId: "adesanya-feint" });
    expect(state.players.P2.active!.damage).toBe(0);
    expect(state.players.P2.active!.damageVulnerability?.amount).toBe(20);
    state = applyMove(state, { type: "pass" });
    state.players.P1.active = toInPlay(paulo);
    state.players.P1.active.attached = ["fighting", "water"];
    state = applyMove(state, { type: "attack", attackId: "costa-roundhouse-kick" });
    expect(state.players.P2.active!.damage).toBe(60);
    expect(state.players.P2.active!.damageVulnerability).toBeUndefined();
  });
  it("evolves Paulo into Secret Juice while preserving damage and energy, then deals 80 damage", () => {
    let state = battle();
    const active = state.players.P1.active!; active.damage = 20;
    state.players.P1.hand = [juice];
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: active.uid });
    expect(state.players.P1.active).toMatchObject({ uid: active.uid, card: { id: "secret-juice" }, damage: 20, attached: ["fighting", "fighting", "water"] });
    state = applyMove(state, { type: "attack", attackId: "head-kick" });
    expect(state.players.P2.active!.damage).toBe(80);
    const unpaid = battle(); unpaid.players.P1.active!.card = juice; unpaid.players.P1.active!.attached = ["fighting", "water", "water"];
    expect(getLegalMoves(unpaid).some(move => move.type === "attack")).toBe(false);
  });
});
