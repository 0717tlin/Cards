import { describe, expect, it } from "vitest";
import { applyMove, chooseMove, createBattle, getLegalMoves, CARD_POOL, computeDamage } from "./index.js";
import type { EnergyType } from "./types.js";

const ilia = CARD_POOL["ilia-topuria"]!;
const rightHook = ilia.attacks[1]!;
function battle(attached: EnergyType[], weakness: EnergyType | null = null, hp = 200) {
  const defender = { ...CARD_POOL.tidefin!, hp, weakness };
  const state = createBattle({seed: 12, deckP1: Array(20).fill(ilia), deckP2: Array(20).fill(defender), energyTypeP1: "fire", energyTypeP2: "water"});
  state.turnPlayer = "P1";
  state.players.P1.active!.attached = attached;
  return state;
}

describe("Right Hook", () => {
  it.each([
    [["water", "grass"], 50],
    [["fire", "water"], 60],
    [["fire", "fire"], 70],
    [["fire", "fire", "fire", "water"], 80],
  ] as [EnergyType[], number][])("counts only attached fire energy: %j", (energy, expected) => {
    const state = battle(energy);
    const original = structuredClone(state);
    const next = applyMove(state, {type: "attack", attackId: "right-hook"});
    expect(next.players.P2.active!.damage).toBe(expected);
    expect(next.events.find(event => event.kind === "damageDealt")).toMatchObject({amount: expected});
    expect(state).toEqual(original);
  });
  it("requires two energy of any type and does not consume them", () => {
    const state = battle(["fire"]);
    expect(getLegalMoves(state)).not.toContainEqual({type: "attack", attackId: "right-hook"});
    expect(() => applyMove(state, {type: "attack", attackId: "right-hook"})).toThrow();
    const next = applyMove(battle(["fire", "water"]), {type: "attack", attackId: "right-hook"});
    expect(next.players.P1.active!.attached).toEqual(["fire", "water"]);
  });
  it("adds weakness after bonus damage and resolves knockouts", () => {
    const next = applyMove(battle(["fire", "fire"], "fire", 90), {type: "attack", attackId: "right-hook"});
    expect(next.events.find(event => event.kind === "damageDealt")).toMatchObject({amount: 90, weakness: true});
    expect(next.players.P1.points).toBe(1);
    expect(next.winner).toBe("P1");
  });
  it("keeps Jab at 20 damage regardless of excess fire energy", () => {
    const state = battle(["fire", "fire", "fire"]);
    expect(computeDamage(state.players.P1.active!, state.players.P2.active!, ilia.attacks[0]!)).toBe(20);
  });
  it("lets AI rank effect damage above a higher base-damage attack", () => {
    const state = battle(["fire", "fire", "fire"]);
    state.players.P1.hand = [];
    state.players.P1.hasRetreated = true;
    state.players.P1.active!.card = {...ilia, attacks: [...ilia.attacks, {id: "flat", name: "Flat", cost: [], damage: 75}]};
    expect(chooseMove(state)).toEqual({type: "attack", attackId: "right-hook"});
  });
});
