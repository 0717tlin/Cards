import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, createBattle, getLegalMoves, TRAINER_POOL } from "./index.js";
import { toInPlay } from "./setup.js";

function battle() {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL.merab!), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "colorless", energyTypeP2: "colorless" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  state.players.P1.hand = [TRAINER_POOL["ali-abdelaziz"]!, TRAINER_POOL["herb-dean"]!];
  state.players.P1.pendingEnergy = null;
  state.players.P2.active = toInPlay(CARD_POOL["tai-tuivasa"]!);
  state.players.P2.bench = [toInPlay(CARD_POOL.merab!), toInPlay(CARD_POOL["alexander-volkanovski-ex"]!)];
  state.players.P2.bench[0]!.damage = 10;
  return state;
}

describe("Ali Abdelaziz", () => {
  it("allows choosing only damaged opponent bench fighters", () => {
    const state = battle();
    const valid = { type: "playTrainer" as const, handIndex: 0, targetUid: state.players.P2.bench[0]!.uid };
    expect(getLegalMoves(state).filter(move => move.type === "playTrainer" && move.handIndex === 0)).toEqual([valid]);
    for (const targetUid of [undefined, state.players.P2.active!.uid, state.players.P2.bench[1]!.uid, state.players.P1.active!.uid]) {
      expect(() => applyMove(state, { ...valid, targetUid })).toThrow();
    }
    state.players.P2.bench[0]!.damage = 0;
    expect(getLegalMoves(state)).not.toContainEqual(valid);
  });

  it("switches without paying energy or ending the turn, and clears outgoing statuses", () => {
    const state = battle();
    Object.assign(state.players.P2.active!, { attached: ["colorless"], damage: 20, paralyzed: true, burned: true, bleeding: true, damageReduction: 10, retreatCostIncrease: 1, damageVulnerability: { amount: 20, expiresAfterTurn: 6 } });
    const before = structuredClone(state);
    const incoming = state.players.P2.bench[0]!;
    const outgoing = state.players.P2.active!;
    const next = applyMove(state, { type: "playTrainer", handIndex: 0, targetUid: incoming.uid });
    expect(next.players.P2.active).toEqual(incoming);
    expect(next.players.P2.bench[0]).toMatchObject({ uid: outgoing.uid, attached: ["colorless"], damage: 20, paralyzed: false, burned: false, bleeding: false, damageReduction: 0, retreatCostIncrease: 0 });
    expect(next.players.P2.bench[0]!.damageVulnerability).toBeUndefined();
    expect(next.players.P1.hasPlayedSupporter).toBe(true);
    expect(next.players.P2.hasRetreated).toBe(false);
    expect(next.players.P1.discard.at(-1)).toEqual({ kind: "trainer", card: TRAINER_POOL["ali-abdelaziz"] });
    expect(next.turnPlayer).toBe("P1"); expect(next.turnNumber).toBe(4);
    expect(next.events.at(-1)).toEqual({ kind: "switched", player: "P2", outUid: outgoing.uid, inUid: incoming.uid });
    expect(getLegalMoves(next).some(move => move.type === "playTrainer")).toBe(false);
    expect(state).toEqual(before);
  });

  it("triggers the incoming opponent's ability using their energy zone", () => {
    const state = battle(); const target = state.players.P2.bench[1]!;
    target.damage = 10; state.players.P2.pendingEnergy = "water";
    const next = applyMove(state, { type: "playTrainer", handIndex: 0, targetUid: target.uid });
    expect(next.players.P2.active!.attached).toEqual(["water"]);
    expect(next.players.P2.pendingEnergy).toBeNull();
  });

  it("lets the AI pull a damaged target for a winning attack", () => {
    const state = battle(); state.players.P1.points = 2; state.players.P1.active!.attached = ["colorless"];
    const target = state.players.P2.bench[0]!; target.damage = 60;
    const move = chooseMove(state);
    expect(move).toEqual({ type: "playTrainer", handIndex: 0, targetUid: target.uid });
    const next = applyMove(state, move);
    expect(applyMove(next, chooseMove(next)).winner).toBe("P1");
  });
});
