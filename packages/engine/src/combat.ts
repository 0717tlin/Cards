// Combat helpers: energy-cost satisfaction and damage calculation.

import type { AttackDef, FighterInPlay, EnergyType, FighterCard } from "./types.js";
import { WEAKNESS_BONUS } from "./types.js";

export function matchesNamedNonEx(card: FighterCard, names: readonly string[]): boolean {
  return !card.isEx && names.includes(card.name);
}

/** Hatake borrows attacks, but the active fighter supplies energy, type, and abilities. */
export function getAvailableAttacks(fighter: FighterInPlay, bench: readonly FighterInPlay[] = []): AttackDef[] {
  const attacks = fighter.card.ability?.effect?.kind === "useNonExBenchAttacks"
    ? [...fighter.card.attacks, ...bench.filter(source => source.uid !== fighter.uid && !source.card.isEx).flatMap(source => source.card.attacks)]
    : fighter.card.attacks;
  const discounted = [fighter, ...bench].some(source => {
    const effect = source.card.ability?.effect;
    return effect?.kind === "reduceNamedAttackCost" && matchesNamedNonEx(fighter.card, effect.names);
  });
  return [...new Map(attacks.map(attack => {
    const index = discounted ? attack.cost.indexOf("colorless") : -1;
    const adjusted = index >= 0 ? { ...attack, cost: attack.cost.filter((_, i) => i !== index) } : attack;
    return [adjusted.id, adjusted] as const;
  })).values()];
}

/**
 * Returns true if `attached` energy satisfies the attack `cost`.
 * Specific (non-colorless) requirements must be matched by that exact type;
 * remaining "colorless" requirements may be paid by any leftover energy.
 */
export function canPayCost(attached: readonly EnergyType[], cost: readonly EnergyType[]): boolean {
  const pool = attached.slice();
  let colorlessNeeded = 0;

  for (const required of cost) {
    if (required === "colorless") {
      colorlessNeeded++;
      continue;
    }
    const idx = pool.indexOf(required);
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }

  return pool.length >= colorlessNeeded;
}

/** True if the defender is weak to the attacker's type. */
export function isWeakTo(attacker: FighterInPlay, defender: FighterInPlay, attack?: AttackDef): boolean {
  return defender.card.weakness === attacker.card.type && !attack?.effects?.some(effect => effect.kind === "ignoreWeakness");
}

/** Damage including weakness; random effects use expected damage for AI evaluation.
 * applyAttack replaces that expectation with seeded coin-flip results. */
export function computeDamage(
  attacker: FighterInPlay,
  defender: FighterInPlay,
  attack: AttackDef,
  randomBonus?: number,
  bench: readonly FighterInPlay[] = [],
  turnDamageBonus = 0,
  opponentHasMorePoints = false
): number {

  const effectDamage = (attack.effects ?? []).reduce((bonus, effect) => {
    switch (effect.kind) {
      case "damageAnyFighter":
        return bonus + effect.amount;
      case "damagePerAttachedEnergy":
        return bonus + attacker.attached.filter((energy) => energy === effect.energy).length * effect.amount;
      case "flipUntilTails":
        // Expected heads before tails is one; AI evaluates the expected bonus.
        return bonus + (randomBonus === undefined ? effect.amount : 0);
      case "coinDamagePerHeads":
        return bonus + (randomBonus === undefined ? effect.coins * effect.amount / 2 : 0);
      case "damagedOpponentBonus":
        return bonus + (defender.damage > 0 ? effect.amount : 0);
      case "coinDamageBonus":
        return bonus + (randomBonus === undefined ? effect.amount / 2 : 0);
      case "benchDamageBonus":
        return bonus + (bench.some(fighter => fighter.card.id === effect.cardId) ? effect.amount : 0);
      case "coinBleed":
      case "coinAttackFailsOnTails":
      case "ignoreWeakness":
      case "preventRetreat":
      case "discardSelfEnergy":
      case "discardAllSelfEnergy":
      case "increaseIncomingDamage":
      case "burn":
      case "benchDamage":
      case "switchWithBench":
      case "increaseRetreatCost":
      case "paralyzeAtOrBelowHp":
      case "reduceIncomingDamage":
        return bonus;
    }
  }, 0);
  const attackDamage = attack.damage + effectDamage + (randomBonus ?? 0);
  const ability = attacker.card.ability?.effect;
  const abilityBonus = opponentHasMorePoints && ability?.kind === "damageBonusWhenBehindOnPoints" ? ability.amount : 0;
  const weaknessBonus = attackDamage > 0 && isWeakTo(attacker, defender, attack) ? WEAKNESS_BONUS : 0;
  const damage = Math.max(0, attackDamage + (attackDamage > 0 ? turnDamageBonus + abilityBonus + (defender.damageVulnerability?.amount ?? 0) : 0) + weaknessBonus - (defender.damageReduction ?? 0));
  return randomBonus === undefined && attack.effects?.some(effect => effect.kind === "coinAttackFailsOnTails") ? damage / 2 : damage;
}

/** True if the fighter's accumulated damage meets or exceeds its HP. */
export function isKnockedOut(fighter: FighterInPlay): boolean {
  return fighter.damage >= fighter.card.hp;
}

/** Points awarded for knocking out the given fighter. */
export function pointsForKo(fighter: FighterInPlay): number {
  return fighter.card.isEx ? 2 : 1;
}
