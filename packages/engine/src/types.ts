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

export type AttackEffect = {
  kind: "damagePerAttachedEnergy";
  energy: EnergyType;
  amount: number;
} | { kind: "flipUntilTails"; amount: number };

export interface AttackDef {
  id: string;
  name: string;
  /** Multiset of required energy. "colorless" is satisfied by any energy type. */
  cost: EnergyType[];
  damage: number;
  /** Structured effects resolved by the engine, never inferred from rules text. */
  effects?: AttackEffect[];
  /** Player-facing description of the attack. */
  text?: string;
}

export interface AbilityDef {
  name: string;
  /** Display only this milestone; no effect resolution. */
  text: string;
}

export interface CreatureCard {
  kind?: "mon";
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

export type TrainerEffect =
  | { kind: "heal"; amount: number; target: "anyOwn" | "active" }
  | { kind: "draw"; count: number }
  | { kind: "reduceRetreat"; amount: number };

export interface TrainerCard {
  id: string;
  name: string;
  kind: "item" | "supporter";
  text: string;
  effect: TrainerEffect;
  art?: string;
}

export type CardDefinition = CreatureCard | TrainerCard;
export function isCreatureCard(card: CardDefinition): card is CreatureCard {
  return card.kind !== "item" && card.kind !== "supporter";
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
  | { kind: "trainer"; card: TrainerCard }
  | { kind: "energy"; energy: EnergyType };

export interface PlayerState {
  id: PlayerId;
  /** Remaining library; index 0 is the top of the deck. */
  deck: CardDefinition[];
  hand: CardDefinition[];
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
  hasPlayedSupporter: boolean;
  retreatReduction: number;
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
  | { kind: "trainerPlayed"; player: PlayerId; card: TrainerCard }
  | { kind: "healed"; player: PlayerId; uid: string; amount: number }
  | { kind: "retreatCostReduced"; player: PlayerId; amount: number }
  | { kind: "battleStarted"; firstPlayer: PlayerId }
  | { kind: "turnStarted"; player: PlayerId; turnNumber: number }
  | { kind: "energyGenerated"; player: PlayerId; energy: EnergyType }
  | { kind: "cardDrawn"; player: PlayerId }
  | { kind: "energyAttached"; player: PlayerId; targetUid: string; energy: EnergyType }
  | { kind: "creatureBenched"; player: PlayerId; uid: string }
  | { kind: "retreated"; player: PlayerId; outUid: string; inUid: string; paid: EnergyType[] }
  | { kind: "promoted"; player: PlayerId; uid: string }
  | { kind: "attackUsed"; player: PlayerId; attackerUid: string; attackId: string; targetUid: string }
  | { kind: "coinFlipped"; player: PlayerId; result: "heads" | "tails"; flip: number; bonus: number }
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
  | { type: "playTrainer"; handIndex: number; targetUid?: string }
  | { type: "attachEnergy"; targetUid: string }
  | { type: "playBasic"; handIndex: number }
  | { type: "retreat"; benchIndex: number }
  | { type: "attack"; attackId: string }
  | { type: "pass" }
  | { type: "promote"; benchIndex: number };

export interface BattleConfig {
  seed: number;
  deckP1: CardDefinition[];
  deckP2: CardDefinition[];
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
