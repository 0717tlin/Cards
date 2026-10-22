import { createHash, randomBytes, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { ALL_CARD_POOL, ENGINE_VERSION, actingPlayer, applyMove, createBattle, readSharedDeck, reserveFighterUids, type BattleState, type PlayerId, type RoomMessage, type SharedDeck, type GuestView } from "@card-game/engine";
import { roomView } from "./roomPrivacy.js";

const ROOM_CODE = /^[A-Z0-9]{6}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RULES = createHash("sha256").update(ENGINE_VERSION + JSON.stringify(ALL_CARD_POOL)).digest("hex");
const TTL = 24 * 60 * 60 * 1000;
const defaultFile = fileURLToPath(new URL("../data/rooms.json", import.meta.url));
interface Member { name: string; tokenHash: string; ready: boolean; deck: SharedDeck | null }
interface Receipt { id: string; signature: string }
export interface SavedRoom {
  code: string; updatedAt: number; revision: number;
  players: { P1: Member; P2: Member | null };
  battle: BattleState | null;
  receipts: Record<PlayerId, Receipt[]>;
}
interface Identity { code: string; seat: PlayerId }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const send = (socket: WebSocket, message: RoomMessage) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function signature(value: Record<string, unknown>) { return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))); }

/** One authoritative server process; snapshots are saved before any accepted move is acknowledged. */
export class RoomServer {
  readonly wss: WebSocketServer;
  private rooms = new Map<string, SavedRoom>();
  private identities = new Map<WebSocket, Identity>();
  private connections = new Map<string, WebSocket>();
  private heartbeat: ReturnType<typeof setInterval>;
  constructor(server: Server, private file = defaultFile) {
    if (existsSync(file)) {
      const saved: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (!record(saved) || saved.version !== 1 || !Array.isArray(saved.rooms)) throw new Error("Invalid room registry; existing file was preserved.");
      if (saved.rules === RULES) for (const value of saved.rooms) {
        if (!record(value) || typeof value.code !== "string" || !ROOM_CODE.test(value.code) || typeof value.updatedAt !== "number" || !record(value.players) || !record(value.players.P1) || !record(value.receipts)) throw new Error("Invalid saved room.");
        const room = value as unknown as SavedRoom;
        if (Date.now() - room.updatedAt > TTL) continue;
        this.rooms.set(room.code, room);
        if (room.battle) reserveFighterUids(room.battle);
      }
    }
    this.wss = new WebSocketServer({ server, path: "/api/multiplayer", maxPayload: 16 * 1024, perMessageDeflate: false });
    const alive = new WeakSet<WebSocket>();
    this.wss.on("connection", (socket, request) => {
      // Same-origin browser connections; command-line clients may omit Origin for tests and tools.
      const origin = request.headers.origin;
      const allowed = process.env.MULTIPLAYER_ORIGINS?.split(",").map(value => value.trim());
      if (origin) {
        let hostname = "";
        try { hostname = new URL(origin).host; } catch { socket.close(1008, "Invalid origin"); return; }
        if (allowed ? !allowed.includes(origin) : hostname !== request.headers.host) { socket.close(1008, "Origin not allowed"); return; }
      }
      alive.add(socket);
      socket.on("pong", () => alive.add(socket));
      let windowStart = Date.now(), count = 0;
      socket.on("message", (data, binary) => {
        if (Date.now() - windowStart > 1000) { windowStart = Date.now(); count = 0; }
        if (++count > 30 || binary) { socket.close(1008, "Too many requests"); return; }
        try { this.command(socket, JSON.parse(data.toString()) as unknown); }
        catch (error) { send(socket, { type: "error", message: error instanceof Error ? error.message : "Request failed." }); }
      });
      socket.on("error", () => { /* close handles ownership and presence */ });
      socket.on("close", () => this.disconnect(socket));
      const timeout = setTimeout(() => { if (!this.identities.has(socket)) socket.close(1008, "Join a room first"); }, 15_000);
      timeout.unref(); socket.once("close", () => clearTimeout(timeout));
    });
    this.heartbeat = setInterval(() => {
      for (const socket of this.wss.clients) {
        if (!alive.has(socket)) socket.terminate();
        else { alive.delete(socket); socket.ping(); }
      }
      for (const room of this.rooms.values()) if (Date.now() - room.updatedAt > TTL && !this.connected(room.code, "P1") && !this.connected(room.code, "P2")) this.rooms.delete(room.code);
    }, 15_000);
    this.heartbeat.unref();
  }

