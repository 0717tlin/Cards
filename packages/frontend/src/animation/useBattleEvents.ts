// Turns the engine's structured events into short-lived visual effects.
//
// The store commits a move's resulting state all at once and keeps input locked
// for the batch's animation time (animation/timing.ts). This hook lays that
// batch out on a timeline using the same duration table, and derives what the
// UI should show *at this moment* from (timeline, time since the batch arrived).
// Deriving during render (instead of setting state in effects) means the very
// first frame of a new state already looks right — e.g. the defender still
// shows its pre-hit HP until the attack lands, and a knocked-out fighter is
// still on the board as a "ghost".

import { useEffect, useReducer, useRef } from "react";
import type { BattleEvent, FighterInPlay, PlayerId } from "@card-game/engine";
import { opponentOf } from "@card-game/engine";
import { eventAnimationTime, prefersReducedMotion } from "./timing";

interface Entry {
  event: BattleEvent;
  index: number; // absolute index in state.events (stable React key)
  start: number;
  end: number;
}

export function buildTimeline(events: readonly BattleEvent[], firstIndex: number, reduced: boolean): Entry[] {
  let t = 0;
  return events.map((event, i) => {
    const d = reduced ? 0 : eventAnimationTime(event);
    const entry = { event, index: firstIndex + i, start: t, end: t + d };
    t += d;
    return entry;
  });
}

export interface KoGhost {
  fromBench?: boolean;
  key: number;
  player: PlayerId;
  fighter: FighterInPlay;
  /** Damage to display right now (pre-hit until the hit lands). */
  damage: number;
  shaking: boolean;
}

export interface BattleEffects {
  coin: { result: "heads" | "tails"; flip: number; bonus: number; key: number; attackName?: string; reason?: "burn" | "bleeding" } | null;
  turnBanner: { player: PlayerId; key: number } | null;
  /** Attacker currently lunging. */
  lungeUid: string | null;
  /** Defender currently being hit (shake + damage pop). */
  hit: { uid: string; amount: number; weakness: boolean; key: number } | null;
  /** Damage not yet "landed" visually, per fighter uid (subtract from displayed damage). */
  pendingDamage: Record<string, number>;
  ghosts: KoGhost[];
  /** Points not yet awarded visually, per player (subtract from displayed points). */
  pendingPoints: Partial<Record<PlayerId, number>>;
  pointsPulse: { player: PlayerId; key: number } | null;
  /** Energy zones whose new energy hasn't "appeared" yet. */
  energyHidden: Partial<Record<PlayerId, boolean>>;
  ringPulse: { player: PlayerId; key: number } | null;
  shuffling: { player: PlayerId; key: number } | null;
  /** Number of the human's most recently drawn cards not yet revealed. */
  hiddenDraws: Partial<Record<PlayerId, number>>;
  /** An energy that is currently flying from the zone to this fighter. */
  flyEnergy: { player: PlayerId; uid: string } | null;
  /** Fighters just placed on the bench (play their enter animation). */
  entering: Record<string, true>;
}

const NONE: BattleEffects = {
  coin: null,
  turnBanner: null,
  lungeUid: null,
  hit: null,
  pendingDamage: {},
  ghosts: [],
  pendingPoints: {},
  pointsPulse: null,
  energyHidden: {},
  ringPulse: null,
  shuffling: null,
  hiddenDraws: {},
  flyEnergy: null,
  entering: {},
};

