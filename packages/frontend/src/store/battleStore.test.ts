import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattleStore, HUMAN, AI } from "./battleStore";
import { AI_THINK_MS, animationTime } from "../animation/timing";

const store = useBattleStore;

/** Find a seed whose coin flip makes `player` go first. */
function seedWhereFirst(player: "P1" | "P2"): number {
  for (let seed = 1; seed < 500; seed++) {
    store.getState().newGame({ seed });
    if (store.getState().state.turnPlayer === player) return seed;
  }
  throw new Error("no seed found");
}

/** Start a game and fast-forward until the human can act. */
function startAndSettle(seed: number) {
  store.getState().newGame({ seed });
  vi.runAllTimers();
  expect(store.getState().busy).toBe(false);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("paced battle store", () => {
  it("starts a clean match after a finished game", () => {
    startAndSettle(seedWhereFirst(HUMAN));
    const finished = structuredClone(store.getState().state);
    finished.winner = HUMAN;
    store.setState({ state: finished, busy: false, humanMoves: [] });
    const previousId = store.getState().gameId;
    store.getState().newGame({ seed: seedWhereFirst(HUMAN) });
    vi.runAllTimers();
    expect(store.getState().gameId).toBeGreaterThan(previousId);
    expect(store.getState().state.winner).toBeNull();
    expect(store.getState().state.players.P1.points).toBe(0);
    expect(store.getState().state.players.P2.points).toBe(0);
    expect(store.getState().state.turnNumber).toBe(1);
    expect(store.getState().humanMoves.length).toBeGreaterThan(0);
  });
  it("paces an AI-first opening one step at a time", () => {
    const seed = seedWhereFirst(AI);
    store.getState().newGame({ seed });
    const opening = store.getState().state;
    // Nothing applied yet: only the opening events, input locked.
    expect(store.getState().busy).toBe(true);
    expect(store.getState().aiActing).toBe(true);
    expect(opening.events.map((e) => e.kind)).toEqual(["battleStarted", "turnStarted"]);

    // Just before the first AI action is due, still nothing has happened.
    vi.advanceTimersByTime(animationTime(opening.events) + AI_THINK_MS - 1);
    expect(store.getState().state).toBe(opening);

    // Then exactly one AI move is applied, and the store stays busy.
    vi.advanceTimersByTime(1);
    const afterOne = store.getState().state;
    expect(afterOne).not.toBe(opening);
    expect(store.getState().busy).toBe(true);

    // Eventually control reaches the human.
    vi.runAllTimers();
    expect(store.getState().busy).toBe(false);
    expect(store.getState().state.turnPlayer).toBe(HUMAN);
    expect(store.getState().humanMoves.length).toBeGreaterThan(0);
  });

  it("ignores human moves while busy", () => {
    store.getState().newGame({ seed: seedWhereFirst(HUMAN) });
    const before = store.getState().state;
    expect(store.getState().busy).toBe(true); // opening banner still animating
    store.getState().dispatch({ type: "pass" });
    expect(store.getState().state).toBe(before);
  });

  it("applies the AI's turn one move per step after the human passes", () => {
    startAndSettle(seedWhereFirst(HUMAN));
    store.getState().dispatch({ type: "pass" });
    const afterPass = store.getState().state;
    expect(afterPass.turnPlayer).toBe(AI);
    expect(store.getState().aiActing).toBe(true);

    const passEvents = afterPass.events.slice(store.getState().batchStart);
    vi.advanceTimersByTime(animationTime(passEvents) + AI_THINK_MS - 1);
    expect(store.getState().state).toBe(afterPass);
    vi.advanceTimersByTime(1);
    expect(store.getState().state).not.toBe(afterPass);

    vi.runAllTimers();
    expect(store.getState().busy).toBe(false);
    expect(store.getState().state.turnPlayer).toBe(HUMAN);
  });

  it("cancels pending AI steps when a new game starts", () => {
    startAndSettle(seedWhereFirst(HUMAN));
    store.getState().dispatch({ type: "pass" }); // AI steps now scheduled

    const freshSeed = seedWhereFirst(HUMAN);
    store.getState().newGame({ seed: freshSeed });
    vi.runAllTimers();

    // The new game is untouched by the old game's timers: still the human's
    // opening turn with only the opening events.
    const s = store.getState().state;
    expect(s.turnPlayer).toBe(HUMAN);
    expect(s.events.map((e) => e.kind)).toEqual(["battleStarted", "turnStarted"]);
    expect(store.getState().busy).toBe(false);
  });
});
