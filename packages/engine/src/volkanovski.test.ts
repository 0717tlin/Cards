import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, createBattle, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

const volk = CARD_POOL["alexander-volkanovski"]!;
const volkEx = CARD_POOL["alexander-volkanovski-ex"]!;

function battle() {
  const state = createBattle({
    seed: 12, deckP1: Array(20).fill(volk), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!),
    energyTypeP1: "water", energyTypeP2: "fire",
  });
  state.turnPlayer = "P1";
  state.turnNumber = 4;
  state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(volk);
  state.players.P1.active.attached = ["fire", "water"];
  state.players.P1.bench = [toInPlay(volkEx), toInPlay(CARD_POOL.merab!)];
  state.players.P1.pendingEnergy = "water";
  state.players.P1.hasRetreated = false;
  state.players.P1.hasAttachedEnergy = false;
  state.players.P2.active = toInPlay(CARD_POOL["tai-tuivasa"]!);
  return state;
}

describe("Volkanovski's switching and zone energy", () => {
  it("requires choosing your own bench target when the bench is occupied", () => {
    const state = battle();
    for (const fighter of state.players.P1.bench) {
      expect(getLegalMoves(state)).toContainEqual({ type: "attack", attackId: "crafty-kickboxing", targetUid: fighter.uid });
    }
    expect(() => applyMove(state, { type: "attack", attackId: "crafty-kickboxing" })).toThrow("Illegal move");
    expect(() => applyMove(state, { type: "attack", attackId: "crafty-kickboxing", targetUid: state.players.P2.active!.uid })).toThrow("Illegal move");
  });

  it("deals damage, switches without retreat payment, clears outgoing statuses, and triggers the ex ability", () => {
    const state = battle();
    state.players.P1.hasRetreated = true;
    const outgoing = state.players.P1.active!;
    outgoing.burned = true;
    outgoing.damageReduction = 10;
    outgoing.retreatCostIncrease = 2;
    const incoming = state.players.P1.bench[0]!;
    const snapshot = structuredClone(state);
    const next = applyMove(state, { type: "attack", attackId: "crafty-kickboxing", targetUid: incoming.uid });
    expect(next.players.P2.active!.damage).toBe(40);
    expect(next.players.P1.active).toMatchObject({ uid: incoming.uid, attached: ["water"] });
    expect(next.players.P1.bench[0]).toMatchObject({ uid: outgoing.uid, attached: ["fire", "water"], burned: false, damageReduction: 0, retreatCostIncrease: 0 });
    expect(next.players.P1.pendingEnergy).toBeNull();
    expect(next.players.P1.discard).toEqual([]);
    expect(next.turnPlayer).toBe("P2");
    expect(next.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "switched", outUid: outgoing.uid, inUid: incoming.uid }),
      expect.objectContaining({ kind: "abilityUsed", uid: incoming.uid, name: "A Land Down Under" }),
      expect.objectContaining({ kind: "energyAttached", player: "P1", targetUid: incoming.uid, energy: "water" }),
    ]));
    expect(state).toEqual(snapshot);
  });

  it("still deals damage when your bench is empty", () => {
    const state = battle();
    state.players.P1.bench = [];
    const next = applyMove(state, { type: "attack", attackId: "crafty-kickboxing" });
    expect(next.players.P2.active!.damage).toBe(40);
    expect(next.players.P1.active!.uid).toBe(state.players.P1.active!.uid);
    expect(next.events.some(event => event.kind === "switched")).toBe(false);
  });

  it("switches before continuing through an opposing knockout and promotion", () => {
    const state = battle();
    state.players.P2.active!.damage = 100;
    state.players.P2.bench = [toInPlay(CARD_POOL.merab!)];
    const next = applyMove(state, { type: "attack", attackId: "crafty-kickboxing", targetUid: state.players.P1.bench[0]!.uid });
    expect(next.players.P1.active!.card.id).toBe(volkEx.id);
    expect(next.players.P1.points).toBe(1);
    expect(next.phase).toEqual({ kind: "awaitPromotion", player: "P2" });
  });

  it("attaches zone energy on a normal retreat and does not duplicate it", () => {
    const state = battle();
    const next = applyMove(state, { type: "retreat", benchIndex: 0 });
    expect(next.players.P1.active!.attached).toEqual(["water"]);
    expect(next.players.P1.bench.at(-1)!.attached).toEqual(["water"]);
    expect(next.players.P1.discard).toEqual([{ kind: "energy", energy: "fire" }]);
    expect(next.players.P1.pendingEnergy).toBeNull();
    expect(getLegalMoves(next).some(move => move.type === "attachEnergy")).toBe(false);
  });

  it("uses the promoted fighter owner's zone, even while the opponent is turnPlayer", () => {
    const state = battle();
    state.turnPlayer = "P2";
    state.phase = { kind: "awaitPromotion", player: "P1" };
    state.players.P1.active = null;
    state.players.P2.pendingEnergy = "fire";
    const next = applyMove(state, { type: "promote", benchIndex: 0 });
    expect(next.players.P1.active!.attached).toEqual(["water"]);
    expect(next.players.P1.pendingEnergy).toBeNull();
    expect(next.players.P2.pendingEnergy).toBe("fire");
  });

  it("does not create energy when the owner's zone is empty", () => {
    const state = battle();
    state.players.P1.pendingEnergy = null;
    const next = applyMove(state, { type: "retreat", benchIndex: 0 });
    expect(next.players.P1.active!.attached).toEqual([]);
    expect(next.events.slice(state.events.length).some(event => event.kind === "abilityUsed")).toBe(false);
  });

  it("lets the AI choose a legal switch into the healthier fighter", () => {
    const state = battle();
    state.players.P1.hand = [];
    state.players.P1.pendingEnergy = null;
    expect(chooseMove(state)).toEqual({ type: "attack", attackId: "crafty-kickboxing", targetUid: state.players.P1.bench[0]!.uid });
  });

  it("Great Overhand accepts any three energies and an ex knockout awards two points", () => {
    const state = battle();
    state.players.P1.active = toInPlay(volkEx);
    state.players.P1.active.attached = ["water", "fire", "grass"];
    state.players.P2.active = toInPlay(volkEx);
    state.players.P2.active.damage = 70;
    state.players.P2.bench = [toInPlay(volk)];
    const next = applyMove(state, { type: "attack", attackId: "great-overhand" });
    expect(next.players.P1.points).toBe(2);
    expect(next.players.P2.discard[0]).toEqual({ kind: "fighter", card: volkEx });
  });
});
