import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattle, DECK_AI, DECK_PLAYER, type RoomMessage, type RoomView } from "@card-game/engine";

const KEY = "card-battle.online-session.v1";
const credential = { code: "ABC123", token: "a".repeat(64) };
let storage: Map<string, string>;
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(readonly url: URL) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data) as Record<string, unknown>); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  reply(message: RoomMessage) { this.onmessage?.({ data: JSON.stringify(message) }); }
}
function room(): RoomView {
  const { rngState: _hidden, ...battle } = createBattle({ seed: 1, deckP1: DECK_PLAYER, deckP2: DECK_AI, energyTypeP1: "fire", energyTypeP2: "water" });
  battle.turnPlayer = "P1";
  return { code: "ABC123", seat: "P1", revision: 1, status: "playing", players: { P1: { name: "Alice", connected: true, ready: true }, P2: { name: "Bob", connected: true, ready: true } }, battle, legalMoves: [{ type: "pass" }] };
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); FakeSocket.instances = []; storage = new Map();
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("window", { location: { href: "http://192.168.1.20:5173/", protocol: "http:" }, addEventListener: vi.fn() });
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("online session recovery", () => {
  it("keeps the reconnect token out of URLs and generates move IDs on HTTP LAN connections", async () => {
    const client = await import("./onlineSession");
    client.useOnlineSession.getState().createRoom("Alice");
    const socket = FakeSocket.instances[0]!; socket.open();
    expect(String(socket.url)).toBe("ws://192.168.1.20:5173/api/multiplayer");
    socket.reply({ type: "session", session: credential }); socket.reply({ type: "room", room: room(), resumed: true });
    const { useBattleStore } = await import("../store/battleStore");
    useBattleStore.getState().dispatch({ type: "pass" });
    const request = socket.sent.find(value => value.type === "move")!;
    expect(request.id).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.parse(storage.get(KEY)!).pending.id).toBe(request.id);
    expect(useBattleStore.getState().busy).toBe(true);
    socket.reply({ type: "room", room: { ...room(), revision: 2 }, ack: request.id as string });
    expect(JSON.parse(storage.get(KEY)!)).not.toHaveProperty("pending");
    const { useAppView } = await import("../navigation/useAppView");
    useAppView.getState().setView("online");
    socket.reply({ type: "room", room: { ...room(), revision: 2 } });
    expect(useAppView.getState().view).toBe("online");
  });

  it("restores a saved session and retransmits the exact unacknowledged move", async () => {
    const pending = { type: "move", id: "original-id", revision: 1, move: { type: "pass" } };
    storage.set(KEY, JSON.stringify({ ...credential, pending }));
    const client = await import("./onlineSession"); client.restoreOnlineSession();
    const socket = FakeSocket.instances[0]!; socket.open();
    expect(socket.sent[0]).toMatchObject({ type: "resume", ...credential });
    socket.reply({ type: "room", room: room(), resumed: true });
    expect(socket.sent.filter(value => value.type === "move")).toEqual([pending]);
    socket.reply({ type: "room", room: { ...room(), revision: 2 }, ack: pending.id });
    expect(JSON.parse(storage.get(KEY)!)).not.toHaveProperty("pending");
    expect(client.useOnlineSession.getState().status).toBe("connected");
  });

  it("automatically reconnects with the same credential after a lost connection", async () => {
    storage.set(KEY, JSON.stringify(credential));
    const client = await import("./onlineSession"); client.restoreOnlineSession();
    const first = FakeSocket.instances[0]!; first.open(); first.reply({ type: "room", room: room(), resumed: true }); first.close();
    expect(client.useOnlineSession.getState().status).toBe("reconnecting");
    vi.advanceTimersByTime(500);
    const second = FakeSocket.instances[1]!; second.open();
    expect(second.sent[0]).toMatchObject({ type: "resume", ...credential });
    second.reply({ type: "room", room: room(), resumed: true });
    expect(client.useOnlineSession.getState().status).toBe("connected");
  });

  it("clears an expired credential and stops retrying when recovery is rejected", async () => {
    storage.set(KEY, JSON.stringify(credential));
    const client = await import("./onlineSession"); client.restoreOnlineSession();
    const socket = FakeSocket.instances[0]!; socket.open(); socket.reply({ type: "error", message: "Room expired", fatal: true });
    expect(storage.has(KEY)).toBe(false);
    expect(client.useOnlineSession.getState().status).toBe("error");
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("retains credentials until leaving is acknowledged and retries a lost leave acknowledgment", async () => {
    storage.set(KEY, JSON.stringify(credential));
    const client = await import("./onlineSession"); client.restoreOnlineSession();
    const first = FakeSocket.instances[0]!; first.open(); first.reply({ type: "room", room: room(), resumed: true });
    client.useOnlineSession.getState().leave();
    expect(JSON.parse(storage.get(KEY)!).leaving).toBe(true);
    expect(first.sent.at(-1)).toEqual({ type: "leave" });
    first.close(); vi.advanceTimersByTime(500);
    const second = FakeSocket.instances[1]!; second.open(); second.reply({ type: "room", room: room(), resumed: true });
    expect(second.sent.at(-1)).toEqual({ type: "leave" });
    second.reply({ type: "left" });
    expect(storage.has(KEY)).toBe(false);
    expect(client.useOnlineSession.getState().room).toBeNull();
  });
});
