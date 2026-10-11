import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, computeDamage, createBattle, getFighterStageLabel, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

function battle(id = "sean-strickland-champion") {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL["sean-strickland"]!), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "colorless", energyTypeP2: "colorless" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  state.players.P1.active = toInPlay(CARD_POOL[id]!); state.players.P1.active.attached = ["colorless", "colorless"];
  state.players.P1.hand = []; state.players.P1.bench = []; state.players.P1.pendingEnergy = null;
  state.players.P2.active = toInPlay({ ...CARD_POOL["tai-tuivasa"]!, hp: 300, weakness: null });
  state.players.P2.bench = [toInPlay(CARD_POOL.merab!)];
  return state;
}

describe("Sean Strickland evolution chain", () => {
  it("requires Prospect to Contender to Champion on separate turns and preserves prior stages", () => {
    let state = battle("sean-strickland"); state.players.P1.active!.damage = 10;
    const uid = state.players.P1.active!.uid;
    state.players.P1.hand = [CARD_POOL["sean-strickland-contender"]!, CARD_POOL["sean-strickland-champion"]!];
    expect(() => applyMove(state, { type: "evolve", handIndex: 1, targetUid: uid })).toThrow();
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid });
    expect(getFighterStageLabel(state.players.P1.active!.card)).toBe("Contender");
    expect(() => applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid })).toThrow();
    state = applyMove(applyMove(state, { type: "pass" }), { type: "pass" });
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: uid });
    expect(getFighterStageLabel(state.players.P1.active!.card)).toBe("Champion");
    expect(state.players.P1.active).toMatchObject({ uid, damage: 10, attached: ["colorless", "colorless"], previousStages: [CARD_POOL["sean-strickland"], CARD_POOL["sean-strickland-contender"]] });
    expect(getFighterStageLabel(CARD_POOL["sean-strickland"]!)).toBe("Prospect");
  });

  it.each([[0, 0, 90], [1, 0, 90], [0, 1, 120]])("Underdog compares knockout points (%i vs %i)", (own, opposing, damage) => {
    const state = battle(); state.players.P1.points = own; state.players.P2.points = opposing;
    const fighter = state.players.P1.active!;
    expect(computeDamage(fighter, state.players.P2.active!, fighter.card.attacks[0]!, 0, [], 0, opposing > own)).toBe(damage);
    expect(applyMove(state, { type: "attack", attackId: "strickland-jab-teep" }).players.P2.active!.damage).toBe(damage);
  });

  it("requires two energy for Champion and stacks Underdog with other active damage modifiers", () => {
    const state = battle(); state.players.P1.active!.attached = ["water"];
    expect(getLegalMoves(state)).not.toContainEqual({ type: "attack", attackId: "strickland-jab-teep" });
    state.players.P1.active!.attached.push("fire"); state.players.P2.points = 1;
    state.players.P1.attackDamageBonus = 10; state.players.P2.active!.damageReduction = 10;
    state.players.P2.active!.card = { ...state.players.P2.active!.card, weakness: "colorless" };
    expect(applyMove(state, { type: "attack", attackId: "strickland-jab-teep" }).players.P2.active!.damage).toBe(140);
  });

  it("lets the AI see a winning Underdog knockout", () => {
    const state = battle(); state.players.P1.points = 1; state.players.P2.points = 2;
    state.players.P2.active!.card = { ...state.players.P2.active!.card, hp: 100, isEx: true };
    const move = chooseMove(state);
    expect(move).toEqual({ type: "attack", attackId: "strickland-jab-teep" });
    expect(applyMove(state, move).winner).toBe("P1");
  });
});
