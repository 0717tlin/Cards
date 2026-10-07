import { describe, it, expect } from "vitest";
import { canPayCost, computeDamage, isKnockedOut, pointsForKo } from "./combat.js";
import type { CreatureInPlay } from "./types.js";

function inPlay(over: Partial<CreatureInPlay["card"]>, attached: CreatureInPlay["attached"], damage = 0): CreatureInPlay {
  return {
    uid: "x#1",
    damage,
    attached,
    card: {
      id: "t",
      name: "T",
      type: "fire",
      hp: 60,
      attacks: [],
      retreatCost: 0,
      weakness: null,
      isEx: false,
      stage: "basic",
      ...over,
    },
  };
}

describe("canPayCost", () => {
  it("matches specific energy exactly", () => {
    expect(canPayCost(["fire"], ["fire"])).toBe(true);
    expect(canPayCost(["water"], ["fire"])).toBe(false);
  });

  it("colorless is paid by any leftover energy", () => {
    expect(canPayCost(["fire", "water"], ["fire", "colorless"])).toBe(true);
    expect(canPayCost(["fire"], ["fire", "colorless"])).toBe(false);
  });

  it("requires enough total energy", () => {
    expect(canPayCost(["fire", "fire"], ["fire", "fire", "colorless"])).toBe(false);
    expect(canPayCost(["fire", "fire", "grass"], ["fire", "fire", "colorless"])).toBe(true);
  });
});

describe("computeDamage", () => {
  it("adds weakness bonus when defender weakness matches attacker type", () => {
    const attacker = inPlay({ type: "fire" }, []);
    const defender = inPlay({ weakness: "fire" }, []);
    const dmg = computeDamage(attacker, defender, { id: "a", name: "A", cost: [], damage: 20 });
    expect(dmg).toBe(40);
  });

  it("no bonus when weakness does not match", () => {
    const attacker = inPlay({ type: "fire" }, []);
    const defender = inPlay({ weakness: "water" }, []);
    const dmg = computeDamage(attacker, defender, { id: "a", name: "A", cost: [], damage: 20 });
    expect(dmg).toBe(20);
  });
});

describe("KO and points", () => {
  it("KO when damage >= hp", () => {
    expect(isKnockedOut(inPlay({ hp: 60 }, [], 60))).toBe(true);
    expect(isKnockedOut(inPlay({ hp: 60 }, [], 59))).toBe(false);
  });

  it("EX awards 2 points, normal awards 1", () => {
    expect(pointsForKo(inPlay({ isEx: true }, []))).toBe(2);
    expect(pointsForKo(inPlay({ isEx: false }, []))).toBe(1);
  });
});
