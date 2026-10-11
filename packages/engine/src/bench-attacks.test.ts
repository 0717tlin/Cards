import { describe, expect, it } from "vitest";
import { CARD_POOL, applyMove, chooseMove, createBattle, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";
import { nextInt } from "./rng.js";
// Synthetic fixture keeps bench-damage rules covered independently of live card changes.
const umar: import("./types.js").FighterCard = { ...CARD_POOL["umar-nurmagomedov"]!, attacks: [{ id: "grapple", name: "Grapple", cost: ["water"], damage: 0, effects: [{ kind: "benchDamage", amount: 20, chooseWithCardId: "khabib-nurmagomedov" }] }] };
const khabib = CARD_POOL["khabib-nurmagomedov"]!;
const islamEx = CARD_POOL["islam-makhachev-ex"]!;
function battle(withKhabib = false) {
  const state = createBattle({seed: 12, deckP1: Array(20).fill(umar), deckP2: Array(20).fill(khabib), energyTypeP1: "water", energyTypeP2: "water"});
  state.turnPlayer = "P1";
  state.players.P1.active!.attached = ["water"];
  state.players.P1.bench = withKhabib ? [toInPlay(khabib)] : [];
  state.players.P2.bench = [toInPlay(khabib), toInPlay(islamEx), toInPlay(umar)];
  return state;
}
describe("bench-damage attacks", () => {
  it("matches the card stats and requires Water energy", () => {
    expect(umar).toMatchObject({hp:60,type:"water",attacks:[{name:"Grapple",damage:0,cost:["water"]}]});
    const state = battle();
    state.players.P1.active!.attached = ["fire"];
    expect(getLegalMoves(state).some(move => move.type === "attack")).toBe(false);
  });
  it.each([1, 2, 3, 4, 5, 6])("damages exactly one random bench target with seeded RNG (%i)", seed => {
    const state = battle();
    state.rngState = seed;
    const snapshot = structuredClone(state);
    const expected = nextInt(seed, 3);
    const hit = applyMove(state, {type:"attack",attackId:"grapple"});
    expect(hit.players.P2.active!.damage).toBe(0);
    expect(hit.players.P2.bench.map(fighter => fighter.damage)).toEqual([0,1,2].map(index => index === expected.value ? 20 : 0));
    expect(hit.rngState).toBe(expected.state);
    expect(hit.turnPlayer).toBe("P2");
    expect(hit.events.find(event => event.kind === "attackUsed")).toMatchObject({targetUid:state.players.P2.bench[expected.value]!.uid});
    expect(state).toEqual(snapshot);
  });
  it("allows choosing any opposing bench target only with your own benched Khabib", () => {
    const state = battle(true);
    const targets = state.players.P2.bench;
    for (const target of targets) expect(getLegalMoves(state)).toContainEqual({type:"attack",attackId:"grapple",targetUid:target.uid});
    expect(() => applyMove(state, {type:"attack",attackId:"grapple"})).toThrow("Illegal move");
    expect(() => applyMove(state, {type:"attack",attackId:"grapple",targetUid:state.players.P2.active!.uid})).toThrow("Illegal move");
    expect(() => applyMove(state, {type:"attack",attackId:"grapple",targetUid:state.players.P1.bench[0]!.uid})).toThrow("Illegal move");
    const hit = applyMove(state, {type:"attack",attackId:"grapple",targetUid:targets[1]!.uid});
    expect(hit.players.P2.bench.map(fighter => fighter.damage)).toEqual([0,20,0]);
    expect(hit.rngState).toBe(state.rngState);
    const withoutKhabib = battle();
    expect(() => applyMove(withoutKhabib, {type:"attack",attackId:"grapple",targetUid:withoutKhabib.players.P2.bench[0]!.uid})).toThrow("Illegal move");
  });
  it("ignores bench weakness and damage reduction", () => {
    const state = battle(true);
    const target = state.players.P2.bench[0]!;
    target.card = {...target.card,weakness:"water"};
    target.damageReduction = 10;
    const hit = applyMove(state, {type:"attack",attackId:"grapple",targetUid:target.uid});
    expect(hit.players.P2.bench[0]!.damage).toBe(20);
    expect(hit.events.find(event => event.kind === "damageDealt")).toMatchObject({amount:20,weakness:false});
  });
  it.each([false,true])("ends the turn without damaging the active if the bench is empty (Khabib: %s)", withKhabib => {
    const state = battle(withKhabib);
    state.players.P2.bench = [];
    const hit = applyMove(state, {type:"attack",attackId:"grapple"});
    expect(hit.players.P2.active!.damage).toBe(0);
    expect(hit.events.some(event => event.kind === "damageDealt")).toBe(false);
    expect(hit.turnPlayer).toBe("P2");
  });
  it.each([khabib,islamEx])("handles bench knockouts, discard and points (%s)", card => {
    const state = battle(true);
    const target = toInPlay(card);
    target.damage = card.hp - 20;
    target.attached = ["water"];
    state.players.P2.bench = [target];
    const hit = applyMove(state, {type:"attack",attackId:"grapple",targetUid:target.uid});
    expect(hit.players.P2.bench).toEqual([]);
    expect(hit.players.P2.active!.damage).toBe(0);
    expect(hit.players.P2.discard).toContainEqual({kind:"fighter",card});
    expect(hit.players.P2.discard).toContainEqual({kind:"energy",energy:"water"});
    expect(hit.players.P1.points).toBe(card.isEx ? 2 : 1);
    expect(hit.phase).toEqual({kind:"main"});
    expect(hit.winner).toBeNull();
  });
  it("wins on bench knockout points and lets AI pick the best target", () => {
    const state = battle(true);
    // Evaluate attack selection after the benched Khabib has used Fathers Plan.
    state.players.P1.bench[0]!.abilityUsedTurn = state.turnNumber;
    state.players.P1.hand = [];
    state.players.P1.pendingEnergy = null;
    state.players.P1.points = 1;
    const target = state.players.P2.bench[1]!;
    target.damage = target.card.hp - 20;
    const move = {type:"attack" as const,attackId:"grapple",targetUid:target.uid};
    expect(chooseMove(state)).toEqual(move);
    const hit = applyMove(state, move);
    expect(hit.players.P1.points).toBe(3);
    expect(hit.winner).toBe("P1");
  });
});
