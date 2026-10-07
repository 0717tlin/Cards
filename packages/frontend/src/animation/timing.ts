// Animation timing. The store uses this table to decide how long to lock input
// (and how long to wait before the next AI action) after a move; components use
// the same numbers so their animations fit inside that window.

import type { BattleEvent } from "@card-game/engine";

export const EVENT_MS: Record<BattleEvent["kind"], number> = {
  battleStarted: 0,
  turnStarted: 900,
  energyGenerated: 250,
  cardDrawn: 300,
  energyAttached: 400,
  creatureBenched: 350,
  retreated: 450,
  promoted: 450,
  attackUsed: 350,
  damageDealt: 550,
  knockedOut: 650,
  energyDiscarded: 0,
  gameWon: 0, // the result banner stays up; nothing to wait for
};

/** Pause before each AI action so the player can follow along. */
export const AI_THINK_MS = 500;

/** With reduced motion, animations are instant but AI actions stay readable. */
export const REDUCED_AI_STEP_MS = 200;

/** Screen-to-screen transition length. */
export const SCREEN_TRANSITION_MS = 250;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Total time to let the given events animate before continuing. */
export function animationTime(events: readonly BattleEvent[], reduced = prefersReducedMotion()): number {
  if (reduced) return 0;
  return events.reduce((total, e) => total + EVENT_MS[e.kind], 0);
}

/** Pause before the next AI action. */
export function aiThinkTime(reduced = prefersReducedMotion()): number {
  return reduced ? REDUCED_AI_STEP_MS : AI_THINK_MS;
}
