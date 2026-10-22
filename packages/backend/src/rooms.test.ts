import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DECK_PLAYER, type RoomMessage, type RoomView, type SharedDeck } from "@card-game/engine";
import { RoomServer } from "./rooms.js";

class Guest {
  messages: RoomMessage[] = [];
  constructor(readonly socket: WebSocket) { socket.on("message", data => this.messages.push(JSON.parse(data.toString()) as RoomMessage)); }
  send(value: unknown) { this.socket.send(JSON.stringify(value)); }
  async next<T extends RoomMessage["type"]>(type: T, predicate: (message: Extract<RoomMessage, { type: T }>) => boolean = () => true): Promise<Extract<RoomMessage, { type: T }>> {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex(message => message.type === type && predicate(message as Extract<RoomMessage, { type: T }>));
      if (index >= 0) return this.messages.splice(index, 1)[0] as Extract<RoomMessage, { type: T }>;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`Timed out waiting for ${type}: ${JSON.stringify(this.messages)}`);
  }
}
let directory: string, server: Server, rooms: RoomServer, base: string;
const clients: Guest[] = [];
const selection: Record<string, number> = {};
for (const card of DECK_PLAYER) selection[card.id] = (selection[card.id] ?? 0) + 1;
const deck: SharedDeck = { name: "Test deck", selection, energyTypes: ["fire"] };
async function start() {
  server = createServer(); rooms = new RoomServer(server, join(directory, "rooms.json"));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing address");
  base = `ws://127.0.0.1:${address.port}/api/multiplayer`;
}
async function connect() {
  const socket = new WebSocket(base); const guest = new Guest(socket); clients.push(guest);
  await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); }); return guest;
}
async function match() {
  const one = await connect(); one.send({ type: "create", name: "Alice" });
  const sessionOne = (await one.next("session")).session;
  const two = await connect(); two.send({ type: "join", name: "Bob", code: sessionOne.code.toLowerCase() });
  const sessionTwo = (await two.next("session")).session;
  one.send({ type: "ready", ready: true, deck }); two.send({ type: "ready", ready: true, deck });
  const first = (await one.next("room", message => !!message.room.battle)).room;
  const second = (await two.next("room", message => !!message.room.battle)).room;
  return { one, two, sessionOne, sessionTwo, first, second };
}
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "card-rooms-")); await start(); });
afterEach(async () => { for (const guest of clients.splice(0)) guest.socket.terminate(); rooms.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });

describe("private room WebSockets", () => {
  it("creates private codes, requires legal decks, and reserves occupied seats", async () => {
    const one = await connect(); one.send({ type: "create", name: "Alice" });
    const { session } = await one.next("session");
    expect(session.code).toMatch(/^[A-Z0-9]{6}$/); expect(session.token).toHaveLength(64);
    one.send({ type: "ready", ready: true, deck: { ...deck, selection: {} } });
    expect((await one.next("error")).message).toContain("legal");
    const two = await connect(); two.send({ type: "join", name: "Bob", code: session.code }); await two.next("session");
    const third = await connect(); third.send({ type: "join", name: "Eve", code: session.code });
    expect((await third.next("error")).message).toContain("full");
    third.send({ type: "resume", code: session.code, token: "0".repeat(64) });
    expect((await third.next("error")).fatal).toBe(true);
    const saved = await readFile(join(directory, "rooms.json"), "utf8");
    expect(saved).not.toContain(session.token);
  });

  it("runs moves on the server, rejects wrong turns and stale views, and deduplicates retries", async () => {
    const { one, two, first, second } = await match();
    const active = first.legalMoves.length ? one : two, waiting = active === one ? two : one;
    const current = active === one ? first : second;
    waiting.send({ type: "move", id: "wrong-turn", revision: current.revision, move: { type: "pass" } });
    expect((await waiting.next("error", message => message.requestId === "wrong-turn")).message).toContain("turn");
    const command = { type: "move", id: "first-pass", revision: current.revision, move: { type: "pass" } };
    active.send(command);
    const accepted = (await active.next("room", message => message.ack === "first-pass")).room;
    expect(accepted.revision).toBe(current.revision + 1);
    active.send(command);
    expect((await active.next("room", message => message.ack === "first-pass")).room.revision).toBe(accepted.revision);
    waiting.send({ type: "move", id: "stale", revision: current.revision, move: { type: "pass" } });
    expect((await waiting.next("error", message => message.requestId === "stale")).message).toContain("changed");
    waiting.send({ type: "move", id: "illegal", revision: accepted.revision, move: { type: "attack", attackId: "invented" } });
    expect((await waiting.next("error", message => message.requestId === "illegal")).message).toContain("not legal");
  });

  it("pauses on disconnect, reconnects the same seat, and never reveals the other hand", async () => {
    const { one, two, first, sessionTwo } = await match();
    two.socket.terminate();
    const paused = (await one.next("room", message => message.room.players.P2?.connected === false && !!message.room.battle)).room;
    expect(paused.legalMoves).toEqual([]);
    expect(paused.battle!.players.P2.hand.every(card => card.id === "hidden")).toBe(true);
    const restored = await connect(); restored.send({ type: "resume", ...sessionTwo });
    const back = (await restored.next("room", message => !!message.resumed)).room;
    expect(back.seat).toBe("P2"); expect(back.revision).toBe(first.revision);
    expect(back.battle!.players.P1.hand.every(card => card.id !== "hidden")).toBe(true);
    expect(back.battle!.players.P2.hand.every(card => card.id === "hidden")).toBe(true);
  });

  it("restores the battle and accepted-move receipts after restarting the server", async () => {
    const { one, two, first, second, sessionOne, sessionTwo } = await match();
    const active = first.legalMoves.length ? one : two;
    const session = active === one ? sessionOne : sessionTwo;
    const current = active === one ? first : second;
    const command = { type: "move", id: "restart-pass", revision: current.revision, move: { type: "pass" } };
    active.send(command); const expected = (await active.next("room", message => message.ack === "restart-pass")).room;
    rooms.close(); await new Promise<void>(resolve => server.close(() => resolve())); await start();
    const replacement = await connect(); replacement.send({ type: "resume", ...session });
    const restored = (await replacement.next("room", message => !!message.resumed)).room;
    expect(restored.revision).toBe(expected.revision); expect(restored.battle!.turnNumber).toBe(expected.battle!.turnNumber);
    replacement.send(command);
    expect((await replacement.next("room", message => message.ack === "restart-pass")).room.revision).toBe(expected.revision);
  });

  it("treats leaving an active match as a concession", async () => {
    const { one, two } = await match(); one.send({ type: "leave" });
    const result: RoomView = (await two.next("room", message => message.room.status === "finished")).room;
    expect(result.battle!.winner).toBe("P1");
  });
});
