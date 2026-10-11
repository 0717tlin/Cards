import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, computeDamage, createBattle, getAvailableAttacks, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

function battle(...sources: string[]) {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL["israel-adesanya"]!), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "psychic", energyTypeP2: "colorless" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(CARD_POOL["the-last-stylebender"]!);
  state.players.P1.bench = sources.map(id => toInPlay(CARD_POOL[id]!));
  state.players.P1.hand = []; state.players.P1.pendingEnergy = null;
  state.players.P2.active = toInPlay({ ...CARD_POOL["tai-tuivasa"]!, weakness: null });
  state.players.P2.bench = [toInPlay(CARD_POOL.merab!)];
  return state;
}

describe("The Last Stylebender's Hatake", () => {
  it("evolves from Israel while preserving damage and energy", () => {
    const state = battle("merab");
    state.players.P1.active!.card = CARD_POOL["israel-adesanya"]!;
    state.players.P1.active!.damage = 10; state.players.P1.active!.attached = ["psychic"];
    state.players.P1.hand = [CARD_POOL["the-last-stylebender"]!];
    const next = applyMove(state, { type: "evolve", handIndex: 0, targetUid: state.players.P1.active!.uid });
    expect(next.players.P1.active).toMatchObject({ card: { name: "The Last Stylebender", hp: 120, rarity: "rare", retreatCost: 2, attacks: [] }, damage: 10, attached: ["psychic"], previousStages: [CARD_POOL["israel-adesanya"]] });
  });

  it("requires energy on Stylebender, excludes ex attacks, and deduplicates duplicate sources", () => {
    const state = battle("petr-yan", "petr-yan", "joshua-van-ex");
    state.players.P1.bench[0]!.attached = ["psychic", "psychic"];
    expect(getLegalMoves(state).filter(move => move.type === "attack")).toEqual([]);
    state.players.P1.active!.attached = ["psychic", "psychic"];
    expect(getAvailableAttacks(state.players.P1.active!, state.players.P1.bench).map(attack => attack.id)).toEqual(["left-hook"]);
    expect(getLegalMoves(state).filter(move => move.type === "attack")).toEqual([{ type: "attack", attackId: "left-hook" }]);
    expect(() => applyMove(state, { type: "attack", attackId: "slick-jab" })).toThrow();
    state.players.P1.bench = [];
    expect(() => applyMove(state, { type: "attack", attackId: "left-hook" })).toThrow();
  });

  it("uses Stylebender's type and copied attack effects without changing its source", () => {
    const state = battle("islam-makhachev");
    state.players.P1.active!.attached = ["water", "colorless"];
    state.players.P2.active!.card = { ...state.players.P2.active!.card, weakness: "psychic" };
    const before = structuredClone(state);
    const copied = getAvailableAttacks(state.players.P1.active!, state.players.P1.bench)[0]!;
    expect(computeDamage(state.players.P1.active!, state.players.P2.active!, copied, 0, state.players.P1.bench)).toBe(100);
    const next = applyMove(state, { type: "attack", attackId: "koshi-guruma" });
    expect(next.players.P2.active!.damage).toBe(100);
    expect(next.players.P1.active!.attached).toEqual(["water", "colorless"]);
    expect(next.players.P1.bench).toMatchObject(state.players.P1.bench);
    expect(next.turnPlayer).toBe("P2"); expect(state).toEqual(before);
  });

  it("keeps copied target selection and energy-discard effects", () => {
    const state = battle("connor-mcgregor"); state.players.P1.active!.attached = ["grass", "grass", "psychic"];
    const target = state.players.P2.bench[0]!;
    expect(getLegalMoves(state)).toContainEqual({ type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
    const next = applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
    expect(next.players.P2.bench[0]!.damage).toBe(50);
    expect(next.players.P1.active!.attached).toEqual([]);
  });

  it("still respects paralysis and does not recursively borrow attacks", () => {
    const state = battle("the-last-stylebender", "merab"); state.players.P1.active!.attached = ["psychic"];
    expect(getAvailableAttacks(state.players.P1.active!, state.players.P1.bench).map(attack => attack.id)).toEqual(["single-leg"]);
    state.players.P1.active!.paralyzed = true;
    expect(getLegalMoves(state).some(move => move.type === "attack")).toBe(false);
  });

  it("lets the AI use a copied attack for a winning knockout", () => {
    const state = battle("petr-yan"); state.players.P1.active!.attached = ["psychic", "psychic"];
    state.players.P1.points = 2; state.players.P2.active!.damage = 100;
    const move = chooseMove(state);
    expect(move).toEqual({ type: "attack", attackId: "left-hook" });
    expect(applyMove(state, move).winner).toBe("P1");
  });
});
