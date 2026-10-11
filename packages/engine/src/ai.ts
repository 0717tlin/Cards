// Bounded turn planning using legal moves and public board information.
// Forecasts use fixed RNG samples, never the live seed or hidden opposing cards.
import type { AttackDef, BattleState, FighterInPlay, Move, PlayerId, PlayerState } from "./types.js";
import { isFighterCard, opponentOf } from "./types.js";
import { actingPlayer, applyMove, getLegalMoves } from "./moves.js";
import { canPayCost, computeDamage, getAvailableAttacks, pointsForKo } from "./combat.js";
import { cloneState } from "./turn.js";

const WIN_SCORE = 100_000;
const BEAM_WIDTH = 8;
const PLAN_DEPTH = 4;
// Stratified samples of the first flip: four heads and four tails.
const FORECAST_SEEDS = [1957, 1695, 3568, 631, 2550, 685, 1781, 3017];
interface PlanNode { state: BattleState; first: Move; cost: number; priority: number }
interface Choice { move: Move; score: number }

export function chooseMove(state: BattleState): Move {
  const legal = getLegalMoves(state);
  if (!legal.length) throw new Error("chooseMove called with no legal moves.");
  const owner = actingPlayer(state);
  // Planning must not allocate real fighter instance IDs or consume battle RNG.
  const root = cloneState(state);
  root.events = [];
  root.log = [];
  root.rngState = 0;
  if (root.phase.kind === "awaitPromotion") return choosePromotion(root, owner, legal);

  let best = bestFinish(root, owner);
  const baselineScore = best.score;
  // Take a certain victory immediately instead of spending cards on preparation.
  if (best.score >= WIN_SCORE - 1) return best.move;
  for (const move of legal) {
    const gain = informationGain(root, owner, move);
    if (gain > 0 && best.score < WIN_SCORE / 2) {
      const score = baselineScore + gain;
      if (score > best.score) best = { move, score };
    }
  }

  let frontier: { state: BattleState; first?: Move; cost: number }[] = [{ state: root, cost: 0 }];
  const seen = new Map<string, number>();
  for (let depth = 0; depth < PLAN_DEPTH; depth++) {
    const candidates: PlanNode[] = [];
    for (const node of frontier) {
      for (const move of getLegalMoves(node.state)) {
        if (!isPreparation(node.state, owner, move)) continue;
        const projected = projectPreparation(node.state, owner, move);
        const cost = node.cost + (move.type === "playTrainer" ? 2 : 0.8);
        const key = positionKey(projected, owner);
        if ((seen.get(key) ?? Infinity) <= cost) continue;
        seen.set(key, cost);
        candidates.push({ state: projected, first: node.first ?? move, cost, priority: boardScore(projected, owner) - cost });
      }
    }
    candidates.sort((a, b) => b.priority - a.priority);
    const beam = candidates.slice(0, BEAM_WIDTH);
    for (const node of beam) {
      const result = bestFinish(node.state, owner);
      const score = result.score - node.cost;
      if (score > best.score + 0.01) best = { move: node.first, score };
    }
    frontier = beam;
    if (!frontier.length) break;
  }
  return best.move;
}

function isPreparation(state: BattleState, owner: PlayerId, move: Move): boolean {
  switch (move.type) {
    case "attachEnergy": case "evolve": case "retreat": case "playBasic": return true;
    case "playTrainer": {
      const card = state.players[owner].hand[move.handIndex]!;
      return !isFighterCard(card) && card.effect.kind !== "draw" && card.effect.kind !== "searchRandomBasic" && card.effect.kind !== "searchNamedFighterToTop";
    }
    case "useAbility":
      return ownFighters(state.players[owner]).find(f => f.uid === move.targetUid)?.card.ability?.effect?.kind === "discardEnergyToHeal";
    default: return false;
  }
}

function projectPreparation(state: BattleState, owner: PlayerId, move: Move): BattleState {
  if (move.type !== "playBasic") return applyMove(state, move);
  // A preview instance is local to this search; toInPlay would advance a global ID counter.
  const next = cloneState(state);
  const player = next.players[owner];
  const card = player.hand.splice(move.handIndex, 1)[0]!;
  if (!isFighterCard(card)) throw new Error("Only fighters can be benched.");
  player.bench.push({ uid: `preview-${owner}-${player.bench.length}-${move.handIndex}`, card, damage: 0, attached: [], enteredTurn: next.turnNumber });
  return next;
}

function bestFinish(state: BattleState, owner: PlayerId): Choice {
  let best: Choice = { move: { type: "pass" }, score: forecastMove(state, owner, { type: "pass" }, 2) };
  for (const move of getLegalMoves(state)) {
    if (move.type !== "attack") continue;
    const score = forecastMove(state, owner, move, 2);
    // Prefer an attack to passing when they produce equivalent positions.
    if (score > best.score + 0.001 || (best.move.type === "pass" && score >= best.score - 0.001)) best = { move, score };
  }
  return best;
}

