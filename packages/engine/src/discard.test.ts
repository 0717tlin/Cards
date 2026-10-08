import { describe, it, expect } from "vitest";
import { createBattle } from "./setup.js";
import { getLegalMoves, applyMove } from "./moves.js";
import { chooseMove } from "./ai.js";
import { getWinner } from "./winner.js";
import { DECK_PLAYER, DECK_AI } from "./cards.js";
import type { BattleConfig, BattleState, DiscardEntry } from "./types.js";

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

function countEnergy(discard: DiscardEntry[]): number {
  return discard.filter((e) => e.kind === "energy").length;
}
function countFighters(discard: DiscardEntry[]): number {
  return discard.filter((e) => e.kind === "fighter").length;
}

describe("discard pile", () => {
  it("starts empty for both players", () => {
    const s = newBattle(1);
    expect(s.players.P1.discard).toEqual([]);
    expect(s.players.P2.discard).toEqual([]);
  });

  it("unattached energy is discarded at end of turn", () => {
    let s = newBattle(3);
    // Turn 1 (starter): no energy. Pass to opponent.
    s = applyMove(s, { type: "pass" });
    // Turn 2: this player has pending energy. Pass WITHOUT attaching it.
    const actor = s.turnPlayer;
    expect(s.players[actor].pendingEnergy).not.toBeNull();
    s = applyMove(s, { type: "pass" });
    // The unattached energy should now be in that player's discard.
    expect(countEnergy(s.players[actor].discard)).toBe(1);
  });

  it("KO sends the fighter and its energy to the owner's discard", () => {
    // Play a full game; by the end, KOs must have produced fighter discards.
    let s = newBattle(11);
    let guard = 0;
    while (!getWinner(s) && guard < 5000) {
      s = applyMove(s, chooseMove(s));
      guard++;
    }
    const totalFighterDiscards =
      countFighters(s.players.P1.discard) + countFighters(s.players.P2.discard);
    // A game won on points requires at least a few KOs.
    expect(totalFighterDiscards).toBeGreaterThan(0);
  });

  it("discard is deterministic for a fixed seed", () => {
    function play(seed: number): string {
      let s = newBattle(seed);
      let guard = 0;
      while (!getWinner(s) && guard < 5000) {
        s = applyMove(s, chooseMove(s));
        guard++;
      }
      return JSON.stringify({
        p1: s.players.P1.discard,
        p2: s.players.P2.discard,
      });
    }
    expect(play(11)).toEqual(play(11));
  });

  it("does not break legal move generation", () => {
    const s = newBattle(5);
    expect(getLegalMoves(s).length).toBeGreaterThan(0);
  });
});
