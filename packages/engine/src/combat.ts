// Combat helpers: energy-cost satisfaction and damage calculation.

import type { AttackDef, CreatureInPlay, EnergyType } from "./types.js";
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
export function isWeakTo(attacker: CreatureInPlay, defender: CreatureInPlay): boolean {
  return defender.card.weakness === attacker.card.type;
}

/** Damage dealt by `attack` from `attacker` to `defender`, including weakness. */
export function computeDamage(
  attacker: CreatureInPlay,
  defender: CreatureInPlay,
  attack: AttackDef
): number {
  const weaknessBonus = isWeakTo(attacker, defender) ? WEAKNESS_BONUS : 0;
  return attack.damage + weaknessBonus;
}

/** True if the creature's accumulated damage meets or exceeds its HP. */
export function isKnockedOut(creature: CreatureInPlay): boolean {
  return creature.damage >= creature.card.hp;
}

/** Points awarded for knocking out the given creature. */
export function pointsForKo(creature: CreatureInPlay): number {
  return creature.card.isEx ? 2 : 1;
}