function forecastMove(state: BattleState, owner: PlayerId, move: Move, attacksLeft: number): number {
  const attack = move.type === "attack" ? getAvailableAttacks(state.players[owner].active!, state.players[owner].bench).find(a => a.id === move.attackId) : undefined;
  const random = attack?.effects?.some(e => ["coinDamageBonus", "coinDamagePerHeads", "flipUntilTails", "coinBleed", "coinAttackFailsOnTails"].includes(e.kind)
    || (e.kind === "benchDamage" && move.type === "attack" && !move.targetUid))
    || state.players.P1.active?.burned || state.players.P2.active?.burned;
  const seeds = random ? FORECAST_SEEDS : [0];
  let total = 0;
  for (const seed of seeds) {
    let next = applyMove({ ...state, rngState: seed }, move);
    // The opponent must promote between Joshua's attacks; assume their best replacement.
    while (!next.winner && next.phase.kind === "awaitPromotion") {
      const promoter = next.phase.player;
      next = applyMove(next, choosePromotion(next, promoter, getLegalMoves(next)));
    }
    let score = boardScore(next, owner);
    if (!next.winner && next.turnPlayer === owner && next.phase.kind === "main" && attacksLeft > 1) {
      score = forecastMove(next, owner, { type: "pass" }, 1);
      for (const second of getLegalMoves(next)) {
        if (second.type === "attack") score = Math.max(score, forecastMove(next, owner, second, attacksLeft - 1));
      }
    }
    total += score;
  }
  return total / seeds.length;
}

function choosePromotion(state: BattleState, owner: PlayerId, moves: Move[]): Move {
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = boardScore(applyMove(state, move), owner);
    if (score > bestScore) { best = move; bestScore = score; }
  }
  return best;
}

function ownFighters(player: PlayerState): FighterInPlay[] {
  return player.active ? [player.active, ...player.bench] : player.bench;
}

function missingEnergy(fighter: FighterInPlay, attack: AttackDef): number {
  const pool = fighter.attached.slice();
  let missing = 0;
  let generic = 0;
  for (const type of attack.cost) {
    if (type === "colorless") { generic++; continue; }
    const index = pool.indexOf(type);
    if (index < 0) missing++;
    else pool.splice(index, 1);
  }
  return missing + Math.max(0, generic - pool.length);
}

function attackPotential(fighter: FighterInPlay, defender: FighterInPlay | null, attack: AttackDef, player: PlayerState, opponentPoints: number): number {
  const benchEffect = attack.effects?.find(e => e.kind === "benchDamage");
  if (benchEffect?.kind === "benchDamage") return benchEffect.amount;
  const damage = defender ? computeDamage(fighter, defender, attack, undefined, player.bench, player.attackDamageBonus ?? 0, opponentPoints > player.points) : attack.damage;
  return damage + (attack.effects?.some(e => e.kind === "burn") ? 20 : 0)
    + (attack.effects?.some(e => e.kind === "increaseIncomingDamage") ? 20 : 0)
    + (attack.effects?.some(e => e.kind === "coinBleed") ? 5 : 0);
}

function developmentValue(fighter: FighterInPlay, player: PlayerState, defender: FighterInPlay | null, opponentPoints: number): number {
  const zoneTypes = player.energyTypes?.length ? player.energyTypes : [player.energyType];
  return Math.max(0, ...getAvailableAttacks(fighter, player.bench).map(attack => {
    const missing = missingEnergy(fighter, attack);
    const impossible = attack.cost.some(type => type !== "colorless" && !zoneTypes.includes(type)
      && attack.cost.filter(cost => cost === type).length > fighter.attached.filter(attached => attached === type).length);
    return attackPotential(fighter, defender, attack, player, opponentPoints) / (1 + missing * missing) * (impossible ? 0.1 : 1);
  }));
}

/** Public opposing energy zones and board cards are fair information; hands and deck order are not. */
function counterDamage(opponent: PlayerState, defender: FighterInPlay, defenderPoints: number): number {
  const fighter = opponent.active;
  if (!fighter || fighter.paralyzed) return 0;
  const energyTypes = opponent.energyTypes?.length ? opponent.energyTypes : [opponent.energyType];
  let total = 0;
  for (const energy of energyTypes) {
    const charged = { ...fighter, attached: [...fighter.attached, energy] };
    let best = 0;
    for (const attack of getAvailableAttacks(charged, opponent.bench)) {
      if (canPayCost(charged.attached, attack.cost)) {
        const benchAttack = attack.effects?.some(e => e.kind === "benchDamage");
        const damage = benchAttack ? 0 : computeDamage(charged, defender, attack, undefined, opponent.bench, opponent.attackDamageBonus ?? 0, defenderPoints > opponent.points);
        best = Math.max(best, damage + (attack.effects?.some(e => e.kind === "burn") ? 20 : 0));
      }
    }
    // Relentless Pressure can follow a kick with a cheaper attack after discarding energy.
    if (charged.card.ability?.effect?.kind === "attackTwice") {
      let combo = best;
      for (const first of getAvailableAttacks(charged, opponent.bench)) {
        if (!canPayCost(charged.attached, first.cost)) continue;
        const discard = first.effects?.find(e => e.kind === "discardSelfEnergy" && (!e.unlessBenchCardId || !opponent.bench.some(fighter => fighter.card.id === e.unlessBenchCardId)));
        const remaining = { ...charged, attached: charged.attached.slice(discard?.kind === "discardSelfEnergy" ? discard.amount : 0) };
        const firstDamage = computeDamage(charged, defender, first, undefined, opponent.bench, opponent.attackDamageBonus ?? 0, defenderPoints > opponent.points);
        for (const second of getAvailableAttacks(charged, opponent.bench)) {
          if (canPayCost(remaining.attached, second.cost)) combo = Math.max(combo, firstDamage + computeDamage(remaining, defender, second, undefined, opponent.bench, opponent.attackDamageBonus ?? 0, defenderPoints > opponent.points));
        }
      }
      best = combo;
    }
    total += best;
  }
  return total / energyTypes.length;
}

