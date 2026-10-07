// Turn flow: beginTurn (energy + draw with turn-1 exception) and endTurn.

import type { BattleState, PlayerId, PlayerState } from "./types.js";
import { opponentOf } from "./types.js";

function cloneState(state: BattleState): BattleState {
  return {
    players: {
      P1: clonePlayer(state.players.P1),
      P2: clonePlayer(state.players.P2),
    },
    turnPlayer: state.turnPlayer,
    turnNumber: state.turnNumber,
    phase: state.phase,
    rngState: state.rngState,
    winner: state.winner,
    log: state.log.slice(),
    events: state.events.slice(),
  };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    deck: p.deck.slice(),
    hand: p.hand.slice(),
    active: p.active ? { ...p.active, attached: p.active.attached.slice() } : null,
    bench: p.bench.map((c) => ({ ...c, attached: c.attached.slice() })),
    discard: p.discard.slice(),
  };
}

export { cloneState, clonePlayer };

/**
 * Begin the turn for state.turnPlayer. Increments turnNumber. Generates one
 * energy and draws one card, EXCEPT on the very first turn of the game (turn 1)
 * for the starting player, who skips both.
 */
export function beginTurn(state: BattleState): BattleState {
  const next = cloneState(state);
  next.turnNumber += 1;

  const player = next.players[next.turnPlayer];
  player.hasAttachedEnergy = false;
  player.hasRetreated = false;
  player.pendingEnergy = null;

  const isFirstTurnOfGame = next.turnNumber === 1;
  next.events.push({ kind: "turnStarted", player: player.id, turnNumber: next.turnNumber });

  if (!isFirstTurnOfGame) {
    player.pendingEnergy = player.energyType;
    next.events.push({ kind: "energyGenerated", player: player.id, energy: player.energyType });
    if (player.deck.length > 0) {
      const drawn = player.deck[0]!;
      player.deck = player.deck.slice(1);
      player.hand.push(drawn);
      next.events.push({ kind: "cardDrawn", player: player.id });
    }
    next.log.push(`${player.id}'s turn ${next.turnNumber}: +1 ${player.energyType} energy, drew a card.`);
  } else {
    next.log.push(`${player.id}'s turn 1: no energy, no draw (starting player).`);
  }

  return next;
}

/**
 * End the current player's turn: discard unattached energy, pass to the
 * opponent, and begin their turn. Does nothing if the game already has a winner.
 */
export function endTurn(state: BattleState): BattleState {
  if (state.winner) return state;
  const next = cloneState(state);
  const current = next.players[next.turnPlayer];
  if (current.pendingEnergy) {
    next.log.push(`${current.id} discarded 1 unattached ${current.pendingEnergy} energy.`);
    current.discard.push({ kind: "energy", energy: current.pendingEnergy });
    next.events.push({ kind: "energyDiscarded", player: current.id, energy: current.pendingEnergy });
    current.pendingEnergy = null;
  }
  const nextPlayer: PlayerId = opponentOf(next.turnPlayer);
  next.turnPlayer = nextPlayer;
  return beginTurn(next);
}
