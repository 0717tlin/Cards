import type { BattleState, Move, PlayerId } from "./types.js";
import type { SharedDeck } from "./decks.js";

export interface GuestView { name: string; connected: boolean; ready: boolean }
export interface RoomView {
  code: string;
  seat: PlayerId;
  players: Record<PlayerId, GuestView | null>;
  revision: number;
  status: "waiting" | "playing" | "finished";
  /** Display-only state: viewer is P1, hidden cards are placeholders, RNG is omitted. */
  battle: Omit<BattleState, "rngState"> | null;
  legalMoves: Move[];
}
export interface RoomSession { code: string; token: string }
export interface OnlineMove { type: "move"; id: string; revision: number; move: Move }
export type RoomCommand =
  | { type: "create"; name: string }
  | { type: "join"; name: string; code: string }
  | ({ type: "resume" } & RoomSession)
  | { type: "ready"; ready: boolean; deck?: SharedDeck }
  | OnlineMove
  | { type: "leave" };
export type RoomMessage =
  | { type: "session"; session: RoomSession }
  | { type: "room"; room: RoomView; resumed?: boolean; ack?: string }
  | { type: "error"; message: string; fatal?: boolean; requestId?: string }
  | { type: "left" }
  | { type: "pong" };
