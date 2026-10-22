import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMove, createBattle, DECK_AI, DECK_PLAYER, getLegalMoves, type BattleState, type RoomView } from "@card-game/engine";
import { setOnlineSender, useBattleStore } from "./battleStore";

function state() {
  const battle = createBattle({ seed: 1, deckP1: DECK_PLAYER, deckP2: DECK_AI, energyTypeP1: "fire", energyTypeP2: "water" });
  battle.turnPlayer = "P1"; battle.turnNumber = 4;
  return battle;
}
function view(battle: BattleState, revision = 1): RoomView {
  const { rngState: _privateSeed, ...display } = battle;
  return { code: "ABC123", seat: "P1", revision, status: "playing", players: { P1: { name: "Alice", connected: true, ready: true }, P2: { name: "Bob", connected: true, ready: true } }, battle: display, legalMoves: battle.turnPlayer === "P1" ? getLegalMoves(battle) : [] };
}
beforeEach(() => { vi.useFakeTimers(); setOnlineSender(null); useBattleStore.getState().newGame({ seed: 12 }); useBattleStore.getState().onlineConnection(true); });
afterEach(() => { setOnlineSender(null); useBattleStore.getState().newGame({ seed: 12 }); vi.clearAllTimers(); vi.useRealTimers(); });

describe("server-driven battle store", () => {
  it("does not disable local AI play when the online backend is unavailable", () => {
    vi.runAllTimers();
    const before = useBattleStore.getState();
    useBattleStore.getState().onlineConnection(false, "Backend unavailable");
    expect(useBattleStore.getState().humanMoves).toEqual(before.humanMoves);
    expect(useBattleStore.getState().busy).toBe(before.busy);
    expect(useBattleStore.getState().mode).toBe("offline");
  });
  it("sends moves without applying them locally or running an AI", () => {
    const original = state(), room = view(original);
    const sender = vi.fn(); setOnlineSender(sender);
    useBattleStore.getState().receiveOnline(room, true);
    const shown = structuredClone(useBattleStore.getState().state);
    useBattleStore.getState().dispatch({ type: "pass" });
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith({ type: "pass" });
    expect(useBattleStore.getState().state).toEqual(shown);
    expect(useBattleStore.getState().busy).toBe(true);
    const server = applyMove(original, { type: "pass" });
    useBattleStore.getState().receiveOnline(view(server, 2)); vi.runAllTimers();
    expect(useBattleStore.getState().state.turnNumber).toBe(server.turnNumber);
    expect(useBattleStore.getState().state.events).toEqual(server.events);
    expect(useBattleStore.getState().humanMoves).toEqual([]);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("queues successive updates so an opponent's fast move cannot skip the current animation", () => {
    const first = state(); useBattleStore.getState().receiveOnline(view(first), true);
    const second = applyMove(first, { type: "pass" }), third = applyMove(second, { type: "pass" });
    useBattleStore.getState().receiveOnline(view(second, 2));
    useBattleStore.getState().receiveOnline(view(third, 3));
    expect(useBattleStore.getState().state.turnNumber).toBe(second.turnNumber);
    expect(useBattleStore.getState().busy).toBe(true);
    vi.runAllTimers();
    expect(useBattleStore.getState().state.turnNumber).toBe(third.turnNumber);
    expect(useBattleStore.getState().room!.revision).toBe(3);
    expect(useBattleStore.getState().humanMoves).toEqual(getLegalMoves(third));
  });

  it("pauses input on disconnect and restores without replaying animations", () => {
    const first = state(); useBattleStore.getState().receiveOnline(view(first), true);
    useBattleStore.getState().onlineConnection(false);
    expect(useBattleStore.getState().humanMoves).toEqual([]);
    const latest = applyMove(applyMove(first, { type: "pass" }), { type: "pass" });
    useBattleStore.getState().onlineConnection(true);
    useBattleStore.getState().receiveOnline(view(latest, 3), true);
    expect(useBattleStore.getState().busy).toBe(false);
    expect(useBattleStore.getState().batchStart).toBe(latest.events.length);
    expect(useBattleStore.getState().humanMoves).toEqual(getLegalMoves(latest));
    useBattleStore.getState().receiveOnline(view(first, 1));
    expect(useBattleStore.getState().room!.revision).toBe(3);
  });
});
