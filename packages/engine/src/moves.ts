// The rule core: getLegalMoves and applyMove.
//
// Every rule the game enforces lives here. The UI and AI rely solely on this
// surface: if a move is not returned by getLegalMoves, applyMove rejects it.

import type { BattleState, CreatureInPlay, Move, PlayerId, PlayerState } from "./types.js";
import { MAX_BENCH, POINTS_TO_WIN, opponentOf, isCreatureCard } from "./types.js";
import { canPayCost, computeDamage, isKnockedOut, isWeakTo, pointsForKo } from "./combat.js";
import { cloneState, endTurn } from "./turn.js";
import { toInPlay } from "./setup.js";
import { nextFloat } from "./rng.js";

/** Who is expected to act right now (normally turnPlayer; the promoter in awaitPromotion). */
export function actingPlayer(state: BattleState): PlayerId {
  if (state.phase.kind === "awaitPromotion") return state.phase.player;
  return state.turnPlayer;
}

export function getRetreatCost(player: PlayerState): number {
  return Math.max(0, (player.active?.card.retreatCost ?? 0) - player.retreatReduction);
}

export function getLegalMoves(state: BattleState): Move[] {
  if (state.winner) return [];

  // In promotion phase, only the promoting player may act, and only via promote.
  if (state.phase.kind === "awaitPromotion") {
    const player = state.players[state.phase.player];
    return player.bench.map((_, benchIndex) => ({ type: "promote", benchIndex }) as Move);
  }

  const player = state.players[state.turnPlayer];
  const moves: Move[] = [];

  // Attach the turn's energy (once per turn) to any creature in play.
  if (player.pendingEnergy && !player.hasAttachedEnergy) {
    const targets = creaturesInPlay(player);
    for (const c of targets) {
      moves.push({ type: "attachEnergy", targetUid: c.uid });
    }
  }

  // Play a Basic from hand to an open bench slot.
  if (player.bench.length < MAX_BENCH) {
    player.hand.forEach((card, handIndex) => {
      if (isCreatureCard(card) && card.stage === "basic") {
        moves.push({ type: "playBasic", handIndex });
      }
    });
  }

  player.hand.forEach((card, handIndex) => {
    if (isCreatureCard(card) || (card.kind === "supporter" && player.hasPlayedSupporter)) return;
    switch (card.effect.kind) {
      case "heal": {
        const targets = card.effect.target === "active" ? (player.active ? [player.active] : []) : creaturesInPlay(player);
        for (const target of targets) {
          if (target.damage > 0) moves.push({ type: "playTrainer", handIndex, targetUid: target.uid });
        }
        break;
      }
      case "draw":
        if (player.deck.length > 0) moves.push({ type: "playTrainer", handIndex });
        break;
      case "reduceRetreat":
        if (player.active && getRetreatCost(player) > 0) moves.push({ type: "playTrainer", handIndex });
        break;
    }
  });

  // Retreat (once per turn): swap active with a benched creature, pay retreat cost.
  if (
    player.active &&
    !player.hasRetreated &&
    player.active.attached.length >= getRetreatCost(player)
  ) {
    player.bench.forEach((_, benchIndex) => {
      moves.push({ type: "retreat", benchIndex });
    });
  }

  // Attack with the active creature if its cost is paid. Attacking ends the turn.
  if (player.active) {
    for (const attack of player.active.card.attacks) {
      if (canPayCost(player.active.attached, attack.cost)) {
        moves.push({ type: "attack", attackId: attack.id });
      }
    }
  }

  // Always able to pass.
  moves.push({ type: "pass" });

  return moves;
}

function creaturesInPlay(player: PlayerState): CreatureInPlay[] {
  return player.active ? [player.active, ...player.bench] : [...player.bench];
}

function movesEqual(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "playTrainer": {
      const trainer = b as typeof a;
      return a.handIndex === trainer.handIndex && a.targetUid === trainer.targetUid;
    }
    case "attachEnergy":
      return a.targetUid === (b as typeof a).targetUid;
    case "playBasic":
      return a.handIndex === (b as typeof a).handIndex;
    case "retreat":
      return a.benchIndex === (b as typeof a).benchIndex;
    case "attack":
      return a.attackId === (b as typeof a).attackId;
    case "promote":
      return a.benchIndex === (b as typeof a).benchIndex;
    case "pass":
      return true;
  }
}

