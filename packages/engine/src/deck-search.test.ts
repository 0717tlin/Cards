import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, createBattle, getLegalMoves, TRAINER_POOL } from "./index.js";
import { nextInt, shuffle } from "./rng.js";
import { toInPlay } from "./setup.js";

const khabib = { ...CARD_POOL["khabib-nurmagomedov"]!, ability: {
  name: "Search fixture", text: "Search for a named fighter.",
  effect: { kind: "searchDeckToTop" as const, cardIds: ["islam-makhachev", "umar-nurmagomedov"] },
} };
const islam = { ...CARD_POOL["islam-makhachev"]!, stage: "basic" as const, evolvesFrom: undefined };
const islamEx = CARD_POOL["islam-makhachev-ex"]!;
const umar = CARD_POOL["umar-nurmagomedov"]!;
const contract = TRAINER_POOL["fight-contract"]!;

function battle() {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(khabib), deckP2: Array(20).fill(khabib), energyTypeP1: "water", energyTypeP2: "water" });
  state.turnPlayer = "P1";
  state.turnNumber = 4;
  state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(khabib);
  state.players.P1.bench = [toInPlay(khabib)];
  state.players.P1.deck = [TRAINER_POOL.bandages!, islamEx, umar, islam, umar, CARD_POOL["do-bronx"]!];
  state.players.P1.hand = [contract];
  return state;
}

describe("Activated deck search", () => {
  it("offers regular Islam and Umar for active and benched Khabib, but never Islam ex", () => {
    const state = battle();
    expect(khabib.rarity).toBe("rare");
    for (const fighter of [state.players.P1.active!, ...state.players.P1.bench]) {
      for (const card of [islam, umar]) expect(getLegalMoves(state)).toContainEqual({ type: "useAbility", targetUid: fighter.uid, cardId: card.id });
    }
    expect(() => applyMove(state, { type: "useAbility", targetUid: state.players.P1.active!.uid, cardId: islamEx.id })).toThrow("Illegal move");
    expect(() => applyMove(state, { type: "useAbility", targetUid: state.players.P1.active!.uid })).toThrow("Illegal move");
  });

  it("moves exactly one chosen card to the top without drawing or shuffling", () => {
    const state = battle();
    const snapshot = structuredClone(state);
    const next = applyMove(state, { type: "useAbility", targetUid: state.players.P1.bench[0]!.uid, cardId: umar.id });
    expect(next.players.P1.deck).toEqual([umar, TRAINER_POOL.bandages!, islamEx, islam, umar, CARD_POOL["do-bronx"]!]);
    expect(next.players.P1.hand).toEqual(state.players.P1.hand);
    expect(next.rngState).toBe(state.rngState);
    expect(next.turnPlayer).toBe("P1");
    expect(next.events.slice(state.events.length)).toEqual([{ kind: "abilityUsed", player: "P1", uid: state.players.P1.bench[0]!.uid, name: "Search fixture" }]);
    expect(state).toEqual(snapshot);
  });

  it("limits each Khabib to once per own turn, including after retreat, and resets next turn", () => {
    let state = battle();
    const uid = state.players.P1.active!.uid;
    state.players.P1.active!.attached = ["water"];
    state = applyMove(state, { type: "useAbility", targetUid: uid, cardId: islam.id });
    state = applyMove(state, { type: "retreat", benchIndex: 0 });
    expect(getLegalMoves(state).some(move => move.type === "useAbility" && move.targetUid === uid)).toBe(false);
    expect(getLegalMoves(state).some(move => move.type === "useAbility" && move.targetUid === state.players.P1.active!.uid)).toBe(true);
    expect(() => applyMove(state, { type: "useAbility", targetUid: uid, cardId: umar.id })).toThrow("Illegal move");
    state = applyMove(applyMove(state, { type: "pass" }), { type: "pass" });
    expect(getLegalMoves(state)).toContainEqual({ type: "useAbility", targetUid: uid, cardId: umar.id });
  });

  it("does not offer a search when only Islam ex or unrelated cards remain", () => {
    const state = battle();
    state.players.P1.deck = [islamEx, khabib, TRAINER_POOL.bandages!];
    expect(getLegalMoves(state).some(move => move.type === "useAbility")).toBe(false);
  });

  it("lets the AI use the search once without looping", () => {
    const state = battle();
    state.players.P1.bench = [];
    const move = chooseMove(state);
    expect(move).toEqual({ type: "useAbility", targetUid: state.players.P1.active!.uid, cardId: islam.id });
    const next = applyMove(state, move);
    expect(chooseMove(next).type).not.toBe("useAbility");
  });
});

describe("Fight Contract", () => {
  it.each([1, 2, 3, 4, 5, 6])("draws a seeded random Basic fighter, then shuffles only the remaining deck (%i)", seed => {
    const state = battle();
    state.rngState = seed;
    state.players.P1.hasPlayedSupporter = true;
    const snapshot = structuredClone(state);
    // Only indexes 1–4 are Basic fighters; bandages and Do Bronx are ineligible.
    const roll = nextInt(seed, 4);
    const drawnIndex = [1, 2, 3, 4][roll.value]!;
    const drawn = state.players.P1.deck[drawnIndex]!;
    const remaining = state.players.P1.deck.filter((_, index) => index !== drawnIndex);
    const expected = shuffle(roll.state, remaining);
    const next = applyMove(state, { type: "playTrainer", handIndex: 0 });
    expect(next.players.P1.hand).toEqual([drawn]);
    expect(next.players.P1.deck).toEqual(expected.value);
    expect(next.rngState).toBe(expected.state);
    expect(next.players.P1.discard).toContainEqual({ kind: "trainer", card: contract });
    expect(next.players.P1.hasPlayedSupporter).toBe(true);
    expect(next.turnPlayer).toBe("P1");
    expect(next.events.slice(state.events.length).map(event => event.kind)).toEqual(["trainerPlayed", "cardDrawn", "deckShuffled"]);
    expect(state).toEqual(snapshot);
  });

  it("is unavailable when there are no Basic fighters, including an empty deck", () => {
    const state = battle();
    for (const deck of [[], [TRAINER_POOL.bandages!, CARD_POOL["do-bronx"]!]]) {
      state.players.P1.deck = deck;
      expect(getLegalMoves(state).some(move => move.type === "playTrainer")).toBe(false);
      expect(() => applyMove(state, { type: "playTrainer", handIndex: 0 })).toThrow("Illegal move");
    }
  });

  it("can draw the last remaining card and still emits a shuffle event", () => {
    const state = battle();
    state.players.P1.deck = [umar];
    const next = applyMove(state, { type: "playTrainer", handIndex: 0 });
    expect(next.players.P1.hand).toEqual([umar]);
    expect(next.players.P1.deck).toEqual([]);
    expect(next.events.at(-1)).toEqual({ kind: "deckShuffled", player: "P1" });
  });
});
