import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, createBattle, getAvailableAttacks, getLegalMoves, TRAINER_POOL } from "./index.js";
import { toInPlay } from "./setup.js";
import type { FighterCard } from "./types.js";

const khabib = CARD_POOL["khabib-nurmagomedov"]!;
const islam = CARD_POOL["islam-makhachev"]!;
const umar = CARD_POOL["umar-nurmagomedov"]!;
const plan = TRAINER_POOL["fathers-plan"]!;
function battle(card: FighterCard = islam) {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(khabib), deckP2: Array(20).fill(khabib), energyTypeP1: "water", energyTypeP2: "water" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(card); state.players.P1.bench = [];
  state.players.P1.hand = []; state.players.P1.pendingEnergy = null;
  state.players.P2.active = toInPlay({ ...CARD_POOL["tai-tuivasa"]!, hp: 200, weakness: null });
  state.players.P2.active.attached = Array(4).fill("colorless");
  state.players.P2.bench = [toInPlay(khabib)];
  return state;
}

describe("Father's Plan and Caucasus support", () => {
  it("searches all named non-ex stages, consumes the item, and never draws or shuffles", () => {
    const state = battle();
    const eligible = [CARD_POOL["islam-makhachev-prospect"]!, CARD_POOL["islam-makhachev-contender"]!, islam, umar,
      { ...umar, id: "umar-champion", stage: "stage2" as const }];
    const excluded = [CARD_POOL["islam-makhachev-ex"]!, { ...umar, id: "umar-ex", isEx: true }, khabib];
    state.players.P1.deck = [...excluded, ...eligible, islam]; state.players.P1.hand = [plan];
    state.players.P1.hasPlayedSupporter = true;
    const snapshot = structuredClone(state);
    for (const card of eligible) {
      const move = { type: "playTrainer" as const, handIndex: 0, cardId: card.id };
      expect(getLegalMoves(state)).toContainEqual(move);
      const next = applyMove(state, move);
      expect(next.players.P1.deck[0]).toEqual(card);
      expect(next.players.P1.deck).toHaveLength(state.players.P1.deck.length);
      expect(next.players.P1.hand).toEqual([]);
      expect(next.players.P1.discard.at(-1)).toEqual({ kind: "trainer", card: plan });
      expect(next.rngState).toBe(state.rngState); expect(next.turnPlayer).toBe("P1");
      expect(next.events.slice(state.events.length).map(event => event.kind)).toEqual(["trainerPlayed"]);
    }
    for (const card of excluded) expect(() => applyMove(state, { type: "playTrainer", handIndex: 0, cardId: card.id })).toThrow("Illegal move");
    expect(state).toEqual(snapshot);
    state.players.P1.deck = excluded;
    expect(getLegalMoves(state).some(move => move.type === "playTrainer")).toBe(false);
  });

  it("discounts exactly one Colorless for every eligible stage, without stacking or mutating cards", () => {
    for (const card of [umar, CARD_POOL["islam-makhachev-prospect"]!, CARD_POOL["islam-makhachev-contender"]!, islam]) {
      const synthetic = { ...card, attacks: [{ ...card.attacks[0]!, cost: ["water", "colorless", "colorless"] as const }] };
      const active = toInPlay({ ...synthetic, attacks: synthetic.attacks.map(attack => ({ ...attack, cost: [...attack.cost] })) });
      const before = structuredClone(active);
      expect(getAvailableAttacks(active, [toInPlay(khabib), toInPlay(khabib)])[0]!.cost).toEqual(["water", "colorless"]);
      expect(active).toEqual(before);
    }
    const state = battle(); state.players.P1.active!.attached = ["water"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "koshi-guruma" });
    state.players.P1.bench = [toInPlay(khabib)];
    expect(getLegalMoves(state)).toContainEqual({ type: "attack", attackId: "koshi-guruma" });
    state.players.P1.active!.attached = ["colorless"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "koshi-guruma" });
    for (const card of [CARD_POOL["islam-makhachev-ex"]!, { ...umar, isEx: true }, CARD_POOL.merab!]) {
      expect(getAvailableAttacks(toInPlay(card), [toInPlay(khabib)])).toEqual(card.attacks);
    }
    const benchedUmar = toInPlay(umar);
    expect(getAvailableAttacks(benchedUmar, [toInPlay(khabib)])[0]!.cost).toEqual([]);
    expect(getAvailableAttacks(toInPlay(khabib), [benchedUmar])[0]!.cost).toEqual(["water"]);
    expect(getLegalMoves(state).some(move => move.type === "useAbility")).toBe(false);
  });

  it("lets Umar use any energy and resolve heads or tails independently of Khabib", () => {
    const outcomes = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const state = battle(umar); state.rngState = seed;
      state.players.P1.active!.attached = ["fire"];
      const next = applyMove(state, { type: "attack", attackId: "umar-calf-kick" });
      outcomes.add(next.players.P2.active!.damage);
      const flip = next.events.find(event => event.kind === "coinFlipped");
      expect(flip).toBeDefined();
      expect(next.players.P2.active!.damage).toBe(flip?.kind === "coinFlipped" && flip.result === "heads" ? 40 : 20);
    }
    expect(outcomes).toEqual(new Set([20, 40]));
  });

  it("evolves Prospect to Contender to Champion on successive turns", () => {
    let state = battle(CARD_POOL["islam-makhachev-prospect"]!);
    state.players.P1.hand = [CARD_POOL["islam-makhachev-contender"]!, islam];
    const uid = state.players.P1.active!.uid;
    expect(() => applyMove(state, { type: "evolve", handIndex: 1, targetUid: uid })).toThrow();
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid });
    expect(() => applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid })).toThrow();
    state = applyMove(applyMove(state, { type: "pass" }), { type: "pass" });
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid });
    expect(state.players.P1.active!.card).toMatchObject({ hp: 140, retreatCost: 2, stage: "stage2" });
  });
});

describe("Koshi Guruma's defending-fighter retreat lock", () => {
  it("blocks retreat but allows attacks and expires after the defender's turn", () => {
    const state = battle(); state.players.P1.active!.attached = ["water", "colorless"];
    const next = applyMove(state, { type: "attack", attackId: "koshi-guruma" });
    expect(next.players.P2.active!.damage).toBe(80);
    expect(next.players.P2.active!.cannotRetreat).toBe(true);
    expect(getLegalMoves(next).some(move => move.type === "retreat")).toBe(false);
    expect(getLegalMoves(next).some(move => move.type === "attack")).toBe(true);
    const expired = applyMove(applyMove(next, { type: "pass" }), { type: "pass" });
    expect(expired.players.P2.active!.cannotRetreat).toBe(false);
    expect(getLegalMoves(expired)).toContainEqual({ type: "retreat", benchIndex: 0 });
  });
  it("permits forced switching and does not transfer the lock to the new active fighter", () => {
    const state = battle(); state.players.P1.active!.attached = ["water", "colorless"];
    let next = applyMove(state, { type: "attack", attackId: "koshi-guruma" });
    next = applyMove(next, { type: "pass" });
    next.players.P1.hand = [TRAINER_POOL["ali-abdelaziz"]!]; next.players.P2.bench[0]!.damage = 10;
    const incoming = next.players.P2.bench[0]!.uid;
    next = applyMove(next, { type: "playTrainer", handIndex: 0, targetUid: incoming });
    expect(next.players.P2.active!.uid).toBe(incoming);
    expect(!!next.players.P2.active!.cannotRetreat).toBe(false);
    expect(next.players.P2.bench[0]!.cannotRetreat).toBe(false);
  });
});
