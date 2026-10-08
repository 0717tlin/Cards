import { describe, expect, it } from "vitest";
import { CARD_POOL, applyMove, createBattle, getLegalMoves, actingPlayer, chooseMove } from "./index.js";
import { toInPlay } from "./setup.js";
import { nextFloat } from "./rng.js";
const bobby = CARD_POOL["bobby-green"]!;
const khabib = CARD_POOL["khabib-nurmagomedov"]!;
const ex = CARD_POOL["islam-makhachev-ex"]!;
function battle() {
  const state = createBattle({seed:12,deckP1:Array(20).fill(bobby),deckP2:Array(20).fill(khabib),energyTypeP1:"grass",energyTypeP2:"water"});
  state.turnPlayer = "P1";
  state.players.P1.active!.attached = ["grass"];
  state.players.P2.active!.attached = ["water"];
  state.players.P1.bench = [toInPlay(bobby)];
  state.players.P2.bench = [toInPlay(khabib)];
  return state;
}
describe("new fighters", () => {
  it.each([
    ["giga-chikadze",60,"psychic",1,"Giga Kick",["psychic","colorless"],60],
    ["caio-borralho",80,"lightning",2,"Clinch Knee",["lightning"],20],
    ["bobby-green",60,"grass",1,"Trash Talk",["grass"],0],
  ])("matches the requested stats for %s", (id,hp,type,retreatCost,name,cost,damage) => {
    expect(CARD_POOL[id as string]).toMatchObject({hp,type,retreatCost,attacks:[{name,cost,damage}]});
  });
});
describe("Burn and fighter checkup", () => {
  it.each([0,1,2,3,4,5])("applies 20 damage before the seeded flip and clears only on tails (%i)", seed => {
    const state = battle();
    state.rngState = seed;
    const snapshot = structuredClone(state);
    const roll = nextFloat(seed);
    const hit = applyMove(state,{type:"attack",attackId:"trash-talk"});
    expect(hit.players.P2.active!.damage).toBe(20);
    expect(hit.players.P2.active!.burned).toBe(roll.value < .5);
    expect(hit.rngState).toBe(roll.state);
    const events = hit.events.slice(state.events.length);
    const burnDamage = events.findIndex(event => event.kind === "damageDealt" && event.amount === 20);
    const flip = events.findIndex(event => event.kind === "coinFlipped");
    const turn = events.findIndex(event => event.kind === "turnStarted");
    expect(burnDamage).toBeLessThan(flip);
    expect(flip).toBeLessThan(turn);
    expect(events[flip]).toMatchObject({reason:"burn",result:roll.value < .5 ? "heads" : "tails"});
    expect(state).toEqual(snapshot);
  });
  it("requires Grass energy to use Trash Talk", () => {
    const state = battle();
    state.players.P1.active!.attached = ["water"];
    expect(getLegalMoves(state)).not.toContainEqual({type:"attack",attackId:"trash-talk"});
  });
  it("checks burn at both players' turn boundaries and allows attacks while burned", () => {
    let state = battle();
    let seed = 0;
    while (nextFloat(seed).value >= .5 || nextFloat(nextFloat(seed).state).value >= .5) seed++;
    state.rngState = seed;
    state = applyMove(state,{type:"attack",attackId:"trash-talk"});
    expect(state.players.P2.active!.burned).toBe(true);
    expect(getLegalMoves(state)).toContainEqual({type:"attack",attackId:"smother"});
    const next = applyMove(state,{type:"pass"});
    expect(next.players.P2.active!.damage).toBe(40);
    expect(next.players.P2.active!.burned).toBe(true);
  });
  it("ignores weakness and damage reduction, and does not burn bench fighters", () => {
    const state = battle();
    state.players.P2.active!.card = {...khabib,weakness:"grass"};
    state.players.P2.active!.damageReduction = 99;
    const hit = applyMove(state,{type:"attack",attackId:"trash-talk"});
    expect(hit.players.P2.active!.damage).toBe(20);
    expect(hit.players.P2.bench[0]!.damage).toBe(0);
    expect(hit.players.P2.bench[0]!.burned).toBeUndefined();
  });
  it("clearing Burn does not heal damage, and a cleared burn stops future damage", () => {
    const state = battle();
    let seed = 0;
    while(nextFloat(seed).value < .5) seed++;
    state.rngState = seed;
    const hit = applyMove(state,{type:"attack",attackId:"trash-talk"});
    expect(hit.players.P2.active!.burned).toBe(false);
    expect(hit.players.P2.active!.damage).toBe(20);
    expect(applyMove(hit,{type:"pass"}).players.P2.active!.damage).toBe(20);
  });
  it("burn on retreat clears before checkup", () => {
    const state = battle();
    state.players.P1.active!.burned = true;
    const retreated = applyMove(state,{type:"retreat",benchIndex:0});
    expect(retreated.players.P1.bench[0]!.burned).toBe(false);
    const next = applyMove(retreated,{type:"pass"});
    expect(next.players.P1.bench[0]!.damage).toBe(0);
  });
  it("evolving removes burn", () => {
    const state = battle();
    state.turnNumber = 4;
    state.players.P1.active!.card = CARD_POOL["charles-oliveira"]!;
    state.players.P1.active!.burned = true;
    state.players.P1.hand = [CARD_POOL["do-bronx"]!];
    const next = applyMove(state,{type:"evolve",handIndex:0,targetUid:state.players.P1.active!.uid});
    expect(next.players.P1.active!.burned).toBe(false);
  });
  it("scores ex knockouts, discards energy, flips after lethal damage and requires promotion", () => {
    const state = battle();
    state.players.P2.active!.card = ex;
    state.players.P2.active!.damage = 140;
    const hit = applyMove(state,{type:"attack",attackId:"trash-talk"});
    expect(hit.players.P1.points).toBe(2);
    expect(hit.players.P2.active).toBeNull();
    expect(hit.players.P2.discard).toContainEqual({kind:"fighter",card:ex});
    expect(hit.players.P2.discard).toContainEqual({kind:"energy",energy:"water"});
    expect(hit.events.some(event => event.kind === "coinFlipped" && event.reason === "burn")).toBe(true);
    expect(hit.phase).toEqual({kind:"awaitPromotion",player:"P2"});
    const promoted = applyMove(hit,{type:"promote",benchIndex:0});
    expect(promoted.phase).toEqual({kind:"main"});
    expect(promoted.turnPlayer).toBe("P2");
  });
  it.each(["points","noFighters"])("burn checkup can win by %s", reason => {
    const state = battle();
    state.players.P2.active!.damage = 60;
    if(reason === "points") state.players.P1.points = 2;
    else state.players.P2.bench = [];
    const hit = applyMove(state,{type:"attack",attackId:"trash-talk"});
    expect(hit.winner).toBe("P1");
    expect(hit.events.at(-1)).toMatchObject({kind:"gameWon",reason});
  });
  it("handles both active fighters being knocked out and both players promoting", () => {
    const state = battle();
    state.players.P1.active!.damage = 40;
    state.players.P1.active!.burned = true;
    state.players.P2.active!.damage = 60;
    state.players.P2.active!.burned = true;
    const hit = applyMove(state,{type:"pass"});
    expect(hit.players.P1.active).toBeNull();
    expect(hit.players.P2.active).toBeNull();
    expect(hit.players.P1.points).toBe(1);
    expect(hit.players.P2.points).toBe(1);
    expect(actingPlayer(hit)).toBe("P2");
    const first = applyMove(hit,{type:"promote",benchIndex:0});
    expect(actingPlayer(first)).toBe("P1");
    const second = applyMove(first,{type:"promote",benchIndex:0});
    expect(second.phase).toEqual({kind:"main"});
    expect(second.turnPlayer).toBe("P2");
  });
  it("preserves both required promotions when an attack KO is followed by a burn KO", () => {
    const state = battle();
    state.players.P1.active!.card = CARD_POOL["giga-chikadze"]!;
    state.players.P1.active!.attached = ["psychic","grass"];
    state.players.P1.active!.burned = true;
    state.players.P1.active!.damage = 40;
    state.players.P2.active!.damage = 20;
    const hit = applyMove(state,{type:"attack",attackId:"giga-kick"});
    expect(hit.players.P1.active).toBeNull();
    expect(hit.players.P2.active).toBeNull();
    const first = applyMove(hit,{type:"promote",benchIndex:0});
    expect(first.phase).toEqual({kind:"awaitPromotion",player:"P1"});
  });
  it("lets AI evaluate Trash Talk as a damaging effect", () => {
    const state = battle();
    state.players.P1.hand = [];
    state.players.P1.pendingEnergy = null;
    expect(chooseMove(state)).toEqual({type:"attack",attackId:"trash-talk"});
  });
});
