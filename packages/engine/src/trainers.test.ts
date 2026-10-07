import { describe, expect, it } from "vitest";
import { createBattle, applyMove, getLegalMoves, getRetreatCost, chooseMove, CARD_POOL, TRAINER_POOL, isCreatureCard } from "./index.js";
import type { BattleState, CardDefinition, Move } from "./types.js";
function fixture(ids: string[]): BattleState {
  const state = createBattle({seed: 15, deckP1: Array(20).fill(CARD_POOL.emberpup!), deckP2: Array(20).fill(CARD_POOL.tidefin!), energyTypeP1: "fire", energyTypeP2: "water"});
  state.turnPlayer = "P1";
  state.players.P1.hand = ids.map(id => TRAINER_POOL[id]!);
  state.players.P1.active!.damage = 45;
  state.players.P1.bench = [{uid: "bench", card: CARD_POOL.cinderhorn!, damage: 70, attached: []}];
  return state;
}
function play(state: BattleState, name: string, targetUid?: string): BattleState {
  const handIndex = state.players.P1.hand.findIndex(card => card.name === name);
  return applyMove(state, {type: "playTrainer", handIndex, ...(targetUid ? {targetUid} : {})});
}

describe("items and supporters", () => {
  it("heals active or bench, allows repeated items, and discards each card", () => {
    const state = fixture(["bandages", "bandages", "bandages"]);
    const before = structuredClone(state);
    let next = play(state, "Bandages", "bench");
    expect(next.players.P1.bench[0]!.damage).toBe(50);
    next = play(next, "Bandages", next.players.P1.active!.uid);
    next = play(next, "Bandages", next.players.P1.active!.uid);
    expect(next.players.P1.active!.damage).toBe(5);
    expect(next.players.P1.discard.filter(entry => entry.kind === "trainer")).toHaveLength(3);
    expect(next.players.P1.hasPlayedSupporter).toBe(false);
    expect(next.turnPlayer).toBe("P1");
    expect(state).toEqual(before);
  });
  it("caps healing at full HP and rejects undamaged/opponent targets", () => {
    let state = fixture(["bandages", "bandages"]);
    state.players.P1.active!.damage = 5;
    const uid = state.players.P1.active!.uid;
    state = play(state, "Bandages", uid);
    expect(state.players.P1.active!.damage).toBe(0);
    expect(getLegalMoves(state)).not.toContainEqual({type: "playTrainer", handIndex: 0, targetUid: uid});
    expect(() => play(state, "Bandages", state.players.P2.active!.uid)).toThrow();
    expect(state.events.find(event => event.kind === "healed")).toMatchObject({amount: 5});
  });
  it("Cutman heals only the active for 30 and uses the Supporter allowance", () => {
    const state = fixture(["cutman", "dana-white", "bandages"]);
    expect(() => play(state, "Cutman", "bench")).toThrow();
    let next = play(state, "Cutman", state.players.P1.active!.uid);
    expect(next.players.P1.active!.damage).toBe(15);
    expect(next.players.P1.hasPlayedSupporter).toBe(true);
    expect(() => play(next, "Dana White")).toThrow();
    next = play(next, "Bandages", "bench");
    expect(next.players.P1.bench[0]!.damage).toBe(50);
  });
  it("Dana White draws in order, emits two draws, and Supporters reset next turn", () => {
    let state = fixture(["dana-white", "cutman"]);
    const top = state.players.P1.deck.slice(0, 2);
    state = play(state, "Dana White");
    expect(state.players.P1.hand.slice(-2)).toEqual(top);
    expect(state.events.slice(-3).map(event => event.kind)).toEqual(["trainerPlayed", "cardDrawn", "cardDrawn"]);
    expect(() => play(state, "Cutman", state.players.P1.active!.uid)).toThrow();
    state = applyMove(applyMove(state, {type: "pass"}), {type: "pass"});
    expect(state.players.P1.hasPlayedSupporter).toBe(false);
    expect(() => play(state, "Cutman", state.players.P1.active!.uid)).not.toThrow();
  });
  it("draws the remaining card without deck-out, but cannot draw from empty", () => {
    let state = fixture(["dana-white"]);
    state.players.P1.deck = [CARD_POOL.emberpup!];
    state = play(state, "Dana White");
    expect(state.players.P1.deck).toHaveLength(0);
    expect(state.players.P1.hand).toHaveLength(1);
    expect(state.winner).toBeNull();
    state = fixture(["dana-white"]);
    state.players.P1.deck = [];
    expect(() => play(state, "Dana White")).toThrow();
  });
  it("stacks retreat reductions, caps at zero, and pays the discounted cost", () => {
    let state = fixture(["footwork-drill", "footwork-drill"]);
    state.players.P1.active!.card = CARD_POOL.cinderhorn!;
    expect(getRetreatCost(state.players.P1)).toBe(2);
    state = play(state, "Footwork Drill");
    expect(getRetreatCost(state.players.P1)).toBe(1);
    expect(getLegalMoves(state)).not.toContainEqual({type: "retreat", benchIndex: 0});
    state = play(state, "Footwork Drill");
    expect(getRetreatCost(state.players.P1)).toBe(0);
    state = applyMove(state, {type: "retreat", benchIndex: 0});
    expect(state.events.at(-1)).toMatchObject({kind: "retreated", paid: []});
    expect(state.players.P1.hasRetreated).toBe(true);
  });
  it("retreat reductions expire at end of turn and do not change the card", () => {
    let state = fixture(["footwork-drill"]);
    state = play(state, "Footwork Drill");
    expect(getRetreatCost(state.players.P1)).toBe(0);
    expect(state.players.P1.active!.card.retreatCost).toBe(1);
    state = applyMove(state, {type: "pass"});
    expect(state.players.P1.retreatReduction).toBe(0);
    expect(getRetreatCost(state.players.P1)).toBe(1);
  });
  it("rejects trainers while promotion is required or after a win", () => {
    const state = fixture(["bandages"]);
    state.phase = {kind: "awaitPromotion", player: "P1"};
    expect(getLegalMoves(state).every(move => move.type === "promote")).toBe(true);
    state.winner = "P1";
    expect(getLegalMoves(state)).toEqual([]);
  });
  it("sets up mixed decks with a Basic active and trainer cards in hand/library", () => {
    const deck: CardDefinition[] = [CARD_POOL.emberpup!, ...Array(19).fill(TRAINER_POOL.bandages!)];
    const state = createBattle({seed: 2, deckP1: deck, deckP2: deck, energyTypeP1: "fire", energyTypeP2: "fire"});
    expect(isCreatureCard(state.players.P1.active!.card)).toBe(true);
    expect(state.players.P1.hand.every(card => card.kind === "item")).toBe(true);
  });
  it("AI resolves trainer plays without looping indefinitely", () => {
    let state = fixture(["bandages", "cutman", "dana-white", "footwork-drill"]);
    const moves: Move[] = [];
    for (let i = 0; i < 30 && state.turnPlayer === "P1" && !state.winner; i++) {
      const move = chooseMove(state);
      expect(getLegalMoves(state)).toContainEqual(move);
      moves.push(move);
      state = applyMove(state, move);
    }
    expect(moves.some(move => move.type === "playTrainer")).toBe(true);
    expect(state.turnPlayer).toBe("P2");
  });
});
