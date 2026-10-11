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
export type CardRarity = "common" | "uncommon" | "rare" | "epic";

export type AttackEffect = {
  kind: "damagePerAttachedEnergy";
  energy: EnergyType;
  amount: number;
} | { kind: "flipUntilTails"; amount: number }
  | { kind: "coinDamageBonus"; amount: number }
  | { kind: "coinAttackFailsOnTails" }
  | { kind: "reduceIncomingDamage"; amount: number }
  | { kind: "increaseRetreatCost"; amount: number }
  | { kind: "paralyzeAtOrBelowHp"; hp: number }
  | { kind: "burn" }
  | { kind: "coinBleed" }
  | { kind: "ignoreWeakness" }
  | { kind: "preventRetreat" }
  | { kind: "coinDamagePerHeads"; coins: number; amount: number }
  | { kind: "discardSelfEnergy"; amount: number; unlessBenchCardId?: string }
  | { kind: "discardAllSelfEnergy" }
  | { kind: "damageAnyFighter"; amount: number }
  | { kind: "increaseIncomingDamage"; amount: number }
  | { kind: "damagedOpponentBonus"; amount: number }
  | { kind: "benchDamageBonus"; cardId: string; amount: number }
  | { kind: "switchWithBench" }
  | { kind: "benchDamage"; amount: number; chooseWithCardId: string };

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
  text: string;
  effect?: { kind: "discardEnergyToHeal"; energy: EnergyType; amount: number }
    | { kind: "searchDeckToTop"; cardIds: string[] }
    | { kind: "attackTwice" }
    | { kind: "useNonExBenchAttacks" }
    | { kind: "reduceNamedAttackCost"; names: string[] }
    | { kind: "damageBonusWhenBehindOnPoints"; amount: number }
    | { kind: "peekOpponentDeck" }
    | { kind: "attachZoneEnergyOnBecomingActive" }
    | { kind: "burnBothActivesOnEnergyAttachment"; energy: EnergyType };
}

export interface FighterCard {
  kind?: "fighter";
  rarity?: CardRarity;
  /** Definition id, e.g. "ilia-topuria". Not unique per battle instance. */
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
  stageLabel?: "Prospect" | "Contender" | "Champion";
  /** Display as a Prospect even when its Identity card has not been added yet. */
  isProspect?: boolean;
  /** Optional activated or passive ability. */
  ability?: AbilityDef;
  /** Definition id of the fighter this card can evolve from. */
  evolvesFrom?: string;
  /** Art key resolved by the frontend. Optional; placeholder used when absent. */
  art?: string;
}

export type TrainerEffect =
  | { kind: "searchNamedFighterToTop"; names: string[] }
  | { kind: "switchDamagedOpponentBench" }
  | { kind: "boostActiveAttackDamage"; amount: number }
  | { kind: "searchRandomBasic" }
  | { kind: "heal"; amount: number; target: "anyOwn" | "active" }
  | { kind: "draw"; count: number }
  | { kind: "reduceRetreat"; amount: number };

export interface TrainerCard {
  rarity?: CardRarity;
  id: string;
  name: string;
  kind: "item" | "supporter";
  text: string;
  effect: TrainerEffect;
  art?: string;
}

export type CardDefinition = FighterCard | TrainerCard;
export function isFighterCard(card: CardDefinition): card is FighterCard {
  return card.kind !== "item" && card.kind !== "supporter";
}

export interface FighterInPlay {
  /** Unique per instance within a single battle. */
  uid: string;
  card: FighterCard;
  /** Accumulated damage; KO when damage >= card.hp. */
  damage: number;
  attached: EnergyType[];
  enteredTurn?: number;
  evolvedTurn?: number;
  damageReduction?: number;
  damageVulnerability?: { amount: number; expiresAfterTurn: number };
  paralyzed?: boolean;
  cannotRetreat?: boolean;
  burned?: boolean;
  bleeding?: boolean;
  retreatCostIncrease?: number;
  previousStages?: FighterCard[];
  abilityUsedTurn?: number;
}

/** An entry in a player's discard pile: a knocked-out fighter or spent energy. */
export type DiscardEntry =
  | { kind: "fighter"; card: FighterCard }
  | { kind: "trainer"; card: TrainerCard }
  | { kind: "energy"; energy: EnergyType };

