import { describe, it, expect } from "vitest";
import { createBattle } from "./setup.js";
import { applyMove, getLegalMoves } from "./moves.js";
import { chooseMove } from "./ai.js";
import { getWinner } from "./winner.js";
import { DECK_PLAYER, DECK_AI } from "./cards.js";
import type { BattleEvent, BattleState, Move } from "./types.js";

function newBattle(seed: number): BattleState {
  return createBattle({
    seed,
    deckP1: DECK_PLAYER,
    deckP2: DECK_AI,
    energyTypeP1: "fire",
    energyTypeP2: "water",
  });
}

/** Apply a move and return only the events it produced. */
function step(state: BattleState, move: Move): { next: BattleState; events: BattleEvent[] } {
  const next = applyMove(state, move);
  return { next, events: next.events.slice(state.events.length) };
}

function kinds(events: BattleEvent[]): string[] {
  return events.map((e) => e.kind);
}

/** Play AI-vs-AI until `predicate(events-of-step)` matches, returning that step. */
function playUntil(
  seed: number,
  predicate: (events: BattleEvent[], before: BattleState) => boolean
): { before: BattleState; move: Move; events: BattleEvent[]; next: BattleState } | null {
  let s = newBattle(seed);
  for (let i = 0; i < 5000 && !getWinner(s); i++) {
    const move = chooseMove(s);
    const { next, events } = step(s, move);
    if (predicate(events, s)) return { before: s, move, events, next };
    s = next;
  }
  return null;
}

describe("battle events", () => {
  it("createBattle emits battleStarted then the first turnStarted", () => {
    const s = newBattle(3);
    expect(s.events[0]).toEqual({ kind: "battleStarted", firstPlayer: s.turnPlayer });
    expect(s.events[1]).toEqual({ kind: "turnStarted", player: s.turnPlayer, turnNumber: 1 });
    // Turn 1 exception: no energy / draw events.
    expect(kinds(s.events)).toEqual(["battleStarted", "turnStarted"]);
  });

  it("pass emits the next player's turnStarted, energyGenerated and cardDrawn", () => {
    const s = newBattle(3);
    const { next, events } = step(s, { type: "pass" });
    expect(kinds(events)).toEqual(["turnStarted", "energyGenerated", "cardDrawn"]);
    expect(events[0]).toMatchObject({ player: next.turnPlayer, turnNumber: 2 });
  });

  it("unattached energy emits energyDiscarded at end of turn", () => {
    let s = newBattle(3);
    s = applyMove(s, { type: "pass" }); // turn 2 now has energy
    const actor = s.turnPlayer;
    const { events } = step(s, { type: "pass" });
    expect(events[0]).toMatchObject({ kind: "energyDiscarded", player: actor });
  });

  it("attachEnergy emits energyAttached with target and energy", () => {
    let s = newBattle(3);
    s = applyMove(s, { type: "pass" });
    const attach = getLegalMoves(s).find((m) => m.type === "attachEnergy")!;
    const { events } = step(s, attach);
    expect(events).toEqual([
      {
        kind: "energyAttached",
        player: s.turnPlayer,
        targetUid: (attach as Extract<Move, { type: "attachEnergy" }>).targetUid,
        energy: s.players[s.turnPlayer].pendingEnergy,
      },
    ]);
  });

  it("playBasic emits fighterBenched with the new fighter's uid", () => {
    const s = newBattle(3);
    const play = getLegalMoves(s).find((m) => m.type === "playBasic")!;
    const { next, events } = step(s, play);
    const benched = next.players[s.turnPlayer].bench.at(-1)!;
    expect(events).toEqual([{ kind: "fighterBenched", player: s.turnPlayer, uid: benched.uid }]);
  });

  it("attack emits attackUsed then damageDealt with the right amount", () => {
    const found = playUntil(11, (ev) => ev.some((e) => e.kind === "attackUsed"));
    expect(found).not.toBeNull();
    const { before, events } = found!;
    const attackerId = before.turnPlayer;
    const defender = before.players[attackerId === "P1" ? "P2" : "P1"];
    const used = events[0]!;
    const dealt = events[1]!;
    expect(used).toMatchObject({ kind: "attackUsed", player: attackerId, targetUid: defender.active!.uid });
    expect(dealt).toMatchObject({ kind: "damageDealt", player: defender.id, uid: defender.active!.uid });
    expect((dealt as Extract<BattleEvent, { kind: "damageDealt" }>).amount).toBeGreaterThan(0);
  });

  it("knock-out emits knockedOut with a post-hit snapshot and points", () => {
    const found = playUntil(11, (ev) => ev.some((e) => e.kind === "knockedOut"));
    expect(found).not.toBeNull();
    const ko = found!.events.find((e) => e.kind === "knockedOut") as Extract<
      BattleEvent,
      { kind: "knockedOut" }
    >;
    expect(ko.fighter.damage).toBeGreaterThanOrEqual(ko.fighter.card.hp);
    expect(ko.pointsAwarded).toBe(ko.fighter.card.isEx ? 2 : 1);
    // The snapshot is of a fighter that is no longer active.
    expect(found!.next.players[ko.player].active?.uid).not.toBe(ko.fighter.uid);
  });

  it("promotion emits promoted", () => {
    const found = playUntil(11, (ev) => ev.some((e) => e.kind === "promoted"));
    expect(found).not.toBeNull();
    const promoted = found!.events.find((e) => e.kind === "promoted")!;
    expect(found!.next.players[(promoted as { player: "P1" | "P2" }).player].active?.uid).toBe(
      (promoted as { uid: string }).uid
    );
  });

  it("a finished game ends with gameWon for the winner", () => {
    let s = newBattle(11);
    for (let i = 0; i < 5000 && !getWinner(s); i++) s = applyMove(s, chooseMove(s));
    expect(s.events.at(-1)).toMatchObject({ kind: "gameWon", player: getWinner(s) });
  });

  it("events are deterministic for a fixed seed", () => {
    function play(seed: number) {
      let s = newBattle(seed);
      for (let i = 0; i < 5000 && !getWinner(s); i++) s = applyMove(s, chooseMove(s));
      // Instance uids come from a process-wide counter, so compare without them.
      return JSON.stringify(s.events).replace(/#\d+/g, "#");
    }
    expect(play(21)).toEqual(play(21));
  });
});
