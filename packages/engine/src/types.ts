// Domain types for the battle engine. See .kiro/specs/battle-system/design.md.

export type PlayerId = "P1" | "P2";

export type EnergyType =
  | "fire"
  | "water"
  | "grass"
  | "lightning"
  | "psychic"
  | "fighting"
  | "colorless";

export type Stage = "basic" | "stage1" | "stage2";

export interface AttackDef {
  id: string;
  name: string;
  /** Multiset of required energy. "colorless" is satisfied by any energy type. */
  cost: EnergyType[];
  damage: number;
  /** Optional rules text. Display only this milestone (effects not resolved). */
  text?: string;
}

export interface AbilityDef {
  name: string;
  /** Display only this milestone; no effect resolution. */
  text: string;
}

export interface CreatureCard {
  /** Definition id, e.g. "emberpup". Not unique per battle instance. */
  id: string;
  name: string;
  type: EnergyType;
  hp: number;
  attacks: AttackDef[];
  /** Number of energy that must be discarded to retreat. */
  retreatCost: number;
  weakness: EnergyType | null;
  /** KO awards 2 points instead of 1 when true. */
  isEx: boolean;
  stage: Stage;
  /** Optional ability. Carried as data; not resolved during battle this milestone. */
  ability?: AbilityDef;
  /** Card id this evolves from. Carried for future evolution; unused in battle now. */
  evolvesFrom?: string;
  /** Art key resolved by the frontend. Optional; placeholder used when absent. */
  art?: string;
}

export interface CreatureInPlay {
  /** Unique per instance within a single battle. */
  uid: string;
  card: CreatureCard;
  /** Accumulated damage; KO when damage >= card.hp. */
  damage: number;
  attached: EnergyType[];
}

/** An entry in a player's discard pile: a knocked-out creature or spent energy. */
export type DiscardEntry =
  | { kind: "creature"; card: CreatureCard }
  | { kind: "energy"; energy: EnergyType };

export interface PlayerState {
  id: PlayerId;
  /** Remaining library; index 0 is the top of the deck. */
  deck: CreatureCard[];
  hand: CreatureCard[];
  active: CreatureInPlay | null;
  /** Max length 3. */
  bench: CreatureInPlay[];
  /** This deck's energy zone output type. */
  energyType: EnergyType;
  /** Energy generated this turn, not yet attached. */
  pendingEnergy: EnergyType | null;
  /** Knocked-out creatures and spent energy. */
  discard: DiscardEntry[];
  points: number;
  // Transient per-turn flags, reset at beginTurn.
  hasAttachedEnergy: boolean;
  hasRetreated: boolean;
}

export type Phase =
  | { kind: "main" }
  | { kind: "awaitPromotion"; player: PlayerId };

/**
 * Structured, machine-readable record of something visible that happened.
 * Appended to BattleState.events (append-only, like `log`) so the UI can
 * animate exactly what occurred. `player` is the player the event concerns:
 * the actor, or the owner of the affected creature.
 */
export type BattleEvent =
  | { kind: "battleStarted"; firstPlayer: PlayerId }
  | { kind: "turnStarted"; player: PlayerId; turnNumber: number }
  | { kind: "energyGenerated"; player: PlayerId; energy: EnergyType }
  | { kind: "cardDrawn"; player: PlayerId }
  | { kind: "energyAttached"; player: PlayerId; targetUid: string; energy: EnergyType }
  | { kind: "creatureBenched"; player: PlayerId; uid: string }
  | { kind: "retreated"; player: PlayerId; outUid: string; inUid: string; paid: EnergyType[] }
  | { kind: "promoted"; player: PlayerId; uid: string }
  | { kind: "attackUsed"; player: PlayerId; attackerUid: string; attackId: string; targetUid: string }
  | { kind: "damageDealt"; player: PlayerId; uid: string; amount: number; weakness: boolean }
  | { kind: "knockedOut"; player: PlayerId; creature: CreatureInPlay; pointsAwarded: number }
  | { kind: "energyDiscarded"; player: PlayerId; energy: EnergyType }
  | { kind: "gameWon"; player: PlayerId; reason: "points" | "noCreatures" };

export interface BattleState {
  players: Record<PlayerId, PlayerState>;
  turnPlayer: PlayerId;
  /** 1-based; increments at each turn start. */
  turnNumber: number;
  phase: Phase;
  /** Seeded RNG state, advanced as randomness is consumed. */
  rngState: number;
  winner: PlayerId | null;
  log: string[];
  /** Structured event history (append-only). */
  events: BattleEvent[];
}

export type Move =
  | { type: "attachEnergy"; targetUid: string }
  | { type: "playBasic"; handIndex: number }
  | { type: "retreat"; benchIndex: number }
  | { type: "attack"; attackId: string }
  | { type: "pass" }
  | { type: "promote"; benchIndex: number };

export interface BattleConfig {
  seed: number;
  deckP1: CreatureCard[];
  deckP2: CreatureCard[];
  energyTypeP1: EnergyType;
  energyTypeP2: EnergyType;
}

export const MAX_BENCH = 3;
export const HAND_SIZE = 5;
export const POINTS_TO_WIN = 3;
export const WEAKNESS_BONUS = 20;

export function opponentOf(p: PlayerId): PlayerId {
  return p === "P1" ? "P2" : "P1";
}