function boardScore(state: BattleState, owner: PlayerId): number {
  if (state.winner) return state.winner === owner ? WIN_SCORE : -WIN_SCORE;
  const player = state.players[owner];
  const enemy = state.players[opponentOf(owner)];
  let score = player.points * 1100 - enemy.points * 1150 + player.hand.length * 3;
  score += (enemy.active?.damageVulnerability?.amount ?? 0) * 0.5;
  score -= (player.active?.damageVulnerability?.amount ?? 0) * 0.5;
  for (const fighter of ownFighters(player)) {
    const hp = Math.max(0, fighter.card.hp - fighter.damage);
    score += hp * 0.16 + developmentValue(fighter, player, enemy.active, enemy.points) * 0.35;
    // Spare retreat energy has some value, but endless charging does not.
    const usefulEnergy = Math.max(fighter.card.retreatCost, ...getAvailableAttacks(fighter, player.bench).map(a => a.cost.length)) + 1;
    score += Math.min(fighter.attached.length, usefulEnergy) * 0.4;
    if (fighter.bleeding) score -= 8;
    if (fighter.burned) score -= 12;
  }
  for (const fighter of ownFighters(enemy)) score -= Math.max(0, fighter.card.hp - fighter.damage) * (fighter === enemy.active ? 0.75 : 0.12);
  if (player.active) {
    const active = player.active;
    score += Math.max(0, active.card.hp - active.damage) * 0.1;
    const readyDamage = active.paralyzed ? 0 : Math.max(0, ...getAvailableAttacks(active, player.bench).filter(a => canPayCost(active.attached, a.cost)).map(a => attackPotential(active, enemy.active, a, player, enemy.points)));
    score += readyDamage * 0.55;
    const incoming = counterDamage(enemy, active, player.points);
    score -= incoming * 0.25;
    if (incoming >= active.card.hp - active.damage) {
      score -= enemy.points + pointsForKo(active) >= 3 || player.bench.length === 0 ? 9000 : pointsForKo(active) * 600;
    }
  }
  return score;
}

/** Draw/search decisions are valued without consulting unknown top cards or random outcomes. */
function informationGain(state: BattleState, owner: PlayerId, move: Move): number {
  const player = state.players[owner];
  if (move.type === "playTrainer") {
    const card = player.hand[move.handIndex]!;
    if (isFighterCard(card)) return 0;
    if (card.effect.kind === "draw") return Math.min(card.effect.count, player.deck.length) * 5;
    if (card.effect.kind === "searchRandomBasic") return 6 + (player.bench.length === 0 ? 4 : 0);
    if (card.effect.kind === "searchNamedFighterToTop") return 4;
  }
  if (move.type === "useAbility") {
    const fighter = ownFighters(player).find(f => f.uid === move.targetUid)!;
    const effect = fighter.card.ability?.effect;
    if (effect?.kind === "peekOpponentDeck") return 0.5;
    if (effect?.kind === "searchDeckToTop" && move.cardId) {
      if (player.hand.some(card => card.id === move.cardId)
        || ownFighters(player).some(f => f.card.ability?.effect?.kind === "searchDeckToTop" && f.abilityUsedTurn === state.turnNumber)) return 0;
      // Deck contents are known to their owner, but their order is not evaluated.
      const card = player.deck.find(card => card.id === move.cardId);
      if (card && isFighterCard(card)) {
        const prospect: FighterInPlay = { uid: "search-preview", card, damage: 0, attached: [] };
        return 12 + developmentValue(prospect, player, state.players[opponentOf(owner)].active, state.players[opponentOf(owner)].points) * 0.1;
      }
    }
  }
  return 0;
}

function positionKey(state: BattleState, owner: PlayerId): string {
  // Only our hand and public board data belong in search keys.
  const player = state.players[owner];
  const enemy = state.players[opponentOf(owner)];
  return JSON.stringify([
    player.active, player.bench, player.hand.map(card => card.id), player.pendingEnergy,
    player.hasAttachedEnergy, player.hasRetreated, player.hasPlayedSupporter,
    player.retreatReduction, player.attackDamageBonus, player.attacksUsedThisTurn, player.points,
    enemy.active, enemy.bench, enemy.points, state.phase,
  ]);
}
