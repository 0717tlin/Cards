import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, computeDamage, createBattle, getFighterStageLabel, getLegalMoves } from "./index.js";
import { toInPlay } from "./setup.js";

const connor = CARD_POOL["connor-mcgregor"]!;
const sean = CARD_POOL["sean-omalley"]!;
const suga = CARD_POOL.suga!;
function battle(card = connor) {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(card.stage === "basic" ? card : sean), deckP2: Array(20).fill(CARD_POOL["tai-tuivasa"]!), energyTypeP1: "grass", energyTypeP2: "water" });
  state.turnPlayer = "P1"; state.turnNumber = 4;
  state.players.P1.active = toInPlay(card);
  state.players.P1.active.attached = ["grass", "grass", "water"];
  state.players.P1.pendingEnergy = null;
  state.players.P1.hand = [];
  state.players.P1.bench = [toInPlay(CARD_POOL.merab!)];
  state.players.P2.active = toInPlay({ ...CARD_POOL["tai-tuivasa"]!, hp: 400 });
  state.players.P2.bench = [toInPlay(CARD_POOL["islam-makhachev-ex"]!), toInPlay(CARD_POOL["dan-ige"]!)];
  return state;
}

describe("new Grass fighters", () => {
  it("matches stats, rarities, and the Sean-to-Suga evolution", () => {
    expect(connor).toMatchObject({ hp: 80, type: "grass", stage: "basic", rarity: "rare", retreatCost: 1 });
    expect(sean).toMatchObject({ hp: 60, type: "grass", stage: "basic", rarity: "uncommon", retreatCost: 1 });
    expect(suga).toMatchObject({ hp: 110, type: "grass", stage: "stage1", evolvesFrom: sean.id, rarity: "rare", retreatCost: 1 });
    expect(getFighterStageLabel(sean)).toBe("Prospect"); expect(getFighterStageLabel(suga)).toBe("Identity");
  });
  it("offers every opposing fighter as a target and rejects missing, friendly, or unpaid targets", () => {
    const state = battle();
    const targets = [state.players.P2.active!, ...state.players.P2.bench];
    expect(getLegalMoves(state).filter(move => move.type === "attack")).toEqual(targets.map(target => ({ type: "attack", attackId: "capoeira-kick", targetUid: target.uid })));
    const snapshot = structuredClone(state);
    for (const targetUid of [undefined, state.players.P1.active!.uid, state.players.P1.bench[0]!.uid]) {
      expect(() => applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid })).toThrow("Illegal move");
    }
    expect(state).toEqual(snapshot);
    state.players.P1.active!.attached = ["grass", "water"];
    expect(getLegalMoves(state).some(move => move.type === "attack")).toBe(false);
  });
  it.each([false, true])("discards all attached energy and damages only the selected fighter (bench: %s)", bench => {
    const state = battle(); const snapshot = structuredClone(state);
    const target = bench ? state.players.P2.bench[0]! : state.players.P2.active!;
    const hit = applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
    expect(hit.players.P1.active!.attached).toEqual([]);
    expect(hit.players.P1.discard.filter(entry => entry.kind === "energy")).toEqual(["grass", "grass", "water"].map(energy => ({ kind: "energy", energy })));
    expect(hit.players.P2.active!.damage).toBe(bench ? 0 : 50);
    expect(hit.players.P2.bench.map(fighter => fighter.damage)).toEqual(bench ? [50, 0] : [0, 0]);
    expect(hit.turnPlayer).toBe("P2"); expect(hit.rngState).toBe(state.rngState);
    expect(state).toEqual(snapshot);
  });
  it("applies active attack modifiers and ignores them on the bench", () => {
    const state = battle();
    const target = state.players.P2.active!;
    target.card = { ...target.card, weakness: "grass" };
    target.damageReduction = 10;
    target.damageVulnerability = { amount: 20, expiresAfterTurn: 6 };
    state.players.P1.attackDamageBonus = 10;
    const hit = applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
    expect(hit.players.P2.active!.damage).toBe(90);
    const benched = state.players.P2.bench[0]!;
    benched.card = { ...benched.card, weakness: "grass" }; benched.damageReduction = 20;
    benched.damageVulnerability = { amount: 20, expiresAfterTurn: 6 };
    const benchHit = applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: benched.uid });
    expect(benchHit.players.P2.bench[0]!.damage).toBe(50);
  });
  it.each([false, true])("handles active promotion or bench knockout, including ex points (bench: %s)", bench => {
    const state = battle(); const target = toInPlay(CARD_POOL["islam-makhachev-ex"]!);
    target.damage = target.card.hp - 50; target.attached = ["water"];
    if (bench) state.players.P2.bench = [target]; else state.players.P2.active = target;
    const hit = applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
    expect(hit.players.P1.points).toBe(2);
    expect(hit.players.P2.discard).toContainEqual({ kind: "fighter", card: target.card });
    expect(hit.players.P2.discard).toContainEqual({ kind: "energy", energy: "water" });
    expect(hit.phase.kind).toBe(bench ? "main" : "awaitPromotion");
    state.players.P1.points = 1;
    expect(applyMove(state, { type: "attack", attackId: "capoeira-kick", targetUid: target.uid }).winner).toBe("P1");
  });
  it("lets the AI choose a winning bench target", () => {
    const state = battle(); state.players.P1.points = 1;
    const target = state.players.P2.bench[0]!; target.damage = target.card.hp - 50;
    expect(chooseMove(state)).toEqual({ type: "attack", attackId: "capoeira-kick", targetUid: target.uid });
  });
});

