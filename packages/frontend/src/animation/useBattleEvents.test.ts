import { describe, expect, it } from "vitest";
import type { BattleEvent } from "@card-game/engine";
import { animationTime, EVENT_MS } from "./timing";
import { buildTimeline, effectsAt } from "./useBattleEvents";

const attack: BattleEvent = { kind: "attackUsed", player: "P1", attackerUid: "attacker", attackId: "test", targetUid: "defender" };
const zero: BattleEvent = { kind: "damageDealt", player: "P2", uid: "defender", amount: 0, weakness: false };

describe("damage animation timeline", () => {
  it("skips the hit, damage popup, and pause when no damage is dealt", () => {
    const events = [attack, zero];
    const timeline = buildTimeline(events, 10, false);
    expect(animationTime(events, false)).toBe(EVENT_MS.attackUsed);
    expect(effectsAt(timeline, 100).lungeUid).toBe("attacker");
    for (const time of [0, 100, EVENT_MS.attackUsed, EVENT_MS.attackUsed + 100]) {
      expect(effectsAt(timeline, time).hit).toBeNull();
      expect(effectsAt(timeline, time).pendingDamage).toEqual({});
    }
  });

  it("keeps a failed damage coin flip but skips its zero-damage hit", () => {
    const coin: BattleEvent = { kind: "coinFlipped", player: "P1", result: "tails", flip: 1, bonus: 0 };
    const events = [coin, attack, zero];
    const timeline = buildTimeline(events, 0, false);
    expect(effectsAt(timeline, 100).coin?.result).toBe("tails");
    expect(effectsAt(timeline, EVENT_MS.coinFlipped + EVENT_MS.attackUsed).hit).toBeNull();
    expect(animationTime(events, false)).toBe(EVENT_MS.coinFlipped + EVENT_MS.attackUsed);
  });

  it.each(["defender", "bench"])("animates actual damage to %s immediately after a zero-damage event", uid => {
    const damage: BattleEvent = { kind: "damageDealt", player: "P2", uid, amount: 20, weakness: false };
    const events = [attack, zero, damage];
    const timeline = buildTimeline(events, 10, false);
    expect(effectsAt(timeline, 100).pendingDamage).toEqual({ [uid]: 20 });
    expect(effectsAt(timeline, EVENT_MS.attackUsed).hit).toEqual({ uid, amount: 20, weakness: false, key: 12 });
    expect(animationTime(events, false)).toBe(EVENT_MS.attackUsed + EVENT_MS.damageDealt);
    expect(effectsAt(timeline, animationTime(events, false)).hit).toBeNull();
  });

  it("keeps reduced-motion effects instant", () => {
    const events: BattleEvent[] = [attack, zero, { ...zero, amount: 20 }];
    expect(animationTime(events, true)).toBe(0);
    expect(effectsAt(buildTimeline(events, 0, true), 0).hit).toBeNull();
  });
});
