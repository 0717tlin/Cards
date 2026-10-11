// The rule core: getLegalMoves and applyMove.
//
// Every rule the game enforces lives here. The UI and AI rely solely on this
// surface: if a move is not returned by getLegalMoves, applyMove rejects it.

import type { BattleState, FighterInPlay, Move, PlayerId, PlayerState } from "./types.js";
import { MAX_BENCH, POINTS_TO_WIN, opponentOf, isFighterCard } from "./types.js";
import { canPayCost, computeDamage, getAvailableAttacks, matchesNamedNonEx, isKnockedOut, isWeakTo, pointsForKo } from "./combat.js";
import { cloneState, endTurn } from "./turn.js";
import { toInPlay } from "./setup.js";
import { nextFloat, nextInt, shuffle } from "./rng.js";

/** Who is expected to act right now (normally turnPlayer; the promoter in awaitPromotion). */
export function actingPlayer(state: BattleState): PlayerId {
  if (state.phase.kind === "awaitPromotion") return state.phase.player;
  return state.turnPlayer;
}

export function getRetreatCost(player: PlayerState): number {
  return Math.max(0, (player.active?.card.retreatCost ?? 0) + (player.active?.retreatCostIncrease ?? 0) - player.retreatReduction);
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
  for (const fighter of fightersInPlay(player)) {
    const effect = fighter.card.ability?.effect;
    if (effect?.kind === "discardEnergyToHeal" && fighter.damage > 0 && fighter.attached.includes(effect.energy) && fighter.abilityUsedTurn !== state.turnNumber) {
      moves.push({ type: "useAbility", targetUid: fighter.uid });
    }
    if (effect?.kind === "peekOpponentDeck" && fighter === player.active && fighter.abilityUsedTurn !== state.turnNumber && state.players[opponentOf(player.id)].deck.length) {
      moves.push({ type: "useAbility", targetUid: fighter.uid });
    }
    if (effect?.kind === "searchDeckToTop" && fighter.abilityUsedTurn !== state.turnNumber) {
      for (const cardId of effect.cardIds) {
        if (player.deck.some(card => card.id === cardId)) moves.push({ type: "useAbility", targetUid: fighter.uid, cardId });
      }
    }
  }
  player.hand.forEach((card, handIndex) => {
    if (!isFighterCard(card) || !card.evolvesFrom || state.turnNumber <= 2) return;
    for (const fighter of fightersInPlay(player)) {
      if (fighter.card.id === card.evolvesFrom && (fighter.enteredTurn ?? 0) < state.turnNumber && fighter.evolvedTurn !== state.turnNumber) {
        moves.push({ type: "evolve", handIndex, targetUid: fighter.uid });
      }
    }
  });

  // Attach the turn's energy (once per turn) to any fighter in play.
  if (player.pendingEnergy && !player.hasAttachedEnergy) {
    const targets = fightersInPlay(player);
    for (const c of targets) {
      moves.push({ type: "attachEnergy", targetUid: c.uid });
    }
  }

  // Play a Basic from hand to an open bench slot.
  if (player.bench.length < MAX_BENCH) {
    player.hand.forEach((card, handIndex) => {
      if (isFighterCard(card) && card.stage === "basic") {
        moves.push({ type: "playBasic", handIndex });
      }
    });
  }

  player.hand.forEach((card, handIndex) => {
    if (isFighterCard(card) || (card.kind === "supporter" && player.hasPlayedSupporter)) return;
    switch (card.effect.kind) {
      case "searchNamedFighterToTop": {
        const names = card.effect.names;
        const matchingIds = player.deck.filter(candidate => isFighterCard(candidate) && matchesNamedNonEx(candidate, names)).map(candidate => candidate.id);
        for (const cardId of new Set(matchingIds)) {
          moves.push({ type: "playTrainer", handIndex, cardId });
        }
        break;
      }
      case "switchDamagedOpponentBench": {
        const opponent = state.players[opponentOf(player.id)];
        if (opponent.active) {
          for (const target of opponent.bench) {
            if (target.damage > 0) moves.push({ type: "playTrainer", handIndex, targetUid: target.uid });
          }
        }
        break;
      }
      case "boostActiveAttackDamage":
        if (player.active) moves.push({ type: "playTrainer", handIndex });
        break;
      case "searchRandomBasic":
        if (player.deck.some(card => isFighterCard(card) && card.stage === "basic")) moves.push({ type: "playTrainer", handIndex });
        break;
      case "heal": {
        const targets = card.effect.target === "active" ? (player.active ? [player.active] : []) : fightersInPlay(player);
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

  // Retreat (once per turn): swap active with a benched fighter, pay retreat cost.
  if (
    player.active &&
    !player.active.paralyzed &&
    !player.active.cannotRetreat &&
    !player.hasRetreated &&
    player.active.attached.length >= getRetreatCost(player)
  ) {
    player.bench.forEach((_, benchIndex) => {
      moves.push({ type: "retreat", benchIndex });
    });
  }

  // Attack with the active fighter if its cost is paid. Attacking ends the turn.
  if (player.active && !player.active.paralyzed && (player.attacksUsedThisTurn ?? 0) < (player.active.card.ability?.effect?.kind === "attackTwice" ? 2 : 1)) {
    for (const attack of getAvailableAttacks(player.active, player.bench)) {
      if (canPayCost(player.active.attached, attack.cost)) {
        if (attack.effects?.some(effect => effect.kind === "damageAnyFighter")) {
          for (const target of fightersInPlay(state.players[opponentOf(player.id)])) moves.push({ type: "attack", attackId: attack.id, targetUid: target.uid });
          continue;
        }
        if (attack.effects?.some(effect => effect.kind === "switchWithBench") && player.bench.length) {
          for (const target of player.bench) moves.push({ type: "attack", attackId: attack.id, targetUid: target.uid });
          continue;
        }
        const effect = attack.effects?.find(effect => effect.kind === "benchDamage");
        const opposingBench = state.players[opponentOf(player.id)].bench;
        if (effect?.kind === "benchDamage" && opposingBench.length && player.bench.some(fighter => fighter.card.id === effect.chooseWithCardId)) {
          for (const target of opposingBench) moves.push({ type: "attack", attackId: attack.id, targetUid: target.uid });
        } else moves.push({ type: "attack", attackId: attack.id });
      }
    }
  }

  // Always able to pass.
  moves.push({ type: "pass" });

  return moves;
}

function fightersInPlay(player: PlayerState): FighterInPlay[] {
  return player.active ? [player.active, ...player.bench] : [...player.bench];
}

function movesEqual(a: Move, b: Move): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "useAbility":
      return a.targetUid === (b as typeof a).targetUid && a.cardId === (b as typeof a).cardId;
    case "evolve":
      return a.handIndex === (b as typeof a).handIndex && a.targetUid === (b as typeof a).targetUid;
    case "playTrainer": {
      const trainer = b as typeof a;
      return a.handIndex === trainer.handIndex && a.targetUid === trainer.targetUid && a.cardId === trainer.cardId;
    }
    case "attachEnergy":
      return a.targetUid === (b as typeof a).targetUid;
    case "playBasic":
      return a.handIndex === (b as typeof a).handIndex;
    case "retreat":
      return a.benchIndex === (b as typeof a).benchIndex;
    case "attack":
      return a.attackId === (b as typeof a).attackId && a.targetUid === (b as typeof a).targetUid;
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
    case "useAbility": {
      const next = cloneState(state);
      const player = next.players[next.turnPlayer];
      const fighter = fightersInPlay(player).find((c) => c.uid === move.targetUid)!;
      const ability = fighter.card.ability!;
      const effect = ability.effect!;
      if (effect.kind === "peekOpponentDeck") {
        fighter.abilityUsedTurn = next.turnNumber;
        next.events.push({ kind: "abilityUsed", player: player.id, uid: fighter.uid, name: ability.name });
        next.events.push({ kind: "deckPeeked", player: player.id, card: next.players[opponentOf(player.id)].deck[0]! });
        next.log.push(`${fighter.card.name} used ${ability.name} to view the opponent's top card.`);
        return next;
      }
      if (effect.kind === "searchDeckToTop") {
        const index = player.deck.findIndex(card => card.id === move.cardId);
        const card = player.deck.splice(index, 1)[0]!;
        player.deck.unshift(card);
        fighter.abilityUsedTurn = next.turnNumber;
        next.events.push({ kind: "abilityUsed", player: player.id, uid: fighter.uid, name: ability.name });
        next.log.push(`${fighter.card.name} used ${ability.name}: put ${card.name} on top of the deck.`);
        return next;
      }
      if (effect.kind !== "discardEnergyToHeal") throw new Error("This ability is passive.");
      const index = fighter.attached.indexOf(effect.energy);
      fighter.attached.splice(index, 1);
      player.discard.push({ kind: "energy", energy: effect.energy });
      const amount = Math.min(fighter.damage, effect.amount);
      fighter.damage -= amount;
      fighter.abilityUsedTurn = next.turnNumber;
      next.events.push({ kind: "abilityUsed", player: player.id, uid: fighter.uid, name: ability.name });
      next.events.push({ kind: "energyDiscarded", player: player.id, energy: effect.energy });
      next.events.push({ kind: "healed", player: player.id, uid: fighter.uid, amount });
      next.log.push(`${player.id}'s ${fighter.card.name} used ${ability.name}: discarded 1 ${effect.energy} Energy and healed ${amount} HP.`);
      return next;
    }
    case "evolve": {
      const next = cloneState(state);
      const player = next.players[next.turnPlayer];
      const fighter = fightersInPlay(player).find((c) => c.uid === move.targetUid)!;
      const card = player.hand[move.handIndex]!;
      if (!isFighterCard(card)) throw new Error("Only fighters can evolve.");
      fighter.previousStages = [...(fighter.previousStages ?? []), fighter.card];
      fighter.card = card;
      fighter.evolvedTurn = next.turnNumber;
      fighter.damageReduction = 0;
      fighter.damageVulnerability = undefined;
      fighter.paralyzed = false;
      fighter.burned = false;
      fighter.retreatCostIncrease = 0;
      player.hand.splice(move.handIndex, 1);
      next.events.push({ kind: "evolved", player: player.id, uid: fighter.uid, name: card.name });
      next.log.push(`${player.id} evolved into ${card.name}.`);
      return next;
    }
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
      return applyAttack(state, move.attackId, move.targetUid);
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
  attachZoneEnergyOnBecomingActive(next, player);
  next.phase = { kind: "main" };
  // Both actives can be knocked out in the same checkup. Resolve each promotion
  // before continuing the turn that has already begun.
  for (const id of [next.turnPlayer, opponentOf(next.turnPlayer)]) {
    if (!next.players[id].active && next.players[id].bench.length) {
      next.phase = { kind: "awaitPromotion", player: id };
      break;
    }
  }
  return next;
}

function applyAttachEnergy(state: BattleState, targetUid: string): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const target = fightersInPlay(player).find((c) => c.uid === targetUid)!;
  target.attached.push(player.pendingEnergy!);
  next.log.push(`${player.id} attached ${player.pendingEnergy} energy to ${target.card.name}.`);
  next.events.push({
    kind: "energyAttached",
    player: player.id,
    targetUid: target.uid,
    energy: player.pendingEnergy!,
  });
  const ability = target.card.ability;
  if (ability?.effect?.kind === "burnBothActivesOnEnergyAttachment" && player.pendingEnergy === ability.effect.energy) {
    for (const id of [player.id, opponentOf(player.id)]) {
      const active = next.players[id].active;
      if (active) active.burned = true;
    }
    next.events.push({ kind: "abilityUsed", player: player.id, uid: target.uid, name: ability.name });
    next.log.push(`${target.card.name}'s ${ability.name} Burned both active fighters.`);
  }
  player.pendingEnergy = null;
  player.hasAttachedEnergy = true;
  return next;
}

function applyPlayBasic(state: BattleState, handIndex: number): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const card = player.hand[handIndex]!;
  if (!isFighterCard(card)) throw new Error("Only fighters can be benched.");
  player.hand = player.hand.filter((_, i) => i !== handIndex);
  const benched = toInPlay(card);
  benched.enteredTurn = next.turnNumber;
  player.bench.push(benched);
  next.log.push(`${player.id} benched ${card.name}.`);
  next.events.push({ kind: "fighterBenched", player: player.id, uid: benched.uid });
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
  active.damageReduction = 0;
  active.damageVulnerability = undefined;
  active.paralyzed = false;
  active.cannotRetreat = false;
  active.burned = false;
  active.bleeding = false;
  active.retreatCostIncrease = 0;
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
  attachZoneEnergyOnBecomingActive(next, player);
  return next;
}

/** Resolve the incoming fighter's passive ability using its owner's available zone energy. */
function attachZoneEnergyOnBecomingActive(state: BattleState, player: PlayerState): void {
  const incoming = player.active!;
  const ability = incoming.card.ability;
  if (ability?.effect?.kind !== "attachZoneEnergyOnBecomingActive" || !player.pendingEnergy) return;
  const energy = player.pendingEnergy;
  incoming.attached.push(energy);
  player.pendingEnergy = null;
  state.events.push({ kind: "abilityUsed", player: player.id, uid: incoming.uid, name: ability.name });
  state.events.push({ kind: "energyAttached", player: player.id, targetUid: incoming.uid, energy });
  state.log.push(`${incoming.card.name}'s ${ability.name} attached 1 ${energy} Energy from the energy zone.`);
}

function switchActiveFromBench(state: BattleState, player: PlayerState, targetUid?: string): void {
  const benchIndex = player.bench.findIndex(fighter => fighter.uid === targetUid);
  if (benchIndex < 0) return; // An empty bench does not prevent the attack's damage.
  const outgoing = player.active!;
  const incoming = player.bench[benchIndex]!;
  outgoing.damageReduction = 0;
  outgoing.damageVulnerability = undefined;
  outgoing.paralyzed = false;
  outgoing.cannotRetreat = false;
  outgoing.burned = false;
  outgoing.bleeding = false;
  outgoing.retreatCostIncrease = 0;
  player.bench[benchIndex] = outgoing;
  player.active = incoming;
  state.events.push({ kind: "switched", player: player.id, outUid: outgoing.uid, inUid: incoming.uid });
  state.log.push(`${player.id} switched ${outgoing.card.name} to the bench; ${incoming.card.name} is now active.`);
  attachZoneEnergyOnBecomingActive(state, player);
}

function applyTrainer(state: BattleState, move: Extract<Move, { type: "playTrainer" }>): BattleState {
  const next = cloneState(state);
  const player = next.players[next.turnPlayer];
  const card = player.hand[move.handIndex]!;
  if (isFighterCard(card)) throw new Error("Expected an item or supporter.");
  player.hand.splice(move.handIndex, 1);
  player.discard.push({ kind: "trainer", card });
  if (card.kind === "supporter") player.hasPlayedSupporter = true;
  next.events.push({ kind: "trainerPlayed", player: player.id, card });
  next.log.push(`${player.id} played ${card.name}.`);
  switch (card.effect.kind) {
    case "searchNamedFighterToTop": {
      const index = player.deck.findIndex(candidate => candidate.id === move.cardId);
      const chosen = player.deck.splice(index, 1)[0]!;
      player.deck.unshift(chosen);
      next.log.push(`${player.id} put ${chosen.name} on top of their deck.`);
      break;
    }
    case "switchDamagedOpponentBench":
      switchActiveFromBench(next, next.players[opponentOf(player.id)], move.targetUid);
      break;
    case "boostActiveAttackDamage":
      player.attackDamageBonus = (player.attackDamageBonus ?? 0) + card.effect.amount;
      next.events.push({ kind: "attackDamageBoosted", player: player.id, amount: card.effect.amount });
      next.log.push(`${player.id}'s attacks deal ${card.effect.amount} more damage to the opponent's active fighter this turn.`);
      break;
    case "searchRandomBasic": {
      const eligible = player.deck.flatMap((card, index) => isFighterCard(card) && card.stage === "basic" ? [index] : []);
      const roll = nextInt(next.rngState, eligible.length);
      const drawn = player.deck.splice(eligible[roll.value]!, 1)[0]!;
      player.hand.push(drawn);
      next.events.push({ kind: "cardDrawn", player: player.id });
      const shuffled = shuffle(roll.state, player.deck);
      player.deck = shuffled.value;
      next.rngState = shuffled.state;
      next.events.push({ kind: "deckShuffled", player: player.id });
      next.log.push(`${player.id} added ${drawn.name} to their hand and shuffled their deck.`);
      break;
    }
    case "heal": {
      const target = fightersInPlay(player).find((fighter) => fighter.uid === move.targetUid)!;
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
      next.log.push(`${player.id}'s active fighter has ${card.effect.amount} less retreat cost this turn.`);
      break;
  }
  return next;
}

function applyAttack(state: BattleState, attackId: string, targetUid?: string): BattleState {
  const next = cloneState(state);
  const attackerId = next.turnPlayer;
  const defenderId = opponentOf(attackerId);
  const attacker = next.players[attackerId];
  const defender = next.players[defenderId];
  const attackingFighter = attacker.active!;
  const defendingFighter = defender.active!;
  const attack = getAvailableAttacks(attackingFighter, attacker.bench).find((a) => a.id === attackId)!;
  attacker.attacksUsedThisTurn = (attacker.attacksUsedThisTurn ?? 0) + 1;
  const continues = attackingFighter.card.ability?.effect?.kind === "attackTwice" && attacker.attacksUsedThisTurn < 2;
  const finish = () => {
    if (!continues) return endTurn(next);
    if (!defender.active) next.phase = { kind: "awaitPromotion", player: defenderId };
    return next;
  };
  const benchEffect = attack.effects?.find(effect => effect.kind === "benchDamage");
  const targetedEffect = attack.effects?.find(effect => effect.kind === "damageAnyFighter");
  if (attack.effects?.some(effect => effect.kind === "coinAttackFailsOnTails")) {
    const roll = nextFloat(next.rngState);
    next.rngState = roll.state;
    const heads = roll.value < 0.5;
    next.events.push({ kind: "coinFlipped", player: attackerId, result: heads ? "heads" : "tails", flip: 1, bonus: 0, attackName: attack.name });
    if (!heads) {
      next.events.push({ kind: "attackUsed", player: attackerId, attackerUid: attackingFighter.uid, attackId, targetUid: targetUid ?? defendingFighter.uid });
      next.log.push(`${attackingFighter.card.name} used ${attack.name}, but tails made the attack do nothing.`);
      return finish();
    }
  }
  if (attack.effects?.some(effect => effect.kind === "discardAllSelfEnergy")) {
    for (const energy of attackingFighter.attached.splice(0)) {
      attacker.discard.push({ kind: "energy", energy });
      next.events.push({ kind: "energyDiscarded", player: attackerId, energy });
    }
    next.log.push(`${attackingFighter.card.name} discarded all attached energy.`);
  }
  if (benchEffect?.kind === "benchDamage" || (targetedEffect?.kind === "damageAnyFighter" && targetUid !== defendingFighter.uid)) {
    const amount = benchEffect?.kind === "benchDamage" ? benchEffect.amount : targetedEffect!.amount;
    let target = targetUid ? defender.bench.find(fighter => fighter.uid === targetUid) : undefined;
    if (!target && benchEffect && defender.bench.length) {
      const roll = nextInt(next.rngState, defender.bench.length);
      next.rngState = roll.state;
      target = defender.bench[roll.value]!;
    }
    next.events.push({ kind: "attackUsed", player: attackerId, attackerUid: attackingFighter.uid, attackId, targetUid: target?.uid ?? defendingFighter.uid });
    if (!target) {
      next.log.push(`${attackingFighter.card.name} used ${attack.name}, but the opponent's bench is empty.`);
      return finish();
    }
    // Bench damage is fixed; weakness and active-fighter damage modifiers do not apply.
    target.damage += amount;
    next.log.push(`${attackingFighter.card.name} used ${attack.name} for ${amount} damage to benched ${target.card.name}.`);
    next.events.push({ kind: "damageDealt", player: defenderId, uid: target.uid, amount, weakness: false });
    if (isKnockedOut(target)) {
      const points = pointsForKo(target);
      attacker.points += points;
      next.events.push({ kind: "knockedOut", player: defenderId, fighter: { ...target, attached: target.attached.slice() }, pointsAwarded: points, fromBench: true });
      next.log.push(`${target.card.name} was knocked out. ${attackerId} +${points} point(s).`);
      defender.discard.push({ kind: "fighter", card: target.card });
      for (const card of target.previousStages ?? []) defender.discard.push({ kind: "fighter", card });
      for (const energy of target.attached) defender.discard.push({ kind: "energy", energy });
      defender.bench = defender.bench.filter(fighter => fighter.uid !== target.uid);
      if (attacker.points >= POINTS_TO_WIN) {
        next.winner = attackerId;
        next.events.push({ kind: "gameWon", player: attackerId, reason: "points" });
        next.log.push(`${attackerId} wins with ${attacker.points} points!`);
        return next;
      }
    }
    return finish();
  }


  let randomBonus = 0;
  for (const effect of attack.effects ?? []) {
    if (effect.kind === "reduceIncomingDamage") {
      attackingFighter.damageReduction = effect.amount;
      next.events.push({ kind: "damageReductionApplied", player: attackerId, uid: attackingFighter.uid, amount: effect.amount });
      next.log.push(`${attackingFighter.card.name} will take ${effect.amount} less attack damage next turn.`);
    }
    if (effect.kind !== "flipUntilTails" && effect.kind !== "coinDamageBonus" && effect.kind !== "coinDamagePerHeads") continue;
    let flip = 0;
    let bonus = 0;
    let heads: boolean;
    do {
      const roll = nextFloat(next.rngState);
      next.rngState = roll.state;
      heads = roll.value < 0.5;
      if (heads) bonus += effect.amount;
      next.events.push({ kind: "coinFlipped", player: attackerId, result: heads ? "heads" : "tails", flip: ++flip, bonus, attackName: attack.name });
      next.log.push(`${attackerId} flipped ${heads ? "heads" : "tails"} (+${bonus} damage).`);
    } while ((heads && effect.kind === "flipUntilTails") || (effect.kind === "coinDamagePerHeads" && flip < effect.coins));
    randomBonus += bonus;
  }
  const damage = computeDamage(attackingFighter, defendingFighter, attack, randomBonus, attacker.bench, attacker.attackDamageBonus ?? 0, defender.points > attacker.points);
  defendingFighter.damage += damage;
  next.log.push(
    `${attacker.id}'s ${attackingFighter.card.name} used ${attack.name} for ${damage} damage.`
  );
  next.events.push({
    kind: "attackUsed",
    player: attackerId,
    attackerUid: attackingFighter.uid,
    attackId,
    targetUid: defendingFighter.uid,
  });
  next.events.push({
    kind: "damageDealt",
    player: defenderId,
    uid: defendingFighter.uid,
    amount: damage,
    weakness: isWeakTo(attackingFighter, defendingFighter, attack),
  });

  for (const effect of attack.effects ?? []) {
    if (effect.kind === "discardSelfEnergy") {
      if (effect.unlessBenchCardId && attacker.bench.some(fighter => fighter.card.id === effect.unlessBenchCardId)) continue;
      for (const energy of attackingFighter.attached.splice(0, effect.amount)) {
        attacker.discard.push({ kind: "energy", energy });
        next.events.push({ kind: "energyDiscarded", player: attackerId, energy });
        next.log.push(`${attackingFighter.card.name} discarded 1 ${energy} Energy.`);
      }
    }
    if (effect.kind === "preventRetreat") {
      defendingFighter.cannotRetreat = true;
      next.log.push(`${defendingFighter.card.name} can't retreat during its next turn.`);
    }
    if (effect.kind === "coinBleed") {
      const roll = nextFloat(next.rngState);
      next.rngState = roll.state;
      const heads = roll.value < 0.5;
      next.events.push({ kind: "coinFlipped", player: attackerId, result: heads ? "heads" : "tails", flip: 1, bonus: 0, attackName: attack.name, reason: "bleeding" });
      if (heads && !isKnockedOut(defendingFighter)) defendingFighter.bleeding = true;
      next.log.push(`${attack.name}: ${heads ? "heads, the opponent is Bleeding" : "tails"}.`);
    }
  }
  if (!isKnockedOut(defendingFighter)) {
    for (const effect of attack.effects ?? []) {
      if (effect.kind === "increaseIncomingDamage") {
        defendingFighter.damageVulnerability = { amount: effect.amount, expiresAfterTurn: next.turnNumber + 2 };
        next.events.push({ kind: "damageVulnerabilityApplied", player: defenderId, uid: defendingFighter.uid, amount: effect.amount });
        next.log.push(`${defendingFighter.card.name} takes ${effect.amount} more attack damage during ${attackerId}'s next turn.`);
      }
      if (effect.kind === "burn") {
        defendingFighter.burned = true;
        next.log.push(`${defendingFighter.card.name} is Burned.`);
      }
      if (effect.kind === "increaseRetreatCost") {
        defendingFighter.retreatCostIncrease = (defendingFighter.retreatCostIncrease ?? 0) + effect.amount;
        next.log.push(`${defendingFighter.card.name}'s retreat cost increases by ${effect.amount} Energy for its next turn.`);
      }
      if (effect.kind === "paralyzeAtOrBelowHp" && defendingFighter.card.hp - defendingFighter.damage <= effect.hp) {
        defendingFighter.paralyzed = true;
        next.log.push(`${defendingFighter.card.name} is Paralyzed and cannot attack or retreat during its next turn.`);
      }
    }
  }

  if (attack.effects?.some(effect => effect.kind === "switchWithBench")) switchActiveFromBench(next, attacker, targetUid);

  if (isKnockedOut(defendingFighter)) {
    const points = pointsForKo(defendingFighter);
    attacker.points += points;
    next.log.push(
      `${defender.id}'s ${defendingFighter.card.name} was knocked out. ${attacker.id} +${points} point(s).`
    );
    // Snapshot (post-hit) so the UI can keep showing it while the KO animates.
    next.events.push({
      kind: "knockedOut",
      player: defenderId,
      fighter: { ...defendingFighter, attached: defendingFighter.attached.slice() },
      pointsAwarded: points,
    });
    // Move the KO'd fighter and its attached energy to the owner's discard pile.
    defender.discard.push({ kind: "fighter", card: defendingFighter.card });
    for (const card of defendingFighter.previousStages ?? []) defender.discard.push({ kind: "fighter", card });
    for (const energy of defendingFighter.attached) {
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
      // Defender cannot field an active fighter -> loss.
      next.winner = attackerId;
      next.log.push(`${defenderId} has no fighters left. ${attackerId} wins!`);
      next.events.push({ kind: "gameWon", player: attackerId, reason: "noFighters" });
      return next;
    }

    // Defender must promote before play continues.
    return finish();
  }

  // No KO: attacking ends the turn normally.
  return finish();
}