describe("Feint and Suga", () => {
  it("lets the AI use Feint to prepare its next attack", () => {
    const state = battle(sean);
    expect(chooseMove(state)).toEqual({ type: "attack", attackId: "feint" });
  });
  it("deals no initial damage, survives the opponent turn, and boosts the evolved fighter's attack once", () => {
    let state = battle(sean); state.players.P1.active!.attached = ["grass"];
    const targetUid = state.players.P2.active!.uid;
    state = applyMove(state, { type: "attack", attackId: "feint" });
    expect(state.players.P2.active!.damage).toBe(0);
    expect(state.players.P2.active!.damageVulnerability).toEqual({ amount: 20, expiresAfterTurn: 6 });
    state = applyMove(state, { type: "pass" });
    expect(state.turnPlayer).toBe("P1");
    state.players.P1.hand = [suga];
    const activeUid = state.players.P1.active!.uid;
    state = applyMove(state, { type: "evolve", handIndex: 0, targetUid: activeUid });
    state = applyMove(state, { type: "attachEnergy", targetUid: activeUid });
    const incomingUid = state.players.P1.bench[0]!.uid;
    state = applyMove(state, { type: "attack", attackId: "suga-switch-kick", targetUid: incomingUid });
    expect(state.players.P2.active).toMatchObject({ uid: targetUid, damage: 90 });
    expect(state.players.P2.active!.damageVulnerability).toBeUndefined();
    expect(state.players.P1.active!.uid).toBe(incomingUid);
    expect(state.players.P1.bench[0]).toMatchObject({ uid: activeUid, card: { id: "suga" }, attached: ["grass", "grass"] });
    expect(computeDamage(state.players.P1.bench[0]!, state.players.P2.active!, suga.attacks[0]!)).toBe(70);
  });
  it("clears Feint on retreat or evolution and never turns status-only attacks into damage", () => {
    const base = applyMove(battle(sean), { type: "attack", attackId: "feint" });
    const defender = base.players.P2.active!;
    expect(computeDamage(base.players.P1.active!, defender, sean.attacks[0]!)).toBe(0);
    defender.attached = ["water", "water", "water", "water"];
    const retreated = applyMove(base, { type: "retreat", benchIndex: 0 });
    expect(retreated.players.P2.bench.find(fighter => fighter.uid === defender.uid)!.damageVulnerability).toBeUndefined();
    const evolving = structuredClone(base); evolving.players.P2.active!.card = sean; evolving.players.P2.hand = [suga];
    const evolved = applyMove(evolving, { type: "evolve", handIndex: 0, targetUid: defender.uid });
    expect(evolved.players.P2.active!.damageVulnerability).toBeUndefined();
  });
  it("expires even when the follow-up turn is passed and does not increase checkup damage", () => {
    let state = battle(sean); state.players.P2.active!.bleeding = true;
    state = applyMove(state, { type: "attack", attackId: "feint" });
    expect(state.players.P2.active!.damage).toBe(10);
    state = applyMove(state, { type: "pass" });
    expect(state.players.P2.active!.damage).toBe(20);
    expect(state.players.P2.active!.damageVulnerability).toBeDefined();
    state = applyMove(state, { type: "pass" });
    expect(state.players.P2.active!.damage).toBe(30);
    expect(state.players.P2.active!.damageVulnerability).toBeUndefined();
  });
  it("allows Suga's attack without a bench and requires two Grass energy", () => {
    const state = battle(suga); state.players.P1.bench = [];
    const hit = applyMove(state, { type: "attack", attackId: "suga-switch-kick" });
    expect(hit.players.P2.active!.damage).toBe(70);
    expect(hit.players.P1.active!.card.id).toBe("suga");
    state.players.P1.active!.attached = ["grass", "water"];
    expect(getLegalMoves(state).some(move => move.type === "attack")).toBe(false);
  });
});
