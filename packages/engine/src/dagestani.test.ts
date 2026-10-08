import { describe, expect, it } from "vitest";
import { applyMove, createBattle, getLegalMoves, getRetreatCost, CARD_POOL } from "./index.js";
import { toInPlay } from "./setup.js";
import type { FighterCard } from "./types.js";

const khabib = CARD_POOL["khabib-nurmagomedov"]!;
const islam = CARD_POOL["islam-makhachev"]!;
const islamEx = CARD_POOL["islam-makhachev-ex"]!;
function battle(attacker = islam, hp = 60, defender: FighterCard = CARD_POOL["khabib-nurmagomedov"]!) {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(attacker), deckP2: Array(20).fill({...defender, hp, weakness: null}), energyTypeP1: "water", energyTypeP2: "water" });
  state.turnPlayer = "P1";
  state.players.P1.active!.attached = ["water", "water", "colorless"];
  state.players.P2.active!.attached = ["water", "water"];
  state.players.P2.bench = [toInPlay(CARD_POOL["khabib-nurmagomedov"]!)];
  return state;
}

describe("Dagestani fighters", () => {
  it.each([[99, true], [100, true], [101, false]])("D'arce paralyzes at 30 remaining HP or less (%i)", (hp, paralyzed) => {
    const next = applyMove(battle(islamEx, hp), {type: "attack", attackId: "darce"});
    expect(next.players.P2.active!.damage).toBe(70);
    expect(!!next.players.P2.active!.paralyzed).toBe(paralyzed);
    expect(getLegalMoves(next).some(move => move.type === "attack")).toBe(!paralyzed);
    expect(getLegalMoves(next).some(move => move.type === "retreat")).toBe(!paralyzed);
  });
  it("blocks attack and retreat for one turn, allows energy, and recovers after passing", () => {
    const original = battle(islamEx, 99);
    const snapshot = structuredClone(original);
    const hit = applyMove(original, {type: "attack", attackId: "darce"});
    expect(original).toEqual(snapshot);
    expect(getLegalMoves(hit).some(move => move.type === "attachEnergy")).toBe(true);
    expect(() => applyMove(hit, {type: "attack", attackId: "smother"})).toThrow("Illegal move");
    expect(() => applyMove(hit, {type: "retreat", benchIndex: 0})).toThrow("Illegal move");
    const recovered = applyMove(applyMove(hit, {type: "pass"}), {type: "pass"});
    expect(recovered.players.P2.active!.paralyzed).toBe(false);
    expect(getLegalMoves(recovered)).toContainEqual({type: "attack", attackId: "smother"});
  });
  it("Smother adds one retreat energy through the defender's turn only", () => {
    const state = battle(khabib, 100);
    state.players.P2.active!.attached = ["water"];
    const hit = applyMove(state, {type: "attack", attackId: "smother"});
    expect(getRetreatCost(hit.players.P2)).toBe(2);
    expect(getLegalMoves(hit).some(move => move.type === "retreat")).toBe(false);
    const reduced = {...hit, players: {...hit.players, P2: {...hit.players.P2, retreatReduction: 1}}};
    expect(getRetreatCost(reduced.players.P2)).toBe(1);
    const recovered = applyMove(hit, {type: "pass"});
    expect(getRetreatCost(recovered.players.P2)).toBe(1);
  });
  it("Calf Kick requires Khabib on the bench for its bonus, adds 10 once, and does not paralyze", () => {
    const state = battle(islam, 65);
    state.players.P1.bench = [toInPlay(khabib), toInPlay(khabib)];
    const hit = applyMove(state, {type: "attack", attackId: "islam-calf-kick"});
    expect(hit.players.P2.active!.damage).toBe(40);
    expect(!!hit.players.P2.active!.paralyzed).toBe(false);
    expect(islam.ability).toBeUndefined();
    state.players.P1.bench = [toInPlay(islam)];
    expect(applyMove(state, {type: "attack", attackId: "islam-calf-kick"}).players.P2.active!.damage).toBe(30);
  });
  it("ex has the specified Water cost and awards two knockout points", () => {
    const state = battle(islamEx, 60, islamEx);
    state.players.P1.active!.attached = ["fighting", "fighting", "colorless"];
    expect(getLegalMoves(state)).not.toContainEqual({type: "attack", attackId: "darce"});
    state.players.P1.active!.attached = ["water", "water", "fighting"];
    state.players.P1.points = 1;
    const hit = applyMove(state, {type: "attack", attackId: "darce"});
    expect(hit.players.P1.points).toBe(3);
    expect(hit.winner).toBe("P1");
    expect(hit.events.find(event => event.kind === "knockedOut")).toMatchObject({pointsAwarded: 2});
    expect(hit.events.find(event => event.kind === "knockedOut")?.kind).toBe("knockedOut");
  });
});
