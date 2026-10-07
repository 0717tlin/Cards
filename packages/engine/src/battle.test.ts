import { describe, it, expect } from "vitest";
import { createBattle } from "./setup.js";
import { getLegalMoves, applyMove, actingPlayer } from "./moves.js";
import { chooseMove } from "./ai.js";
import { getWinner } from "./winner.js";
import { DECK_PLAYER, DECK_AI } from "./cards.js";
import type { BattleConfig, BattleState, Move } from "./types.js";

function newBattle(seed: number): BattleState {
  const config: BattleConfig = {
    seed,
    deckP1: DECK_PLAYER,
    deckP2: DECK_AI,
    energyTypeP1: "fire",
    energyTypeP2: "water",
  };
  return createBattle(config);
}

describe("createBattle", () => {
  it("is deterministic for the same seed", () => {
    const a = newBattle(7);
    const b = newBattle(7);
    // Compare everything except logs (which are identical too, but this is explicit).
    expect(a.turnPlayer).toEqual(b.turnPlayer);
    expect(a.players.P1.hand.map((c) => c.id)).toEqual(b.players.P1.hand.map((c) => c.id));
    expect(a.players.P2.hand.map((c) => c.id)).toEqual(b.players.P2.hand.map((c) => c.id));
    expect(a.players.P1.active?.card.id).toEqual(b.players.P1.active?.card.id);
  });

  it("places an active for both players", () => {
    const s = newBattle(1);
    expect(s.players.P1.active).not.toBeNull();
    expect(s.players.P2.active).not.toBeNull();
  });

  it("starting player gets no energy and no draw on turn 1", () => {
    const s = newBattle(3);
    const starter = s.players[s.turnPlayer];
    expect(s.turnNumber).toBe(1);
    expect(starter.pendingEnergy).toBeNull();
    // Opening hand is 5, one placed as active -> 4 remain, no extra draw on turn 1.
    expect(starter.hand.length).toBe(4);
  });
});

describe("energy", () => {
  it("second turn generates energy that can be attached once", () => {
    let s = newBattle(3);
    // Turn 1: starter passes.
    s = applyMove(s, { type: "pass" });
    // Turn 2: this player should have pending energy.
    const player = s.players[s.turnPlayer];
    expect(player.pendingEnergy).not.toBeNull();

    const attach = getLegalMoves(s).find((m) => m.type === "attachEnergy");
    expect(attach).toBeDefined();
    s = applyMove(s, attach!);

    // No second attach available this turn.
    expect(getLegalMoves(s).some((m) => m.type === "attachEnergy")).toBe(false);
  });
});

describe("legal move enforcement", () => {
  it("rejects an illegal move", () => {
    const s = newBattle(5);
    expect(() => applyMove(s, { type: "attack", attackId: "does-not-exist" })).toThrow();
  });

  it("pass is always legal while there is no winner", () => {
    const s = newBattle(5);
    expect(getLegalMoves(s).some((m) => m.type === "pass")).toBe(true);
  });
});

describe("full game vs AI terminates with a winner", () => {
  it("plays to completion within a bounded number of moves", () => {
    let s = newBattle(11);
    let guard = 0;
    while (!getWinner(s) && guard < 5000) {
      const move: Move = chooseMove(s);
      s = applyMove(s, move);
      guard++;
    }
    expect(getWinner(s)).not.toBeNull();
    // Winner reached the point threshold or opponent could not promote.
    const w = getWinner(s)!;
    expect(["P1", "P2"]).toContain(w);
    // After a winner exists, no moves are legal.
    expect(getLegalMoves(s)).toEqual([]);
  });

  it("chooseMove always returns a legal move across a game", () => {
    let s = newBattle(21);
    let guard = 0;
    while (!getWinner(s) && guard < 5000) {
      const legal = getLegalMoves(s);
      const move = chooseMove(s);
      expect(legal.some((m) => JSON.stringify(m) === JSON.stringify(move))).toBe(true);
      s = applyMove(s, move);
      guard++;
    }
    expect(guard).toBeLessThan(5000);
  });
});

describe("promotion", () => {
  it("acting player becomes the promoter during awaitPromotion", () => {
    // Drive a game until we observe an awaitPromotion phase, then assert only
    // promote moves are legal and the acting player is the one promoting.
    let s = newBattle(11);
    let guard = 0;
    let sawPromotion = false;
    while (!getWinner(s) && guard < 5000) {
      if (s.phase.kind === "awaitPromotion") {
        sawPromotion = true;
        expect(actingPlayer(s)).toBe(s.phase.player);
        expect(getLegalMoves(s).every((m) => m.type === "promote")).toBe(true);
      }
      s = applyMove(s, chooseMove(s));
      guard++;
    }
    // At least one KO-with-bench should occur in a full game with these decks.
    expect(sawPromotion).toBe(true);
  });
});
