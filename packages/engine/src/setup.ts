// Battle setup: createBattle builds a deterministic initial state.

import type {
  BattleConfig,
  BattleState,
  CreatureCard,
  CreatureInPlay,
  PlayerId,
  PlayerState,
} from "./types.js";
import { HAND_SIZE } from "./types.js";
import { nextInt, shuffle } from "./rng.js";
import { beginTurn } from "./turn.js";

let uidCounter = 0;
/** Instance uid. Deterministic within a process run; unique per creature instance. */
export function makeUid(cardId: string): string {
  uidCounter += 1;
  return `${cardId}#${uidCounter}`;
}

export function toInPlay(card: CreatureCard): CreatureInPlay {
  return { uid: makeUid(card.id), card, damage: 0, attached: [] };
}

function isBasic(card: CreatureCard): boolean {
  return card.stage === "basic";
}

/** Draw `count` cards from the top of the deck, returning hand + remaining deck. */
function draw(deck: CreatureCard[], count: number): { hand: CreatureCard[]; rest: CreatureCard[] } {
  return { hand: deck.slice(0, count), rest: deck.slice(count) };
}

/**
 * Shuffle a deck and draw an opening hand, redrawing (mulligan) until the hand
 * contains at least one Basic. Returns hand, remaining deck, and advanced RNG.
 */
function openingHand(
  state: number,
  deck: CreatureCard[]
): { hand: CreatureCard[]; deck: CreatureCard[]; state: number } {
  let s = state;
  // Bound the mulligan loop defensively; every deck here contains only Basics.
  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffled = shuffle(s, deck);
    s = shuffled.state;
    const { hand, rest } = draw(shuffled.value, HAND_SIZE);
    if (hand.some(isBasic)) {
      return { hand, deck: rest, state: s };
    }
  }
  throw new Error("Deck contains no Basic creature; cannot form an opening hand.");
}

function buildPlayer(
  id: PlayerId,
  hand: CreatureCard[],
  deck: CreatureCard[],
  energyType: PlayerState["energyType"]
): PlayerState {
  // Auto-place the first Basic as active; the rest stay in hand (bench filled during play).
  const activeIndex = hand.findIndex(isBasic);
  const active = toInPlay(hand[activeIndex]!);
  const remainingHand = hand.filter((_, i) => i !== activeIndex);
  return {
    id,
    deck,
    hand: remainingHand,
    active,
    bench: [],
    energyType,
    pendingEnergy: null,
    discard: [],
    points: 0,
    hasAttachedEnergy: false,
    hasRetreated: false,
  };
}

export function createBattle(config: BattleConfig): BattleState {
  let s = config.seed | 0;

  const p1Open = openingHand(s, config.deckP1);
  s = p1Open.state;
  const p2Open = openingHand(s, config.deckP2);
  s = p2Open.state;

  const p1 = buildPlayer("P1", p1Open.hand, p1Open.deck, config.energyTypeP1);
  const p2 = buildPlayer("P2", p2Open.hand, p2Open.deck, config.energyTypeP2);

  const starterRoll = nextInt(s, 2);
  s = starterRoll.state;
  const starter: PlayerId = starterRoll.value === 0 ? "P1" : "P2";

  const initial: BattleState = {
    players: { P1: p1, P2: p2 },
    turnPlayer: starter,
    turnNumber: 0,
    phase: { kind: "main" },
    rngState: s,
    winner: null,
    log: [`Battle start. ${starter} goes first.`],
    events: [{ kind: "battleStarted", firstPlayer: starter }],
  };

  // Begin the starter's first turn (turn 1 exception: no energy, no draw).
  return beginTurn(initial);
}
