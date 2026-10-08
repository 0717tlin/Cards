import { describe, expect, it } from "vitest";
import { applyMove, createBattle, CARD_POOL, getLegalMoves } from "./index.js";
import { nextFloat } from "./rng.js";
function battle(seed: number, hp = 500) {
  const fighter = CARD_POOL["tommy-mcmillan"]!;
  const state = createBattle({seed: 12, deckP1: Array(20).fill(fighter), deckP2: Array(20).fill({...CARD_POOL["khabib-nurmagomedov"]!, hp, weakness: null}), energyTypeP1: "fire", energyTypeP2: "water"});
  state.turnPlayer = "P1";
  state.rngState = seed;
  state.players.P1.active!.attached = ["water"];
  return state;
}
describe("Blitz coin flips", () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])("resolves seeded flips and damage for seed %i without mutating input", seed => {
    const state = battle(seed);
    const original = structuredClone(state);
    let rng = seed, heads = 0, value: number;
    do { const roll = nextFloat(rng); rng = roll.state; value = roll.value; if(value < .5) heads++; } while(value < .5);
    const next = applyMove(state, {type: "attack", attackId: "blitz"});
    const flips = next.events.filter(e => e.kind === "coinFlipped");
    expect(flips).toHaveLength(heads + 1);
    expect(flips.at(-1)).toMatchObject({result: "tails", bonus: heads * 10});
    expect(flips.slice(0, -1).every(e => e.result === "heads")).toBe(true);
    expect(next.players.P2.active!.damage).toBe(10 + heads * 10);
    expect(next.rngState).toBe(rng);
    expect(state).toEqual(original);
    expect(applyMove(state, {type:"attack", attackId:"blitz"})).toEqual(next);
    const kinds = next.events.slice(state.events.length).map(e => e.kind);
    expect(kinds.indexOf("coinFlipped")).toBeLessThan(kinds.indexOf("attackUsed"));
  });
  it("requires energy, applies weakness and resolves a knockout", () => {
    const state = battle(1, 10);
    state.players.P1.active!.attached = [];
    expect(getLegalMoves(state)).not.toContainEqual({type:"attack", attackId:"blitz"});
    state.players.P1.active!.attached = ["grass"];
    state.players.P2.active!.card.weakness = "colorless";
    const next = applyMove(state, {type:"attack", attackId:"blitz"});
    expect(next.events.find(e => e.kind === "damageDealt")).toMatchObject({weakness:true});
    expect(next.players.P1.points).toBe(1);
    expect(next.winner).toBe("P1");
  });
});
