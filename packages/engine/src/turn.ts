// Turn flow: beginTurn (energy + draw with turn-1 exception) and endTurn.

import type { BattleState, PlayerId, PlayerState } from "./types.js";
import { opponentOf, POINTS_TO_WIN } from "./types.js";
import { nextInt, nextFloat } from "./rng.js";
import { isKnockedOut, pointsForKo } from "./combat.js";

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
  for (const fighter of [player.active, ...player.bench]) {
    if (fighter) fighter.damageReduction = 0;
  }
  player.hasAttachedEnergy = false;
  player.hasRetreated = false;
  player.hasPlayedSupporter = false;
  player.retreatReduction = 0;
  player.attackDamageBonus = 0;
  player.attacksUsedThisTurn = 0;
  player.pendingEnergy = null;

  const isFirstTurnOfGame = next.turnNumber === 1;
  next.events.push({ kind: "turnStarted", player: player.id, turnNumber: next.turnNumber });

  if (!isFirstTurnOfGame) {
    const types = player.energyTypes?.length ? player.energyTypes : [player.energyType];
    if (types.length > 1) {
      const roll = nextInt(next.rngState, types.length);
      next.rngState = roll.state;
      player.pendingEnergy = types[roll.value]!;
    } else player.pendingEnergy = types[0]!;
    next.events.push({ kind: "energyGenerated", player: player.id, energy: player.pendingEnergy });
    if (player.deck.length > 0) {
      const drawn = player.deck[0]!;
      player.deck = player.deck.slice(1);
      player.hand.push(drawn);
      next.events.push({ kind: "cardDrawn", player: player.id });
    }
    next.log.push(`${player.id}'s turn ${next.turnNumber}: +1 ${player.pendingEnergy} energy, drew a card.`);
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
  for (const fighter of [current.active, ...current.bench]) {
    if (!fighter) continue;
    if (fighter.paralyzed) next.log.push(`${fighter.card.name} recovered from Paralysis.`);
    fighter.paralyzed = false;
    fighter.cannotRetreat = false;
    fighter.retreatCostIncrease = 0;
  }
  current.retreatReduction = 0;
  current.attackDamageBonus = 0;
  for (const player of Object.values(next.players)) {
    for (const fighter of [player.active, ...player.bench]) {
      if (fighter?.damageVulnerability && fighter.damageVulnerability.expiresAfterTurn <= next.turnNumber) fighter.damageVulnerability = undefined;
    }
  }
  const nextPlayer: PlayerId = opponentOf(next.turnPlayer);
  // Fighter checkup happens at every turn boundary, for both active fighters.
  // Apply all damage and recovery flips before resolving knockouts.
  for (const id of [current.id, nextPlayer]) {
    const fighter = next.players[id].active;
    if (!fighter) continue;
    if (fighter.bleeding) {
      fighter.damage += 10;
      next.events.push({ kind: "damageDealt", player: id, uid: fighter.uid, amount: 10, weakness: false });
      next.log.push(`${fighter.card.name} took 10 Bleeding damage during fighter checkup.`);
    }
    if (!fighter.burned) continue;
    fighter.damage += 20;
    next.events.push({ kind: "damageDealt", player: id, uid: fighter.uid, amount: 20, weakness: false });
    next.log.push(`${fighter.card.name} took 20 Burn damage during fighter checkup.`);
    const roll = nextFloat(next.rngState);
    next.rngState = roll.state;
    const result = roll.value < 0.5 ? "heads" : "tails";
    next.events.push({ kind: "coinFlipped", player: id, result, flip: 1, bonus: 0, reason: "burn" });
    fighter.burned = result === "heads";
    next.log.push(`${fighter.card.name}'s Burn check: ${result}. ${fighter.burned ? "Burn remains." : "Burn removed."}`);
  }
  for (const id of [current.id, nextPlayer]) {
    const player = next.players[id];
    const fighter = player.active;
    if (!fighter || !isKnockedOut(fighter)) continue;
    const scorer = next.players[opponentOf(id)];
    const points = pointsForKo(fighter);
    scorer.points += points;
    next.events.push({ kind: "knockedOut", player: id, fighter: { ...fighter, attached: fighter.attached.slice() }, pointsAwarded: points });
    next.log.push(`${fighter.card.name} was knocked out during checkup. ${scorer.id} +${points} point(s).`);
    player.discard.push({ kind: "fighter", card: fighter.card });
    for (const card of fighter.previousStages ?? []) player.discard.push({ kind: "fighter", card });
    for (const energy of fighter.attached) player.discard.push({ kind: "energy", energy });
    player.active = null;
  }
  for (const id of [nextPlayer, current.id]) {
    const enemy = next.players[opponentOf(id)];
    const reason = next.players[id].points >= POINTS_TO_WIN ? "points"
      : !enemy.active && !enemy.bench.length ? "noFighters" : null;
    if (reason) {
      next.winner = id;
      next.events.push({ kind: "gameWon", player: id, reason });
      next.log.push(`${id} wins after fighter checkup!`);
      return next;
    }
  }
  next.turnPlayer = nextPlayer;
  const started = beginTurn(next);
  for (const id of [nextPlayer, current.id]) {
    if (!started.players[id].active) {
      started.phase = { kind: "awaitPromotion", player: id };
      break;
    }
  }
  return started;
}