export interface PlayerState {
  id: PlayerId;
  /** Remaining library; index 0 is the top of the deck. */
  deck: CardDefinition[];
  hand: CardDefinition[];
  active: FighterInPlay | null;
  /** Max length 3. */
  bench: FighterInPlay[];
  /** This deck's energy zone output type. */
  energyType: EnergyType;
  energyTypes?: EnergyType[];
  /** Energy generated this turn, not yet attached. */
  pendingEnergy: EnergyType | null;
  /** Knocked-out fighters and spent energy. */
  discard: DiscardEntry[];
  points: number;
  // Transient per-turn flags, reset at beginTurn.
  hasAttachedEnergy: boolean;
  hasRetreated: boolean;
  hasPlayedSupporter: boolean;
  retreatReduction: number;
  attackDamageBonus?: number;
  attacksUsedThisTurn?: number;
}

export type Phase =
  | { kind: "main" }
  | { kind: "awaitPromotion"; player: PlayerId };

/**
 * Structured, machine-readable record of something visible that happened.
 * Appended to BattleState.events (append-only, like `log`) so the UI can
 * animate exactly what occurred. `player` is the player the event concerns:
 * the actor, or the owner of the affected fighter.
 */
export type BattleEvent =
  | { kind: "abilityUsed"; player: PlayerId; uid: string; name: string }
  | { kind: "deckPeeked"; player: PlayerId; card: CardDefinition }
  | { kind: "trainerPlayed"; player: PlayerId; card: TrainerCard }
  | { kind: "healed"; player: PlayerId; uid: string; amount: number }
  | { kind: "retreatCostReduced"; player: PlayerId; amount: number }
  | { kind: "attackDamageBoosted"; player: PlayerId; amount: number }
  | { kind: "battleStarted"; firstPlayer: PlayerId }
  | { kind: "turnStarted"; player: PlayerId; turnNumber: number }
  | { kind: "energyGenerated"; player: PlayerId; energy: EnergyType }
  | { kind: "cardDrawn"; player: PlayerId }
  | { kind: "deckShuffled"; player: PlayerId }
  | { kind: "energyAttached"; player: PlayerId; targetUid: string; energy: EnergyType }
  | { kind: "fighterBenched"; player: PlayerId; uid: string }
  | { kind: "evolved"; player: PlayerId; uid: string; name: string }
  | { kind: "damageReductionApplied"; player: PlayerId; uid: string; amount: number }
  | { kind: "damageVulnerabilityApplied"; player: PlayerId; uid: string; amount: number }
  | { kind: "retreated"; player: PlayerId; outUid: string; inUid: string; paid: EnergyType[] }
  | { kind: "switched"; player: PlayerId; outUid: string; inUid: string }
  | { kind: "promoted"; player: PlayerId; uid: string }
  | { kind: "attackUsed"; player: PlayerId; attackerUid: string; attackId: string; targetUid: string }
  | { kind: "coinFlipped"; player: PlayerId; result: "heads" | "tails"; flip: number; bonus: number; attackName?: string; reason?: "burn" | "bleeding" }
  | { kind: "damageDealt"; player: PlayerId; uid: string; amount: number; weakness: boolean }
  | { kind: "knockedOut"; player: PlayerId; fighter: FighterInPlay; pointsAwarded: number; fromBench?: boolean }
  | { kind: "energyDiscarded"; player: PlayerId; energy: EnergyType }
  | { kind: "gameWon"; player: PlayerId; reason: "points" | "noFighters" };

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
  | { type: "useAbility"; targetUid: string; cardId?: string }
  | { type: "evolve"; handIndex: number; targetUid: string }
  | { type: "playTrainer"; handIndex: number; targetUid?: string; cardId?: string }
  | { type: "attachEnergy"; targetUid: string }
  | { type: "playBasic"; handIndex: number }
  | { type: "retreat"; benchIndex: number }
  | { type: "attack"; attackId: string; targetUid?: string }
  | { type: "pass" }
  | { type: "promote"; benchIndex: number };

export interface BattleConfig {
  seed: number;
  deckP1: CardDefinition[];
  deckP2: CardDefinition[];
  energyTypeP1: EnergyType;
  energyTypeP2: EnergyType;
  energyTypesP1?: EnergyType[];
  energyTypesP2?: EnergyType[];
}

export const MAX_BENCH = 3;
export const HAND_SIZE = 5;
export const POINTS_TO_WIN = 3;
export const WEAKNESS_BONUS = 20;

export function opponentOf(p: PlayerId): PlayerId {
  return p === "P1" ? "P2" : "P1";
}
