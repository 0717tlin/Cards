import { describe, expect, it } from "vitest";
import { applyMove, CARD_POOL, chooseMove, createBattle, getLegalMoves, TRAINER_POOL, type BattleState } from "./index.js";
import { makeUid, toInPlay } from "./setup.js";

function battle(active = "merab", defender = "tai-tuivasa"): BattleState {
  const state = createBattle({ seed: 12, deckP1: Array(20).fill(CARD_POOL.merab), deckP2: Array(20).fill(CARD_POOL.merab), energyTypeP1: "water", energyTypeP2: "colorless" });
  state.turnPlayer = "P1"; state.turnNumber = 4; state.phase = { kind: "main" };
  for (const player of Object.values(state.players)) {
    player.hand = []; player.bench = []; player.pendingEnergy = null;
    player.hasAttachedEnergy = false; player.hasRetreated = false; player.hasPlayedSupporter = false;
  }
  state.players.P1.active = toInPlay(CARD_POOL[active]!);
  state.players.P2.active = toInPlay({ ...CARD_POOL[defender]!, weakness: null });
  return state;
}

describe("AI turn planning", () => {
  it("takes a winning knockout without wasting energy or trainers", () => {
    const s = battle("merab", "brandon-royval");
    s.players.P1.active!.attached = ["water"];
    s.players.P1.points = 2; s.players.P2.active!.damage = 30;
    s.players.P1.pendingEnergy = "water";
    s.players.P1.hand = [TRAINER_POOL["dana-white"]!, TRAINER_POOL["herb-dean"]!];
    expect(chooseMove(s)).toEqual({ type: "attack", attackId: "single-leg" });
  });
  it("chooses Herb Dean over drawing when its bonus wins this turn", () => {
    const s = battle("merab", "brandon-royval");
    s.players.P1.active!.attached = ["water"];
    s.players.P1.points = 2; s.players.P2.active!.damage = 20;
    s.players.P1.hand = [TRAINER_POOL["dana-white"]!, TRAINER_POOL["herb-dean"]!];
    const move = chooseMove(s);
    expect(move).toEqual({ type: "playTrainer", handIndex: 1 });
    const boosted = applyMove(s, move);
    expect(applyMove(boosted, chooseMove(boosted)).winner).toBe("P1");
  });
  it("saves a healing item when there is only one damage and no threat", () => {
    const s = battle(); s.players.P1.active!.attached = ["water"];
    s.players.P1.active!.damage = 1; s.players.P1.hand = [TRAINER_POOL.bandages!];
    expect(chooseMove(s)).toEqual({ type: "attack", attackId: "single-leg" });
  });
  it("heals before attacking when healing prevents a knockout", () => {
    const s = battle(); s.players.P1.active!.attached = ["water"];
    s.players.P1.active!.damage = 20; s.players.P2.active!.attached = ["colorless", "colorless", "colorless"];
    s.players.P1.hand = [TRAINER_POOL.bandages!];
    expect(chooseMove(s)).toEqual({ type: "playTrainer", handIndex: 0, targetUid: s.players.P1.active!.uid });
  });
  it("retreats an endangered bleeding fighter into a ready attacker", () => {
    const s = battle(); s.players.P1.active!.attached = ["water"];
    s.players.P1.active!.damage = 40; s.players.P1.active!.bleeding = true;
    const replacement = toInPlay(CARD_POOL["islam-makhachev"]!); replacement.attached = ["water"];
    s.players.P1.bench = [replacement]; s.players.P2.active!.attached = ["colorless", "colorless", "colorless"];
    expect(chooseMove(s)).toEqual({ type: "retreat", benchIndex: 0 });
  });
  it("charges a future attacker rather than overcharging the active", () => {
    const s = battle(); s.players.P1.active!.attached = ["water"];
    const reserve = toInPlay(CARD_POOL["islam-makhachev-ex"]!);
    s.players.P1.bench = [reserve]; s.players.P1.pendingEnergy = "water";
    expect(chooseMove(s)).toEqual({ type: "attachEnergy", targetUid: reserve.uid });
  });
  it("uses Footwork Drill to make a lifesaving retreat affordable", () => {
    const s = battle("tai-tuivasa"); s.players.P1.active!.damage = 120;
    s.players.P1.active!.attached = ["water", "water", "water"];
    const replacement = toInPlay(CARD_POOL["islam-makhachev"]!); replacement.attached = ["water"];
    s.players.P1.bench = [replacement]; s.players.P1.hand = [TRAINER_POOL["footwork-drill"]!];
    s.players.P2.active!.attached = ["colorless", "colorless", "colorless"];
    const move = chooseMove(s); expect(move).toEqual({ type: "playTrainer", handIndex: 0 });
    expect(chooseMove(applyMove(s, move))).toEqual({ type: "retreat", benchIndex: 0 });
  });
  it("avoids a Fire attachment when Furioso would burn itself into an immediate loss", () => {
    const s = battle("el-matador-ex"); s.players.P1.active!.damage = 180;
    s.players.P1.active!.attached = ["fire"]; s.players.P1.pendingEnergy = "fire";
    expect(chooseMove(s)).toEqual({ type: "pass" });
  });
  it("attaches to the active when it unlocks a stronger attack immediately", () => {
    const s = battle("giga-chikadze"); s.players.P1.active!.attached = ["psychic"];
    s.players.P1.energyType = "psychic"; s.players.P1.pendingEnergy = "psychic";
    s.players.P1.bench = [toInPlay(CARD_POOL.merab!)];
    expect(chooseMove(s)).toEqual({ type: "attachEnergy", targetUid: s.players.P1.active!.uid });
  });
  it("promotes a ready fighter instead of an uncharged heavyweight", () => {
    const s = battle("merab", "brandon-royval");
    const ready = toInPlay(CARD_POOL["islam-makhachev"]!); ready.attached = ["water", "colorless"];
    s.players.P1.active = null;
    s.players.P1.bench = [toInPlay(CARD_POOL["tai-tuivasa"]!), ready];
    s.phase = { kind: "awaitPromotion", player: "P1" }; s.turnPlayer = "P2";
    expect(chooseMove(s)).toEqual({ type: "promote", benchIndex: 1 });
  });
  it("benches Khabib to reduce the cost of a winning Koshi Guruma", () => {
    const s = battle("islam-makhachev", "brandon-royval");
    s.players.P2.active!.damage = 10;
    s.players.P1.active!.attached = ["water"]; s.players.P1.points = 2;
    s.players.P1.hand = [CARD_POOL["khabib-nurmagomedov"]!];
    const move = chooseMove(s);
    expect(move).toEqual({ type: "playBasic", handIndex: 0 });
    const benched = applyMove(s, move);
    expect(applyMove(benched, chooseMove(benched)).winner).toBe("P1");
  });
  it("evolves before attacking with the stronger Identity", () => {
    const s = battle("charles-oliveira"); s.players.P1.active!.attached = ["lightning"];
    s.players.P1.hand = [CARD_POOL["do-bronx"]!];
    expect(chooseMove(s)).toEqual({ type: "evolve", handIndex: 0, targetUid: s.players.P1.active!.uid });
  });
  it("plans Joshua's full two-attack combination after discarding energy", () => {
    let s = battle("joshua-van-ex"); s.players.P1.active!.attached = ["lightning", "lightning"];
    s.players.P2.active!.damage = s.players.P2.active!.card.hp - 60;
    s.players.P2.bench = [toInPlay(CARD_POOL["tai-tuivasa"]!)];
    const first = chooseMove(s); expect(first.type).toBe("attack");
    s = applyMove(s, first);
    expect(s.turnPlayer).toBe("P1");
    const second = chooseMove(s); expect(getLegalMoves(s)).toContainEqual(second);
    s = applyMove(s, second);
    expect(s.turnPlayer).toBe("P2"); expect(s.players.P1.points).toBe(1);
    expect(s.players.P2.active).toBeNull();
  });
  it("prefers a guaranteed knockout to a coin flip with higher average damage", () => {
    const s = battle("merab", "brandon-royval"); s.players.P1.active!.attached = ["water"];
    s.players.P1.active!.card = { ...s.players.P1.active!.card, attacks: [
      { id: "risky", name: "Risky", cost: ["water"], damage: 20, effects: [{ kind: "coinDamageBonus", amount: 80 }] },
      { id: "sure", name: "Sure", cost: ["water"], damage: 50 },
    ] };
    expect(chooseMove(s)).toEqual({ type: "attack", attackId: "sure" });
  });
  it("does not spend Herb Dean on a status-only attack", () => {
    const s = battle("bobby-green"); s.players.P1.active!.attached = ["grass"];
    s.players.P1.hand = [TRAINER_POOL["herb-dean"]!];
    expect(chooseMove(s)).toEqual({ type: "attack", attackId: "trash-talk" });
  });
  it("does not inspect hidden cards, predict live coin flips, mutate state, or allocate fighter IDs", () => {
    const s = battle("islam-makhachev"); s.players.P1.active!.attached = ["water"];
    s.players.P1.hand = [CARD_POOL["khabib-nurmagomedov"]!];
    const before = structuredClone(s);
    const uidBefore = Number(makeUid("probe").split("#")[1]);
    const move = chooseMove(s);
    const uidAfter = Number(makeUid("probe").split("#")[1]);
    expect(uidAfter).toBe(uidBefore + 1); expect(s).toEqual(before);
    const hiddenChanged = structuredClone(s);
    hiddenChanged.rngState = 123456;
    hiddenChanged.players.P2.hand = [CARD_POOL["islam-makhachev-ex"]!, TRAINER_POOL.bandages!];
    hiddenChanged.players.P2.deck = hiddenChanged.players.P2.deck.map(() => CARD_POOL["tai-tuivasa"]!);
    expect(chooseMove(hiddenChanged)).toEqual(move);
  });
  it.each([7,31])("finishes a mixed-card game using only legal moves (%i)", seed => {
    const deck = [
      ...Array(4).fill(CARD_POOL["justin-gaethje"]!), ...Array(2).fill(CARD_POOL["the-highlight-ex"]!),
      ...Array(4).fill(CARD_POOL["petr-yan"]!), ...Array(4).fill(CARD_POOL["joshua-van-ex"]!),
      ...Array(2).fill(TRAINER_POOL["herb-dean"]!), ...Array(2).fill(TRAINER_POOL.bandages!), ...Array(2).fill(TRAINER_POOL["dana-white"]!),
    ];
    let s = createBattle({ seed, deckP1: deck, deckP2: deck, energyTypeP1: "fighting", energyTypeP2: "fighting", energyTypesP1: ["fighting","psychic","lightning"], energyTypesP2: ["fighting","psychic","lightning"] });
    for (let i = 0; i < 1000 && !s.winner; i++) {
      const move = chooseMove(s); expect(getLegalMoves(s)).toContainEqual(move);
      s = applyMove(s, move);
    }
    expect(s.winner).not.toBeNull();
  });
});
