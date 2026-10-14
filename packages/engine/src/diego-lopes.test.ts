import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, computeDamage, createBattle, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

function battle(attacker = "merab") {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL.merab!), deckP2: Array(20).fill(CARD_POOL["diego-lopes"]!), energyTypeP1: "water", energyTypeP2: "steel" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(CARD_POOL[attacker]!);
  state.players.P1.active.attached = ["water", "grass", "grass"];
  state.players.P2.active = toInPlay(CARD_POOL["diego-lopes"]!);
  state.players.P2.bench = [toInPlay(CARD_POOL.merab!)];
  return state;
}

describe("Diego Lopes and Granite Chin", () => {
  it("requires Steel plus one other energy for Uppercut", () => {
    const state = battle(); state.players.P1.active = toInPlay(CARD_POOL["diego-lopes"]!);
    state.players.P1.active.attached = ["fire", "water"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "lopes-uppercut" });
    state.players.P1.active.attached = ["steel", "water"];
    expect(getLegalMoves(state)).toContainEqual({ type: "attack", attackId: "lopes-uppercut" });
  });

  it("reduces every active attack by 10 without consuming or expiring the ability", () => {
    let state = battle();
    state = applyMove(state, { type: "attack", attackId: "single-leg" });
    expect(state.players.P2.active!.damage).toBe(10);
    state = applyMove(state, { type: "pass" });
    state = applyMove(state, { type: "attack", attackId: "single-leg" });
    expect(state.players.P2.active!.damage).toBe(20);
    expect(state.players.P2.active!.card.ability?.name).toBe("Granite Chin");
  });

  it("reduces damage after weakness, stacks with temporary protection, and clamps at zero", () => {
    const state = battle(); const attacker = state.players.P1.active!, defender = state.players.P2.active!;
    const attack = { ...attacker.card.attacks[0]!, damage: 40 };
    attacker.card = { ...attacker.card, type: "fire" };
    expect(computeDamage(attacker, defender, attack)).toBe(50);
    defender.damageReduction = 10;
    expect(computeDamage(attacker, defender, attack)).toBe(40);
    attacker.card.type = "water";
    expect(computeDamage(attacker, defender, { ...attack, damage: 5 })).toBe(0);
  });

  it("also protects Diego on the bench from targeted attack damage", () => {
    const state = battle("connor-mcgregor");
    const target = state.players.P2.active!;
    state.players.P2.bench = [target]; state.players.P2.active = toInPlay(CARD_POOL.merab!);
    const next = applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
    expect(next.players.P2.bench[0]!.damage).toBe(40);
    expect(next.events.find(event => event.kind === "damageDealt")).toMatchObject({ amount: 40 });
  });

  it("does not reduce Burn or Bleeding checkup damage", () => {
    const state = battle(); state.players.P2.active!.burned = true; state.players.P2.active!.bleeding = true;
    const next = applyMove(state, { type: "pass" });
    expect(next.players.P2.active!.damage).toBe(30);
  });
});
