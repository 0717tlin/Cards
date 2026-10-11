import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, createBattle, getLegalMoves, TRAINER_POOL } from "./index.js";
import { toInPlay } from "./setup.js";

function battle() {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL.merab!), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "water", energyTypeP2: "water" });
  state.turnPlayer = "P1";
  state.turnNumber = 4;
  state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(CARD_POOL.merab!);
  state.players.P1.active.attached = ["water"];
  state.players.P1.hand = [TRAINER_POOL["herb-dean"]!, TRAINER_POOL["dana-white"]!];
  state.players.P1.hasPlayedSupporter = false;
  state.players.P2.active = toInPlay(CARD_POOL["tai-tuivasa"]!);
  return state;
}

describe("Herb Dean", () => {
  it("adds ten attack damage, discards the Supporter, and enforces the one-Supporter limit", () => {
    const original = battle();
    const snapshot = structuredClone(original);
    const boosted = applyMove(original, { type: "playTrainer", handIndex: 0 });
    expect(boosted.players.P1.attackDamageBonus).toBe(10);
    expect(boosted.players.P1.discard).toContainEqual({ kind: "trainer", card: TRAINER_POOL["herb-dean"] });
    expect(getLegalMoves(boosted).some(move => move.type === "playTrainer")).toBe(false);
    expect(boosted.events.at(-1)).toEqual({ kind: "attackDamageBoosted", player: "P1", amount: 10 });
    const hit = applyMove(boosted, { type: "attack", attackId: "single-leg" });
    expect(hit.players.P2.active!.damage).toBe(30);
    expect(hit.players.P1.attackDamageBonus).toBe(0);
    expect(original).toEqual(snapshot);
  });

  it("applies before damage reduction and alongside weakness", () => {
    let state = battle();
    state.players.P2.active!.card = { ...state.players.P2.active!.card, weakness: "colorless" };
    state.players.P2.active!.damageReduction = 15;
    state = applyMove(state, { type: "playTrainer", handIndex: 0 });
    const hit = applyMove(state, { type: "attack", attackId: "single-leg" });
    expect(hit.players.P2.active!.damage).toBe(35);
  });

  it("follows the player when they retreat into a different fighter", () => {
    let state = battle();
    const giga = toInPlay(CARD_POOL["giga-chikadze"]!);
    giga.attached = ["psychic", "water"];
    state.players.P1.bench = [giga];
    state = applyMove(state, { type: "playTrainer", handIndex: 0 });
    state = applyMove(state, { type: "retreat", benchIndex: 0 });
    const hit = applyMove(state, { type: "attack", attackId: "giga-kick" });
    expect(hit.players.P2.active!.damage).toBe(70);
  });

  it("expires when passing and never boosts the opponent or a later turn", () => {
    let state = applyMove(battle(), { type: "playTrainer", handIndex: 0 });
    state = applyMove(state, { type: "pass" });
    expect(state.players.P1.attackDamageBonus).toBe(0);
    expect(state.players.P2.attackDamageBonus).toBe(0);
    state = applyMove(state, { type: "pass" });
    const hit = applyMove(state, { type: "attack", attackId: "single-leg" });
    expect(hit.players.P2.active!.damage).toBe(20);
  });

  it("does not increase bench damage", () => {
    let state = battle();
    state.players.P1.active = toInPlay(CARD_POOL["umar-nurmagomedov"]!);
    state.players.P1.active.card = { ...state.players.P1.active.card, attacks: [{ id: "grapple", name: "Bench attack", cost: ["water"], damage: 0, effects: [{ kind: "benchDamage", amount: 20, chooseWithCardId: "khabib-nurmagomedov" }] }] };
    state.players.P1.active.attached = ["water"];
    state.players.P2.bench = [toInPlay(CARD_POOL.merab!)];
    state = applyMove(state, { type: "playTrainer", handIndex: 0 });
    const hit = applyMove(state, { type: "attack", attackId: "grapple" });
    expect(hit.players.P2.active!.damage).toBe(0);
    expect(hit.players.P2.bench[0]!.damage).toBe(20);
  });

  it("does not turn status-only attacks into damage or increase Burn checkup damage", () => {
    let state = battle();
    state.players.P1.active = toInPlay(CARD_POOL["bobby-green"]!);
    state.players.P1.active.attached = ["grass"];
    state = applyMove(state, { type: "playTrainer", handIndex: 0 });
    const hit = applyMove(state, { type: "attack", attackId: "trash-talk" });
    expect(hit.players.P2.active!.damage).toBe(20);
    expect(hit.events.filter(event => event.kind === "damageDealt").map(event => event.kind === "damageDealt" ? event.amount : -1)).toEqual([0, 20]);
  });
});
