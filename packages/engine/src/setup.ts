// Battle setup: createBattle builds a deterministic initial state.

import type {
  BattleConfig,
  BattleState,
  FighterCard,
  CardDefinition,
  FighterInPlay,
  PlayerId,
  PlayerState,
} from "./types.js";
import { HAND_SIZE, isFighterCard } from "./types.js";
import { nextInt, shuffle } from "./rng.js";
import { beginTurn } from "./turn.js";

let uidCounter = 0;
/** Instance uid. Deterministic within a process run; unique per fighter instance. */
export function makeUid(cardId: string): string {
  uidCounter += 1;
  return `${cardId}#${uidCounter}`;
}

export function toInPlay(card: FighterCard): FighterInPlay {
  return { uid: makeUid(card.id), card, damage: 0, attached: [] };
}

function isBasic(card: CardDefinition): card is FighterCard {
  return isFighterCard(card) && card.stage === "basic";
}

/** Draw `count` cards from the top of the deck, returning hand + remaining deck. */
function draw(deck: CardDefinition[], count: number): { hand: CardDefinition[]; rest: CardDefinition[] } {
  return { hand: deck.slice(0, count), rest: deck.slice(count) };
}

/**
 * Shuffle a deck and draw an opening hand, redrawing (mulligan) until the hand
 * contains at least one Basic. Returns hand, remaining deck, and advanced RNG.
 */
function openingHand(
  state: number,
  deck: CardDefinition[]
): { hand: CardDefinition[]; deck: CardDefinition[]; state: number } {
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
  throw new Error("Deck contains no Basic fighter; cannot form an opening hand.");
}

function buildPlayer(
  id: PlayerId,
  hand: CardDefinition[],
  deck: CardDefinition[],
  energyType: PlayerState["energyType"]
): PlayerState {
  // Auto-place the first Basic as active; the rest stay in hand (bench filled during play).
  const activeIndex = hand.findIndex(isBasic);
  const active = toInPlay(hand.find(isBasic)!);
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
    hasPlayedSupporter: false,
    retreatReduction: 0,
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
  p1.energyTypes = [...new Set(config.energyTypesP1?.length ? config.energyTypesP1 : [config.energyTypeP1])];
  p2.energyTypes = [...new Set(config.energyTypesP2?.length ? config.energyTypesP2 : [config.energyTypeP2])];

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
