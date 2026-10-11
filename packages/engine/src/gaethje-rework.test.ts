import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, computeDamage, createBattle, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";
import { nextFloat } from "./rng.js";

function battle(id = "the-highlight-ex") {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL["justin-gaethje"]!), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "fighting", energyTypeP2: "colorless" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(CARD_POOL[id]!); state.players.P1.active.attached = ["fighting", "fighting", "colorless"];
  state.players.P1.hand = []; state.players.P1.bench = []; state.players.P1.pendingEnergy = null;
  state.players.P2.active = toInPlay({ ...CARD_POOL["tai-tuivasa"]!, hp: 300, weakness: null });
  state.players.P2.bench = [toInPlay(CARD_POOL.merab!)];
  return state;
}

describe("Gaethje's new evolution chain and Rolling Thunder", () => {
  it("evolves Prospect to Contender to Champion on separate turns", () => {
    let state = battle("justin-gaethje"); const uid = state.players.P1.active!.uid;
    state.players.P1.hand = [CARD_POOL["justin-gaethje-contender"]!, CARD_POOL["justin-gaethje-champion"]!];
    expect(() => applyMove(state, { type: "evolve", handIndex: 1, targetUid: uid })).toThrow();
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid });
    expect(state.players.P1.active!.card.hp).toBe(90);
    expect(() => applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid })).toThrow();
    state = applyMove(applyMove(state, { type: "pass" }), { type: "pass" });
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid });
    expect(state.players.P1.active!.card).toMatchObject({ hp: 140, stage: "stage2", stageLabel: "Champion", rarity: "rare" });
    expect(state.players.P1.active!.previousStages).toEqual([CARD_POOL["justin-gaethje"], CARD_POOL["justin-gaethje-contender"]]);
  });

  it.each([0, 1, 1957, 2550])("Rolling Thunder resolves one seeded coin flip (%i)", seed => {
    const state = battle(); state.rngState = seed; const before = structuredClone(state);
    const roll = nextFloat(seed); const heads = roll.value < 0.5;
    const next = applyMove(state, { type: "attack", attackId: "rolling-thunder" });
    expect(next.players.P2.active!.damage).toBe(heads ? 180 : 0);
    expect(next.rngState).toBe(roll.state);
    const events = next.events.slice(state.events.length);
    expect(events.filter(event => event.kind === "coinFlipped")).toHaveLength(1);
    expect(events.filter(event => event.kind === "damageDealt")).toHaveLength(heads ? 1 : 0);
    expect(events.findIndex(event => event.kind === "coinFlipped")).toBeLessThan(events.findIndex(event => event.kind === "attackUsed"));
    expect(next.turnPlayer).toBe("P2"); expect(state).toEqual(before);
  });

  it("requires two Fighting energy plus one generic energy", () => {
    const state = battle(); state.players.P1.active!.attached = ["fighting", "water", "water"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "rolling-thunder" });
    state.players.P1.active!.attached = ["fighting", "fighting", "water"];
    expect(getLegalMoves(state)).toContainEqual({ type: "attack", attackId: "rolling-thunder" });
  });

  it("tails skips weakness, bonuses, and all other attack effects", () => {
    const state = battle(); state.rngState = 2550;
    expect(nextFloat(state.rngState).value).toBeGreaterThanOrEqual(0.5);
    state.players.P1.attackDamageBonus = 10;
    state.players.P2.active!.card = { ...state.players.P2.active!.card, weakness: "fighting" };
    const attack = state.players.P1.active!.card.attacks[0]!;
    state.players.P1.active!.card = { ...state.players.P1.active!.card, attacks: [{ ...attack, effects: [...attack.effects!, { kind: "discardSelfEnergy", amount: 1 }, { kind: "burn" }] }] };
    const next = applyMove(state, { type: "attack", attackId: "rolling-thunder" });
    expect(next.players.P2.active!.damage).toBe(0);
    expect(next.players.P2.active!.burned).toBeFalsy();
    expect(next.players.P1.active!.attached).toHaveLength(3);
  });

  it("AI values Rolling Thunder at half its heads damage and prefers a certain winning attack", () => {
    const state = battle(); const fighter = state.players.P1.active!; const attack = fighter.card.attacks[0]!;
    expect(computeDamage(fighter, state.players.P2.active!, attack)).toBe(90);
    state.players.P2.active!.card = { ...state.players.P2.active!.card, hp: 150 };
    state.players.P1.points = 2;
    fighter.card = { ...fighter.card, attacks: [attack, { id: "certain", name: "Certain", cost: ["fighting"], damage: 150 }] };
    expect(chooseMove(state)).toEqual({ type: "attack", attackId: "certain" });
  });
});