  close() { clearInterval(this.heartbeat); for (const client of this.wss.clients) client.terminate(); this.wss.close(); }
  private connected(code: string, seat: PlayerId) { return this.connections.get(`${code}:${seat}`)?.readyState === WebSocket.OPEN; }
  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, rules: RULES, rooms: [...this.rooms.values()] }), { mode: 0o600 });
    renameSync(temporary, this.file);
  }
  private commit(room: SavedRoom) {
    const previous = this.rooms.get(room.code);
    this.rooms.set(room.code, room);
    try { this.save(); } catch (error) {
      if (previous) this.rooms.set(room.code, previous); else this.rooms.delete(room.code);
      console.error("Room persistence failed", error);
      throw new Error("Couldn't save the room. Please try again.");
    }
  }
  private snapshot(room: SavedRoom, seat: PlayerId) {
    const guest = (id: PlayerId): GuestView | null => {
      const member = room.players[id];
      return member ? { name: member.name, ready: member.ready, connected: this.connected(room.code, id) } : null;
    };
    const view = roomView(room.code, seat, room.revision, { P1: guest("P1"), P2: guest("P2") }, room.battle);
    if (!this.connected(room.code, "P1") || !this.connected(room.code, "P2")) view.legalMoves = [];
    return view;
  }
  private publish(room: SavedRoom, ack?: { seat: PlayerId; id: string }) {
    for (const seat of ["P1", "P2"] as const) {
      const socket = this.connections.get(`${room.code}:${seat}`);
      if (socket) send(socket, { type: "room", room: this.snapshot(room, seat), ack: ack?.seat === seat ? ack.id : undefined });
    }
  }
  private authenticate(socket: WebSocket, room: SavedRoom, seat: PlayerId, token?: string) {
    const previous = this.connections.get(`${room.code}:${seat}`);
    this.identities.set(socket, { code: room.code, seat }); this.connections.set(`${room.code}:${seat}`, socket);
    if (previous && previous !== socket) { this.identities.delete(previous); send(previous, { type: "error", message: "This seat was opened in another tab.", fatal: true }); previous.close(4001, "Seat reconnected"); }
    if (token) send(socket, { type: "session", session: { code: room.code, token } });
  }
  private disconnect(socket: WebSocket) {
    const identity = this.identities.get(socket);
    this.identities.delete(socket);
    if (!identity || this.connections.get(`${identity.code}:${identity.seat}`) !== socket) return;
    this.connections.delete(`${identity.code}:${identity.seat}`);
    const room = this.rooms.get(identity.code);
    if (room) this.publish(room);
  }
  private startIfReady(room: SavedRoom): boolean {
    const one = room.players.P1, two = room.players.P2;
    if (room.battle || !one.ready || !two?.ready || !one.deck || !two.deck || !this.connected(room.code, "P1") || !this.connected(room.code, "P2")) return false;
    const cards = (deck: SharedDeck) => Object.entries(deck.selection).flatMap(([id, count]) => Array.from({ length: count }, () => ALL_CARD_POOL[id]!));
    room.battle = createBattle({ seed: randomInt(0x7fffffff), deckP1: cards(one.deck), deckP2: cards(two.deck), energyTypeP1: one.deck.energyTypes[0]!, energyTypeP2: two.deck.energyTypes[0]!, energyTypesP1: one.deck.energyTypes, energyTypesP2: two.deck.energyTypes });
    return true;
  }
  private command(socket: WebSocket, input: unknown) {
    if (!record(input) || typeof input.type !== "string") throw new Error("Invalid room command.");
    if (input.type === "ping") { send(socket, { type: "pong" }); return; }
    if (["create", "join", "resume"].includes(input.type)) {
      if (this.identities.has(socket)) throw new Error("Leave your current room first.");
      if (input.type === "resume") {
        const room = typeof input.code === "string" ? this.rooms.get(input.code) : undefined;
        if (!room || Date.now() - room.updatedAt > TTL || typeof input.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token)) { send(socket, { type: "error", message: "This room has expired or the reconnect token is invalid.", fatal: true }); return; }
        const seat = (["P1", "P2"] as const).find(id => room.players[id]?.tokenHash === hash(input.token as string));
        if (!seat) { send(socket, { type: "error", message: "Invalid reconnect token.", fatal: true }); return; }
        this.authenticate(socket, room, seat);
        const next = structuredClone(room);
        if (this.startIfReady(next)) { next.revision++; next.updatedAt = Date.now(); this.commit(next); }
        const current = this.rooms.get(room.code)!;
        send(socket, { type: "room", room: this.snapshot(current, seat), resumed: true });
        this.publish(current); return;
      }
      if (typeof input.name !== "string") throw new Error("Enter a guest name.");
      const name = input.name.trim().replace(/\s+/g, " ");
      if (!name || name.length > 24 || /[\x00-\x1f\x7f]/.test(name)) throw new Error("Use a guest name of 1–24 characters.");
      const token = randomBytes(32).toString("hex");
      const member: Member = { name, tokenHash: hash(token), ready: false, deck: null };
      let room: SavedRoom; let seat: PlayerId;
      if (input.type === "create") {
        if (this.rooms.size >= 1000) throw new Error("The server is full. Please try again later.");
        let code: string;
        do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""); } while (this.rooms.has(code));
        room = { code, updatedAt: Date.now(), revision: 0, players: { P1: member, P2: null }, battle: null, receipts: { P1: [], P2: [] } }; seat = "P1";
      } else {
        const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
        const existing = ROOM_CODE.test(code) ? this.rooms.get(code) : undefined;
        if (!existing) throw new Error("Room not found. Check the six-character code.");
        if (existing.battle || existing.players.P2) throw new Error("This room is full. To reconnect, use the original browser session.");
        room = structuredClone(existing); room.players.P2 = member; room.revision++; seat = "P2";
      }
      this.commit(room); this.authenticate(socket, room, seat, token); this.publish(room); return;
    }
    const identity = this.identities.get(socket);
    const existing = identity ? this.rooms.get(identity.code) : undefined;
    if (!identity || !existing) throw new Error("Join a room first.");
    const { seat } = identity;
    if (input.type === "leave") {
      if (existing.battle && !existing.battle.winner) {
        const next = structuredClone(existing);
        const winner = seat === "P1" ? "P2" : "P1";
        next.battle!.winner = winner; next.battle!.events.push({ kind: "gameWon", player: winner, reason: "concession" });
        next.revision++; next.updatedAt = Date.now(); this.commit(next); this.publish(next);
      } else if (!existing.battle) {
        if (seat === "P1") {
          this.rooms.delete(existing.code);
          try { this.save(); } catch { this.rooms.set(existing.code, existing); throw new Error("Couldn't close the room. Please try again."); }
          const other = this.connections.get(`${existing.code}:P2`);
          if (other) { send(other, { type: "error", message: "The host closed this room.", fatal: true }); this.identities.delete(other); this.connections.delete(`${existing.code}:P2`); other.close(4001, "Room closed"); }
        } else {
          const next = structuredClone(existing); next.players.P2 = null; next.players.P1.ready = false; next.revision++; this.commit(next);
        }
      }
      this.disconnect(socket); send(socket, { type: "left" }); return;
    }
    if (input.type === "ready") {
      if (existing.battle) throw new Error("The match has already started.");
      if (typeof input.ready !== "boolean") throw new Error("Invalid ready command.");
      const deck = input.ready ? readSharedDeck(input.deck) : null;
      if (input.ready && !deck) throw new Error("Choose a legal 20-card deck with at most two copies per card and an energy type.");
      const next = structuredClone(existing); next.players[seat]!.ready = input.ready; next.players[seat]!.deck = deck;
      next.revision++; next.updatedAt = Date.now(); this.startIfReady(next); this.commit(next); this.publish(next); return;
    }
    if (input.type === "move") {
      if (typeof input.id !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(input.id) || !Number.isSafeInteger(input.revision) || !record(input.move)) throw new Error("Invalid move request.");
      const requestSignature = `${input.revision}:${signature(input.move)}`;
      const receipt = existing.receipts[seat].find(receipt => receipt.id === input.id);
      if (receipt) {
        if (receipt.signature !== requestSignature) throw new Error("A request ID cannot be reused for a different move.");
        send(socket, { type: "room", room: this.snapshot(existing, seat), ack: input.id }); return;
      }
      const fail = (message: string) => { send(socket, { type: "error", message, requestId: input.id as string }); send(socket, { type: "room", room: this.snapshot(existing, seat) }); };
      if (!existing.battle || existing.battle.winner) { fail("There is no active match."); return; }
      if (!this.connected(existing.code, "P1") || !this.connected(existing.code, "P2")) { fail("Waiting for the other player to reconnect."); return; }
      if (input.revision !== existing.revision) { fail("The board changed. Your view has been refreshed; choose your move again."); return; }
      if (actingPlayer(existing.battle) !== seat) { fail("Wait for your turn."); return; }
      const legal = this.snapshot(existing, seat).legalMoves.find(move => signature(move as unknown as Record<string, unknown>) === signature(input.move as Record<string, unknown>));
      if (!legal) { fail("That move is not legal."); return; }
      const next = structuredClone(existing); next.battle = applyMove(existing.battle, legal); next.revision++; next.updatedAt = Date.now();
      next.receipts[seat].push({ id: input.id, signature: requestSignature });
      // Keep receipts for every accepted move so delayed retransmissions can never be applied twice.
      this.commit(next); this.publish(next, { seat, id: input.id }); return;
    }
    throw new Error("Unknown room command.");
  }
}