export function applyMove(state: BattleState, move: Move): BattleState {
  const legal = getLegalMoves(state);
  if (!legal.some((m) => movesEqual(m, move))) {
    throw new Error(`Illegal move: ${JSON.stringify(move)}`);
  }

  switch (move.type) {
    case "playTrainer":
      return applyTrainer(state, move);
    case "promote":
      return applyPromote(state, move.benchIndex);
    case "attachEnergy":
      return applyAttachEnergy(state, move.targetUid);
    case "playBasic":
      return applyPlayBasic(state, move.handIndex);
    case "retreat":
      return applyRetreat(state, move.benchIndex);
    case "attack":
      return applyAttack(state, move.attackId);
    case "pass":
      return endTurn(state);
  }
}

function applyPromote(state: BattleState, benchIndex: number): BattleState {
  const next = cloneState(state);
  const pid = (next.phase.kind === "awaitPromotion" ? next.phase.player : next.turnPlayer);
  const player = next.players[pid];
  const promoted = player.bench[benchIndex]!;
  player.bench = player.bench.filter((_, i) => i !== benchIndex);
  player.active = promoted;
  next.log.push(`${pid} promoted ${promoted.card.name} to active.`);
  next.events.push({ kind: "promoted", player: pid, uid: promoted.uid });
  next.phase = { kind: "main" };
  // Promotion happens as a consequence of the opponent's attack, which already
  // ended that attacker's turn. Continue into the promoter's own turn.
  return next;
}

function applyAttachEnergy(state: BattleState, targetUid: string): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const target = creaturesInPlay(player).find((c) => c.uid === targetUid)!;
  target.attached.push(player.pendingEnergy!);
  next.log.push(`${player.id} attached ${player.pendingEnergy} energy to ${target.card.name}.`);
  next.events.push({
    kind: "energyAttached",
    player: player.id,
    targetUid: target.uid,
    energy: player.pendingEnergy!,
  });
  player.pendingEnergy = null;
  player.hasAttachedEnergy = true;
  return next;
}

function applyPlayBasic(state: BattleState, handIndex: number): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const card = player.hand[handIndex]!;
  if (!isCreatureCard(card)) throw new Error("Only mons can be benched.");
  player.hand = player.hand.filter((_, i) => i !== handIndex);
  const benched = toInPlay(card);
  player.bench.push(benched);
  next.log.push(`${player.id} benched ${card.name}.`);
  next.events.push({ kind: "creatureBenched", player: player.id, uid: benched.uid });
  return next;
}

function applyRetreat(state: BattleState, benchIndex: number): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const active = player.active!;
  // Pay retreat cost by discarding energy from the active into the discard pile.
  const cost = getRetreatCost(player);
  const paid = active.attached.slice(0, cost);
  active.attached = active.attached.slice(cost);
  for (const energy of paid) {
    player.discard.push({ kind: "energy", energy });
  }
  const incoming = player.bench[benchIndex]!;
  player.bench = player.bench.filter((_, i) => i !== benchIndex);
  player.bench.push(active);
  player.active = incoming;
  player.hasRetreated = true;
  next.log.push(`${player.id} retreated ${active.card.name}, ${incoming.card.name} is now active.`);
  next.events.push({
    kind: "retreated",
    player: player.id,
    outUid: active.uid,
    inUid: incoming.uid,
    paid,
  });
  return next;
}

function applyTrainer(state: BattleState, move: Extract<Move, { type: "playTrainer" }>): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const card = player.hand[move.handIndex]!;
  if (isCreatureCard(card)) throw new Error("Expected an item or supporter.");
  player.hand.splice(move.handIndex, 1);
  player.discard.push({ kind: "trainer", card });
  if (card.kind === "supporter") player.hasPlayedSupporter = true;
  next.events.push({ kind: "trainerPlayed", player: player.id, card });
  next.log.push(`${player.id} played ${card.name}.`);
  switch (card.effect.kind) {
    case "heal": {
      const target = creaturesInPlay(player).find((mon) => mon.uid === move.targetUid)!;
      const amount = Math.min(target.damage, card.effect.amount);
      target.damage -= amount;
      next.events.push({ kind: "healed", player: player.id, uid: target.uid, amount });
      next.log.push(`${target.card.name} healed ${amount} HP.`);
      break;
    }
    case "draw": {
      const drawn = player.deck.splice(0, card.effect.count);
      player.hand.push(...drawn);
      for (const _card of drawn) next.events.push({ kind: "cardDrawn", player: player.id });
      next.log.push(`${player.id} drew ${drawn.length} cards.`);
      break;
    }
    case "reduceRetreat":
      player.retreatReduction += card.effect.amount;
      next.events.push({ kind: "retreatCostReduced", player: player.id, amount: card.effect.amount });
      next.log.push(`${player.id}'s active mon has ${card.effect.amount} less retreat cost this turn.`);
      break;
  }
  return next;
}

