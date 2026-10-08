// Combat helpers: energy-cost satisfaction and damage calculation.

import type { AttackDef, FighterInPlay, EnergyType } from "./types.js";
import { WEAKNESS_BONUS } from "./types.js";

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
export function isWeakTo(attacker: FighterInPlay, defender: FighterInPlay): boolean {
  return defender.card.weakness === attacker.card.type;
}

/** Damage including weakness; random effects use expected damage for AI evaluation.
 * applyAttack replaces that expectation with seeded coin-flip results. */
export function computeDamage(
  attacker: FighterInPlay,
  defender: FighterInPlay,
  attack: AttackDef,
  randomBonus?: number,
  bench: readonly FighterInPlay[] = []
): number {
  const weaknessBonus = attack.damage > 0 && isWeakTo(attacker, defender) ? WEAKNESS_BONUS : 0;
  const effectDamage = (attack.effects ?? []).reduce((bonus, effect) => {
    switch (effect.kind) {
      case "damagePerAttachedEnergy":
        return bonus + attacker.attached.filter((energy) => energy === effect.energy).length * effect.amount;
      case "flipUntilTails":
        // Expected heads before tails is one; AI evaluates the expected bonus.
        return bonus + (randomBonus === undefined ? effect.amount : 0);
      case "coinDamageBonus":
        return bonus + (randomBonus === undefined ? effect.amount / 2 : 0);
      case "benchDamageBonus":
        return bonus + (bench.some(fighter => fighter.card.id === effect.cardId) ? effect.amount : 0);
      case "burn":
      case "benchDamage":
      case "increaseRetreatCost":
      case "paralyzeAtOrBelowHp":
      case "reduceIncomingDamage":
        return bonus;
    }
  }, 0);
  return Math.max(0, attack.damage + effectDamage + (randomBonus ?? 0) + weaknessBonus - (defender.damageReduction ?? 0));
}

/** True if the fighter's accumulated damage meets or exceeds its HP. */
export function isKnockedOut(fighter: FighterInPlay): boolean {
  return fighter.damage >= fighter.card.hp;
}

/** Points awarded for knocking out the given fighter. */
export function pointsForKo(fighter: FighterInPlay): number {
  return fighter.card.isEx ? 2 : 1;
}