export function effectsAt(timeline: Entry[], elapsed: number): BattleEffects {
  if (timeline.length === 0) return NONE;
  const active = (e: Entry) => elapsed >= e.start && elapsed < e.end;
  const pending = (e: Entry) => elapsed < e.start;
  const fx: BattleEffects = {
    ...NONE,
    pendingDamage: {},
    ghosts: [],
    pendingPoints: {},
    energyHidden: {},
    hiddenDraws: {},
    entering: {},
  };

  const damageEntries = timeline.filter((e) => e.event.kind === "damageDealt" && e.event.amount > 0);

  for (const entry of timeline) {
    const ev = entry.event;
    switch (ev.kind) {
      case "coinFlipped":
        if (active(entry)) fx.coin = { result: ev.result, flip: ev.flip, bonus: ev.bonus, key: entry.index, attackName: ev.attackName, reason: ev.reason };
        break;
      case "turnStarted":
        if (active(entry)) fx.turnBanner = { player: ev.player, key: entry.index };
        break;
      case "attackUsed":
        if (active(entry)) fx.lungeUid = ev.attackerUid;
        break;
      case "damageDealt":
        if (ev.amount <= 0) break;
        if (active(entry)) {
          fx.hit = { uid: ev.uid, amount: ev.amount, weakness: ev.weakness, key: entry.index };
        }
        if (pending(entry)) fx.pendingDamage[ev.uid] = (fx.pendingDamage[ev.uid] ?? 0) + ev.amount;
        break;
      case "healed":
        if (pending(entry)) fx.pendingDamage[ev.uid] = (fx.pendingDamage[ev.uid] ?? 0) - ev.amount;
        break;
      case "knockedOut": {
        const attacker = opponentOf(ev.player);
        if (pending(entry)) {
          fx.pendingPoints[attacker] = (fx.pendingPoints[attacker] ?? 0) + ev.pointsAwarded;
        }
        if (active(entry)) fx.pointsPulse = { player: attacker, key: entry.index };
        // The ghost is visible from the start of the batch until the KO finishes.
        if (elapsed < entry.end) {
          const hits = damageEntries.filter(
            (d) => d.index < entry.index && d.event.kind === "damageDealt" && d.event.uid === ev.fighter.uid
          );
          const pendingDamage = hits.reduce((sum, hit) =>
            sum + (elapsed < hit.start && hit.event.kind === "damageDealt" ? hit.event.amount : 0), 0);
          fx.ghosts.push({
            key: entry.index,
            player: ev.player,
            fighter: ev.fighter,
            fromBench: ev.fromBench,
            damage: ev.fighter.damage - pendingDamage,
            shaking: hits.some(active),
          });
        }
        break;
      }
      case "energyGenerated":
        if (pending(entry)) fx.energyHidden[ev.player] = true;
        if (active(entry)) fx.ringPulse = { player: ev.player, key: entry.index };
        break;
      case "cardDrawn":
        if (pending(entry)) fx.hiddenDraws[ev.player] = (fx.hiddenDraws[ev.player] ?? 0) + 1;
        break;
      case "deckShuffled":
        if (active(entry)) fx.shuffling = { player: ev.player, key: entry.index };
        break;
      case "energyAttached":
        if (active(entry)) fx.flyEnergy = { player: ev.player, uid: ev.targetUid };
        break;
      case "fighterBenched":
        if (elapsed < entry.end) fx.entering[ev.uid] = true;
        break;
      case "retreated":
      case "switched":
        if (elapsed < entry.end) {
          fx.entering[ev.inUid] = true;
          fx.entering[ev.outUid] = true;
        }
        break;
      case "promoted":
        if (elapsed < entry.end) fx.entering[ev.uid] = true;
        break;
      default:
        break;
    }
  }
  return fx;
}

/**
 * @param events    state.events
 * @param batchStart index where the batch currently animating begins
 * @param busy      whether the store is still animating/acting
 * @param gameId    changes on new game (resets the timeline)
 */
export function useBattleEvents(
  events: readonly BattleEvent[],
  batchStart: number,
  busy: boolean,
  gameId: number
): BattleEffects {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const batchKey = `${gameId}:${batchStart}:${events.length}`;
  const ref = useRef<{ key: string; receivedAt: number } | null>(null);

  if (ref.current === null) {
    // First render: only animate a batch that is still in progress; otherwise
    // (e.g. returning to the battle tab later) don't replay history.
    ref.current = { key: batchKey, receivedAt: busy ? performance.now() : -Infinity };
  } else if (ref.current.key !== batchKey) {
    ref.current = { key: batchKey, receivedAt: performance.now() };
  }

  const reduced = prefersReducedMotion();
  const timeline = buildTimeline(events.slice(batchStart), batchStart, reduced);
  const elapsed = performance.now() - ref.current.receivedAt;

  // Re-render at every boundary so effects start and stop on time.
  useEffect(() => {
    const receivedAt = ref.current!.receivedAt;
    if (!Number.isFinite(receivedAt)) return;
    const now = performance.now() - receivedAt;
    const boundaries = new Set<number>();
    for (const e of timeline) {
      if (e.start > now) boundaries.add(e.start);
      if (e.end > now) boundaries.add(e.end);
    }
    const timers = [...boundaries].map((b) => setTimeout(tick, b - now + 1));
    return () => timers.forEach(clearTimeout);
    // timeline is fully determined by batchKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchKey]);

  return effectsAt(timeline, elapsed);
}
