import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, createBattle, getLegalMoves, TRAINER_POOL } from "./index.js";
import { toInPlay } from "./setup.js";
import { nextFloat } from "./rng.js";

function battle() {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL.merab!), deckP2: Array(20).fill(CARD_POOL.merab!), energyTypeP1: "water", energyTypeP2: "water" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  for (const player of Object.values(state.players)) {
    player.active = toInPlay({ ...CARD_POOL.merab!, hp: 300 });
    player.active.attached = ["water"]; player.bench = [toInPlay(CARD_POOL.merab!)]; player.hand = [];
  }
  return state;
}

describe("Sleep", () => {
  it("blocks attacks and retreat but permits attaching energy and playing cards", () => {
    const state = battle(); state.players.P1.active!.asleep = true;
    state.players.P1.pendingEnergy = "water"; state.players.P1.hand = [TRAINER_POOL["herb-dean"]!];
    const moves = getLegalMoves(state);
    expect(moves.some(move => move.type === "attack" || move.type === "retreat")).toBe(false);
    expect(moves).toContainEqual({ type: "attachEnergy", targetUid: state.players.P1.active!.uid });
    expect(moves).toContainEqual({ type: "playTrainer", handIndex: 0 });
    expect(() => applyMove(state, { type: "attack", attackId: "single-leg" })).toThrow("Illegal move");
    expect(() => applyMove(state, { type: "retreat", benchIndex: 0 })).toThrow("Illegal move");
  });

  it.each([0, 1, 2, 3])("checks both active fighters at each boundary without causing damage (%i)", seed => {
    const state = battle(); state.rngState = seed;
    state.players.P1.active!.asleep = true; state.players.P2.active!.asleep = true;
    const original = structuredClone(state);
    const first = nextFloat(seed), second = nextFloat(first.state);
    const next = applyMove(state, { type: "pass" });
    expect(next.players.P1.active!.asleep).toBe(first.value >= .5);
    expect(next.players.P2.active!.asleep).toBe(second.value >= .5);
    expect(next.players.P1.active!.damage).toBe(0); expect(next.players.P2.active!.damage).toBe(0);
    expect(next.rngState).toBe(second.state);
    expect(next.events.slice(state.events.length).filter(event => event.kind === "coinFlipped")).toHaveLength(2);
    expect(state).toEqual(original);
  });

  it("persists after tails across turns and restores moves immediately after heads", () => {
    const state = battle(); state.players.P2.active!.asleep = true;
    state.rngState = 1; // mulberry32: tails
    const first = applyMove(state, { type: "pass" });
    expect(first.players.P2.active!.asleep).toBe(true);
    expect(getLegalMoves(first).some(move => move.type === "attack")).toBe(false);
    first.rngState = 1;
    const second = applyMove(first, { type: "pass" });
    expect(second.players.P2.active!.asleep).toBe(true);
    second.rngState = 0; // heads
    const awake = applyMove(second, { type: "pass" });
    expect(awake.players.P2.active!.asleep).toBe(false);
    expect(getLegalMoves(awake)).toContainEqual({ type: "attack", attackId: "single-leg" });
    expect(getLegalMoves(awake)).toContainEqual({ type: "retreat", benchIndex: 0 });
  });

  it("clears sleep when an effect moves the fighter onto the bench", () => {
    const state = battle(); state.players.P2.active!.asleep = true;
    state.players.P2.bench[0]!.damage = 10;
    state.players.P1.hand = [TRAINER_POOL["ali-abdelaziz"]!];
    const next = applyMove(state, { type: "playTrainer", handIndex: 0, targetUid: state.players.P2.bench[0]!.uid });
    expect(next.players.P2.bench[0]!.asleep).toBe(false);
    expect(!!next.players.P2.active!.asleep).toBe(false);
  });

  it("does not let burn recovery skip the separate sleep recovery flip", () => {
    const state = battle(); state.rngState = 1;
    state.players.P2.active!.asleep = true; state.players.P2.active!.burned = true;
    const burn = nextFloat(1), sleep = nextFloat(burn.state);
    const next = applyMove(state, { type: "pass" });
    expect(next.players.P2.active!.damage).toBe(20);
    expect(next.players.P2.active!.burned).toBe(burn.value < .5);
    expect(next.players.P2.active!.asleep).toBe(sleep.value >= .5);
    expect(next.events.slice(state.events.length).filter(event => event.kind === "coinFlipped").map(event => event.kind === "coinFlipped" && event.reason)).toEqual(["burn", "sleep"]);
  });
});
