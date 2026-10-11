import { describe, expect, it } from "vitest";
import { applyMove, createBattle, getLegalMoves, CARD_POOL, computeDamage, getFighterStageLabel } from "./index.js";
import { toInPlay } from "./setup.js";
import { nextFloat } from "./rng.js";
function battle(id = "joshua-van-ex") {
  const s = createBattle({seed:12,deckP1:Array(20).fill(CARD_POOL["justin-gaethje"]),deckP2:Array(20).fill(CARD_POOL["tai-tuivasa"]),energyTypeP1:"lightning",energyTypeP2:"colorless"});
  s.turnPlayer="P1"; s.turnNumber=4; s.phase={kind:"main"};
  s.players.P1.active=toInPlay(CARD_POOL[id]!); s.players.P1.active.attached=["lightning","lightning"];
  s.players.P2.active=toInPlay(CARD_POOL["tai-tuivasa"]!);
  s.players.P1.bench=[toInPlay(CARD_POOL["justin-gaethje"]!)];
  s.players.P2.bench=[toInPlay(CARD_POOL["tai-tuivasa"]!)];
  return s;
}
describe("new fighter mechanics", () => {
  it("links Gaethje's Prospect to The Highlight Identity", () => {
    expect(getFighterStageLabel(CARD_POOL["justin-gaethje"]!)).toBe("Prospect");
    expect(getFighterStageLabel(CARD_POOL["the-highlight-ex"]!)).toBe("Identity");
    const s=battle("justin-gaethje"); s.players.P1.hand=[CARD_POOL["the-highlight-ex"]!];
    const evolved=applyMove(s,{type:"evolve",handIndex:0,targetUid:s.players.P1.active!.uid});
    expect(evolved.players.P1.active!.card.id).toBe("the-highlight-ex");
  });
  it("Slick Jab deals 20 damage without coin flips", () => {
    const s=battle();
    const n=applyMove(s,{type:"attack",attackId:"slick-jab"});
    expect(n.players.P2.active!.damage).toBe(20);
    expect(n.rngState).toBe(s.rngState);
    expect(n.events.slice(s.events.length).filter(e=>e.kind==="coinFlipped")).toHaveLength(0);
    expect(n.turnPlayer).toBe("P1"); expect(n.turnNumber).toBe(4);
  });
  it("Slick Jab ignores weakness in previews and actual hits, while Oblique Kick still applies it", () => {
    const s = battle();
    s.players.P2.active!.card = { ...s.players.P2.active!.card, weakness: "lightning" };
    const jab = s.players.P1.active!.card.attacks[0]!;
    expect(computeDamage(s.players.P1.active!, s.players.P2.active!, jab)).toBe(20);
    const first = applyMove(s, { type: "attack", attackId: "slick-jab" });
    expect(first.players.P2.active!.damage).toBe(20);
    expect(first.events.at(-1)).toMatchObject({ kind: "damageDealt", amount: 20, weakness: false });
    const second = applyMove(first, { type: "attack", attackId: "oblique-kick" });
    expect(second.players.P2.active!.damage).toBe(80);
    expect(second.events.slice(first.events.length).find(event => event.kind === "damageDealt")).toMatchObject({ amount: 60, weakness: true });
  });
  it("Slick Jab still applies other damage bonuses and reduction", () => {
    const s = battle();
    s.players.P2.active!.card = { ...s.players.P2.active!.card, weakness: "lightning" };
    s.players.P1.attackDamageBonus = 10;
    s.players.P2.active!.damageReduction = 10;
    s.players.P2.active!.damageVulnerability = { amount: 20, expiresAfterTurn: 6 };
    const jab = s.players.P1.active!.card.attacks[0]!;
    expect(computeDamage(s.players.P1.active!, s.players.P2.active!, jab, 0, [], 10)).toBe(40);
    expect(applyMove(s, { type: "attack", attackId: "slick-jab" }).players.P2.active!.damage).toBe(40);
  });
  it("allows two attacks, discards energy each kick, and only checks up after the second", () => {
    const s=battle(); s.players.P1.active!.bleeding=true; s.players.P1.active!.attached.push("lightning");
    const n=applyMove(s,{type:"attack",attackId:"oblique-kick"});
    expect(n.players.P1.active!.attached).toHaveLength(2);
    expect(n.players.P1.active!.damage).toBe(0);
    expect(n.players.P1.attacksUsedThisTurn).toBe(1);
    const last=applyMove(n,{type:"attack",attackId:"oblique-kick"});
    expect(last.turnPlayer).toBe("P2"); expect(last.players.P2.active!.damage).toBe(80);
    expect(last.players.P1.active!.damage).toBe(10);
    expect(last.players.P1.active!.attached).toHaveLength(1);
    expect(last.players.P1.discard.filter(e=>e.kind==="energy")).toHaveLength(2);
    expect(s.players.P1.active!.attached).toHaveLength(3);
  });
  it("zero heads deals no weakness damage", () => {
    const s=battle(); s.players.P2.active!.card={...s.players.P2.active!.card,weakness:"lightning"};
    const coinAttack={...s.players.P1.active!.card.attacks[0]!,damage:0,effects:[{kind:"coinDamagePerHeads" as const,coins:2,amount:20}]};
    expect(computeDamage(s.players.P1.active!,s.players.P2.active!,coinAttack,0)).toBe(0);
  });
  it("restores two attacks on Joshua's next turn", () => {
    const s=battle();
    let n=applyMove(s,{type:"attack",attackId:"slick-jab"});
    n=applyMove(n,{type:"attack",attackId:"slick-jab"});
    n=applyMove(n,{type:"pass"});
    expect(n.players.P1.attacksUsedThisTurn).toBe(0);
    expect(applyMove(n,{type:"attack",attackId:"slick-jab"}).turnPlayer).toBe("P1");
  });
  it("cannot reset Joshua's attack allowance by retreating to another Joshua", () => {
    const s=battle(); s.players.P1.bench=[toInPlay(CARD_POOL["joshua-van-ex"]!)];
    s.players.P1.bench[0]!.attached=["lightning"];
    let n=applyMove(s,{type:"attack",attackId:"slick-jab"});
    n=applyMove(n,{type:"retreat",benchIndex:0});
    expect(applyMove(n,{type:"attack",attackId:"slick-jab"}).turnPlayer).toBe("P2");
  });
  it("cannot use an unpaid second kick but can use Slick Jab", () => {
    const s=battle();
    const n=applyMove(s,{type:"attack",attackId:"oblique-kick"});
    expect(getLegalMoves(n)).not.toContainEqual({type:"attack",attackId:"oblique-kick"});
    expect(getLegalMoves(n)).toContainEqual({type:"attack",attackId:"slick-jab"});
    expect(applyMove(n,{type:"pass"}).turnPlayer).toBe("P2");
  });
  it("keeps the attacking turn after an opponent promotes between attacks", () => {
    const s=battle(); s.players.P2.active!.damage=100;
    const n=applyMove(s,{type:"attack",attackId:"oblique-kick"});
    expect(n.phase).toEqual({kind:"awaitPromotion",player:"P2"}); expect(n.turnPlayer).toBe("P1");
    const promoted=applyMove(n,{type:"promote",benchIndex:0});
    expect(promoted.turnNumber).toBe(4); expect(promoted.turnPlayer).toBe("P1");
    expect(applyMove(promoted,{type:"attack",attackId:"slick-jab"}).turnPlayer).toBe("P2");
  });
  it("Left Hook deals 40 damage regardless of prior damage", () => {
    const s=battle("petr-yan"); s.players.P1.active!.attached=["psychic","psychic"];
    expect(computeDamage(s.players.P1.active!,s.players.P2.active!,s.players.P1.active!.card.attacks[0]!)).toBe(40);
    s.players.P2.active!.damage=10;
    expect(computeDamage(s.players.P1.active!,s.players.P2.active!,s.players.P1.active!.card.attacks[0]!)).toBe(40);
    expect(applyMove(s,{type:"attack",attackId:"left-hook"}).players.P2.active!.damage).toBe(50);
  });
  it("Download peeks without changing deck, seed, or turn and only works once while active", () => {
    const s=battle("petr-yan"); const move={type:"useAbility" as const,targetUid:s.players.P1.active!.uid};
    const n=applyMove(s,move);
    expect(n.players.P2.deck).toEqual(s.players.P2.deck); expect(n.rngState).toBe(s.rngState);
    expect(n.events.at(-1)).toEqual({kind:"deckPeeked",player:"P1",card:s.players.P2.deck[0]});
    expect(getLegalMoves(n)).not.toContainEqual(move);
    s.players.P2.deck=[]; expect(getLegalMoves(s)).not.toContainEqual(move);
    s.players.P2.deck=[CARD_POOL["tai-tuivasa"]!];
    s.players.P1.bench.push(s.players.P1.active!); s.players.P1.active=toInPlay(CARD_POOL["justin-gaethje"]!);
    expect(getLegalMoves(s)).not.toContainEqual(move);
  });
});
describe("Bleeding", () => {
  it.each([0,1,2,3])("Cutting Jab inflicts bleeding only on heads (%i)", seed => {
    const s=battle("justin-gaethje"); s.players.P1.active!.attached=["fighting"]; s.players.P2.active!.card={...s.players.P2.active!.card,weakness:null}; s.rngState=seed;
    const heads=nextFloat(seed).value<.5;
    // Synthetic attack keeps generic Bleeding coverage after Gaethje's rework.
    s.players.P1.active!.card = { ...s.players.P1.active!.card, attacks: [{ id: "cutting-jab", name: "Cutting Jab", cost: ["fighting"], damage: 10, effects: [{ kind: "coinBleed" }] }] };
    const n=applyMove(s,{type:"attack",attackId:"cutting-jab"});
    expect(n.players.P2.active!.damage).toBe(heads?20:10);
    expect(!!n.players.P2.active!.bleeding).toBe(heads);
    expect(n.rngState).toBe(nextFloat(seed).state);
  });
  it.each([0,10])("Dirty Boxing adds 30 only when the defender was already damaged (%i)", damage => {
    const s=battle("justin-gaethje-champion"); s.players.P1.active!.attached=["fighting","fighting","colorless"];
    s.players.P2.active!.card={...s.players.P2.active!.card,weakness:null};
    s.players.P2.active!.damage=damage;
    const n=applyMove(s,{type:"attack",attackId:"dirty-boxing"});
    expect(n.players.P2.active!.damage).toBe(damage+(damage>0?120:90));
    expect(n.players.P2.active!.bleeding).toBeUndefined();
    expect(n.rngState).toBe(s.rngState);
    expect(n.events.slice(s.events.length).some(event=>event.kind==="coinFlipped")).toBe(false);
  });
  it("persists across turns without flips and ignores reduction and weakness", () => {
    const s=battle(); s.players.P2.active!.bleeding=true; s.players.P2.active!.damageReduction=100;
    let n=applyMove(s,{type:"pass"}); n=applyMove(n,{type:"pass"});
    expect(n.players.P2.active!.damage).toBe(20); expect(n.players.P2.active!.bleeding).toBe(true);
    expect(n.rngState).toBe(s.rngState);
    expect(n.events.slice(s.events.length).some(e=>e.kind==="coinFlipped")).toBe(false);
  });
  it("stacks with Burn", () => {
    const s=battle(); s.players.P2.active!.bleeding=true; s.players.P2.active!.burned=true;
    expect(applyMove(s,{type:"pass"}).players.P2.active!.damage).toBe(30);
  });
  it("survives evolution but clears on retreat", () => {
    const s=battle("justin-gaethje"); s.players.P1.active!.bleeding=true; s.players.P1.hand=[CARD_POOL["the-highlight-ex"]!];
    const n=applyMove(s,{type:"evolve",handIndex:0,targetUid:s.players.P1.active!.uid});
    expect(n.players.P1.active!.bleeding).toBe(true);
    const retreated=applyMove(n,{type:"retreat",benchIndex:0});
    expect(retreated.players.P1.bench.at(-1)!.bleeding).toBe(false);
  });
  it("clears on an attack switch", () => {
    const s=battle("alexander-volkanovski"); s.players.P1.active!.bleeding=true;
    const n=applyMove(s,{type:"attack",attackId:"crafty-kickboxing",targetUid:s.players.P1.bench[0]!.uid});
    expect(n.players.P1.bench[0]!.bleeding).toBe(false);
  });
  it("can knock out an ex for two points during checkup", () => {
    const s=battle(); s.players.P2.active!.card=CARD_POOL["the-highlight-ex"]!; s.players.P2.active!.damage=s.players.P2.active!.card.hp-10; s.players.P2.active!.bleeding=true;
    const n=applyMove(s,{type:"pass"}); expect(n.players.P1.points).toBe(2);
    expect(n.phase).toEqual({kind:"awaitPromotion",player:"P2"});
  });
});
