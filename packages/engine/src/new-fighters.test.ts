import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, createBattle, getLegalMoves } from "./index.js";
import { computeDamage } from "./combat.js";

function fixture() {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL["ilia-topuria"]!), deckP2: Array(20).fill(CARD_POOL.merab!), energyTypeP1: "fire", energyTypeP2: "water" });
  state.phase = { kind: "main" };
  state.turnPlayer = "P1";
  state.turnNumber = 4;
  state.players.P1.pendingEnergy = "fire";
  state.players.P1.hasAttachedEnergy = false;
  return state;
}

describe("new fighter evolutions", () => {
  it.each([
    ["king-green", "bobby-green"],
    ["el-matador-ex", "ilia-topuria"],
  ])("evolves %s from its basic and preserves attached energy", (evolution, basic) => {
    const state = fixture();
    const active = state.players.P1.active!;
    active.card = CARD_POOL[basic]!;
    active.enteredTurn = 1;
    active.attached = ["fire", "grass"];
    state.players.P1.hand = [CARD_POOL[evolution]!];
    const next = applyMove(state, { type: "evolve", handIndex: 0, targetUid: active.uid });
    expect(next.players.P1.active!.card.id).toBe(evolution);
    expect(next.players.P1.active!.attached).toEqual(["fire", "grass"]);
  });

  it("King Green is uncommon and Ragebait Jab Burns its target", () => {
    const state = fixture();
    const active = state.players.P1.active!;
    active.card = CARD_POOL["king-green"]!;
    active.attached = ["grass", "grass"];
    state.players.P2.active!.card = CARD_POOL["tai-tuivasa"]!;
    expect(active.card.rarity).toBe("uncommon");
    const next = applyMove(state, { type: "attack", attackId: "ragebait-jab" });
    // Attack damage plus Burn's immediate checkup damage, regardless of its coin flip.
    expect(next.players.P2.active!.damage).toBe(60);
  });

  it.each([false, true])("Furioso triggers on Fire attachment (benched: %s)", (benched) => {
    const state = fixture();
    const fighter = { uid: "matador", card: CARD_POOL["el-matador-ex"]!, attached: [], damage: 0 };
    if (benched) state.players.P1.bench = [fighter];
    else state.players.P1.active = fighter;
    const before = structuredClone(state);
    const next = applyMove(state, { type: "attachEnergy", targetUid: fighter.uid });
    expect(next.players.P1.active!.burned).toBe(true);
    expect(next.players.P2.active!.burned).toBe(true);
    if (benched) expect(next.players.P1.bench[0]!.burned).toBeUndefined();
    expect(next.events.at(-1)).toMatchObject({ kind: "abilityUsed", name: "Furioso" });
    expect(next.turnNumber).toBe(4);
    expect(getLegalMoves(next).some(move => move.type === "useAbility")).toBe(false);
    expect(state).toEqual(before);
  });

  it("does not trigger on another energy or attachment to another fighter", () => {
    const state = fixture();
    state.players.P1.bench = [{ uid: "matador", card: CARD_POOL["el-matador-ex"]!, attached: [], damage: 0 }];
    for (const [targetUid, energy] of [["matador", "water"], [state.players.P1.active!.uid, "fire"]] as const) {
      state.players.P1.pendingEnergy = energy;
      const next = applyMove(state, { type: "attachEnergy", targetUid });
      expect(next.players.P1.active!.burned).toBeFalsy();
      expect(next.players.P2.active!.burned).toBeFalsy();
    }
  });

  it("Infernal counts only Fire Energy", () => {
    const state = fixture();
    const active = state.players.P1.active!;
    active.card = CARD_POOL["el-matador-ex"]!;
    active.attached = ["fire", "water", "fire", "grass"];
    expect(computeDamage(active, state.players.P2.active!, active.card.attacks[0]!)).toBe(80);
  });
});