function applyAttack(state: BattleState, attackId: string): BattleState {
  const next = cloneState(state);
  const attackerId = next.turnPlayer;
  const defenderId = opponentOf(attackerId);
  const attacker = next.players[attackerId];
  const defender = next.players[defenderId];
  const attackingCreature = attacker.active!;
  const defendingCreature = defender.active!;
  const attack = attackingCreature.card.attacks.find((a) => a.id === attackId)!;

  let damage = computeDamage(attackingCreature, defendingCreature, attack);
  for (const effect of attack.effects ?? []) {
    if (effect.kind !== "flipUntilTails") continue;
    damage -= effect.amount; // Replace the expected bonus with actual flips.
    let flip = 0;
    let bonus = 0;
    let heads: boolean;
    do {
      const roll = nextFloat(next.rngState);
      next.rngState = roll.state;
      heads = roll.value < 0.5;
      if (heads) bonus += effect.amount;
      next.events.push({ kind: "coinFlipped", player: attackerId, result: heads ? "heads" : "tails", flip: ++flip, bonus });
      next.log.push(`${attackerId} flipped ${heads ? "heads" : "tails"} (+${bonus} damage).`);
    } while (heads);
    damage += bonus;
  }
  defendingCreature.damage += damage;
  next.log.push(
    `${attacker.id}'s ${attackingCreature.card.name} used ${attack.name} for ${damage} damage.`
  );
  next.events.push({
    kind: "attackUsed",
    player: attackerId,
    attackerUid: attackingCreature.uid,
    attackId,
    targetUid: defendingCreature.uid,
  });
  next.events.push({
    kind: "damageDealt",
    player: defenderId,
    uid: defendingCreature.uid,
    amount: damage,
    weakness: isWeakTo(attackingCreature, defendingCreature),
  });

  if (isKnockedOut(defendingCreature)) {
    const points = pointsForKo(defendingCreature);
    attacker.points += points;
    next.log.push(
      `${defender.id}'s ${defendingCreature.card.name} was knocked out. ${attacker.id} +${points} point(s).`
    );
    // Snapshot (post-hit) so the UI can keep showing it while the KO animates.
    next.events.push({
      kind: "knockedOut",
      player: defenderId,
      creature: { ...defendingCreature, attached: defendingCreature.attached.slice() },
      pointsAwarded: points,
    });
    // Move the KO'd creature and its attached energy to the owner's discard pile.
    defender.discard.push({ kind: "creature", card: defendingCreature.card });
    for (const energy of defendingCreature.attached) {
      defender.discard.push({ kind: "energy", energy });
    }
    defender.active = null;

    if (attacker.points >= POINTS_TO_WIN) {
      next.winner = attackerId;
      next.log.push(`${attackerId} wins with ${attacker.points} points!`);
      next.events.push({ kind: "gameWon", player: attackerId, reason: "points" });
      return next;
    }

    if (defender.bench.length === 0) {
      // Defender cannot field an active creature -> loss.
      next.winner = attackerId;
      next.log.push(`${defenderId} has no creatures left. ${attackerId} wins!`);
      next.events.push({ kind: "gameWon", player: attackerId, reason: "noCreatures" });
      return next;
    }

    // Defender must promote before play continues.
    const ended = endTurn(next);
    // endTurn passed the turn to the defender; require promotion first.
    return { ...ended, phase: { kind: "awaitPromotion", player: defenderId } };
  }

  // No KO: attacking ends the turn normally.
  return endTurn(next);
}
