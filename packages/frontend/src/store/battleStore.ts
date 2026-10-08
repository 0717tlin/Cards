// Zustand store wrapping the engine. Components read state and dispatch moves;
// all rules live in the engine (see .kiro/steering/conventions.md).
//
// Pacing: after every move (human or AI) the store commits the new state, then
// keeps input locked (`busy`) for as long as that move's events take to animate
// (see animation/timing.ts). If the AI is to act next, it waits a short "think"
// pause and applies exactly one AI move, then repeats. Every scheduled callback
// checks `gameId`, so starting a new game cancels anything still pending.

import { create } from "zustand";
import {
  createBattle,
  isFighterCard,
  getLegalMoves,
  applyMove,
  actingPlayer,
  DECK_PLAYER,
  DECK_AI,
  PLAYER_ENERGY,
  AI_ENERGY,
  chooseMove,
  type BattleState,
  type Move,
  type PlayerId,
  type CardDefinition,
  type EnergyType,
} from "@card-game/engine";
import { aiThinkTime, animationTime } from "../animation/timing";

const HUMAN: PlayerId = "P1";
const AI: PlayerId = "P2";

/** Infer an energy zone type from a deck: the most common non-colorless fighter type. */
function inferEnergyType(deck: BattleState["players"]["P1"]["deck"]): EnergyType {
  const counts = new Map<EnergyType, number>();
  for (const card of deck) {
    if (!isFighterCard(card) || card.type === "colorless") continue;
    counts.set(card.type, (counts.get(card.type) ?? 0) + 1);
  }
  let best: EnergyType = PLAYER_ENERGY;
  let bestCount = -1;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = type;
    }
  }
  return best;
}

function makeBattle(seed: number, humanDeck?: CardDefinition[], energyTypes?: EnergyType[]): BattleState {
  const deckP1 = humanDeck ?? DECK_PLAYER;
  return createBattle({
    seed,
    deckP1,
    deckP2: DECK_AI,
    energyTypeP1: humanDeck ? inferEnergyType(deckP1) : PLAYER_ENERGY,
    energyTypeP2: AI_ENERGY,
    energyTypesP1: energyTypes,
  });
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

interface BattleStore {
  state: BattleState;
  seed: number;
  /** Legal moves for the human; empty while busy or when it isn't the human's turn. */
  humanMoves: Move[];
  /** True while animations play or the AI is acting. Input is locked. */
  busy: boolean;
  /** True while the AI is the one acting (for the "Opponent's turn…" hint). */
  aiActing: boolean;
  /** Index in state.events where the batch currently animating begins. */
  batchStart: number;
  /** Incremented by newGame; stale timers compare against it and do nothing. */
  gameId: number;
  /** The human deck last used to start a battle; null = default deck. */
  humanDeck: CardDefinition[] | null;
  humanEnergyTypes: EnergyType[] | null;
  newGame: (opts?: { humanDeck?: CardDefinition[]; energyTypes?: EnergyType[]; seed?: number }) => void;
  dispatch: (move: Move) => void;
}

/** The human's legal moves, only when the human is the acting player. */
function humanLegalMoves(state: BattleState): Move[] {
  if (state.winner) return [];
  return actingPlayer(state) === HUMAN ? getLegalMoves(state) : [];
}

function aiToAct(state: BattleState): boolean {
  return !state.winner && actingPlayer(state) === AI;
}

export const useBattleStore = create<BattleStore>((set, get) => {
  /** Run `fn` after `ms`, unless a new game has started in the meantime. */
  function schedule(id: number, ms: number, fn: () => void) {
    setTimeout(() => {
      if (get().gameId === id) fn();
    }, ms);
  }

  /** Commit a move's result and lock input while its events animate. */
  function commit(prev: BattleState, next: BattleState, id: number) {
    set({
      state: next,
      busy: true,
      humanMoves: [],
      aiActing: aiToAct(next),
      batchStart: prev.events.length,
    });
    schedule(id, animationTime(next.events.slice(prev.events.length)), () => advance(id));
  }

  /** After animations: either take the AI's next single step, or hand control back. */
  function advance(id: number) {
    const state = get().state;
    if (aiToAct(state)) {
      schedule(id, aiThinkTime(), () => {
        const current = get().state;
        commit(current, applyMove(current, chooseMove(current)), id);
      });
      return;
    }
    set({ busy: false, aiActing: false, humanMoves: humanLegalMoves(state) });
  }

  function start(state: BattleState, id: number) {
    // The opening events (battle start + first turn banner) animate first; if
    // the AI goes first, advance() then plays its opening turn step by step.
    schedule(id, animationTime(state.events), () => advance(id));
  }

  const initialSeed = randomSeed();
  const initial = makeBattle(initialSeed);
  start(initial, 0);

  return {
    state: initial,
    seed: initialSeed,
    humanMoves: [],
    busy: true,
    aiActing: aiToAct(initial),
    batchStart: 0,
    gameId: 0,
    humanDeck: null,
    humanEnergyTypes: null,

    newGame: (opts) => {
      const seed = opts?.seed ?? randomSeed();
      // Reuse the deck from opts if given, otherwise keep the last-used deck.
      const humanDeck = opts?.humanDeck ?? get().humanDeck ?? undefined;
      const energyTypes = opts?.energyTypes ?? (opts?.humanDeck ? undefined : get().humanEnergyTypes ?? undefined);
      const state = makeBattle(seed, humanDeck, energyTypes);
      const id = get().gameId + 1;
      set({
        state,
        seed,
        gameId: id,
        humanMoves: [],
        busy: true,
        aiActing: aiToAct(state),
        batchStart: 0,
        humanDeck: humanDeck ?? null,
        humanEnergyTypes: energyTypes ?? null,
      });
      start(state, id);
    },

    dispatch: (move: Move) => {
      const { state, busy, gameId } = get();
      if (busy || state.winner || actingPlayer(state) !== HUMAN) return;
      commit(state, applyMove(state, move), gameId);
    },
  };
});

export { HUMAN, AI };
