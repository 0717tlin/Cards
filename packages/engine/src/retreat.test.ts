import { expect, it } from "vitest";
import { CARD_POOL, createBattle, applyMove, getLegalMoves, getRetreatCost } from "./index.js";
it.each(['merab','anshul-jubli','tommy-mcmillan','cm-punk'])('%s retreats for exactly one energy and preserves both fighters', id => {
 const card = CARD_POOL[id]!;
 const state = createBattle({seed:12,deckP1:Array(20).fill(card),deckP2:Array(20).fill(CARD_POOL["khabib-nurmagomedov"]!),energyTypeP1:'fire',energyTypeP2:'water'});
 state.phase={kind:'main'};state.turnPlayer='P1';state.turnNumber=4;
 const player=state.players.P1;
 player.active!.attached=['fire'];player.hasRetreated=false;
 player.bench=[{uid:'incoming',card:CARD_POOL["islam-makhachev-ex"]!,damage:20,attached:['water']}];
 const outgoing=player.active!.uid;
 expect(getRetreatCost(player)).toBe(card.retreatCost);
 expect(getLegalMoves(state)).toContainEqual({type:'retreat',benchIndex:0});
 const next=applyMove(state,{type:'retreat',benchIndex:0});
 expect(next.players.P1.active).toMatchObject({uid:'incoming',damage:20,attached:['water']});
 expect(next.players.P1.bench[0]).toMatchObject({uid:outgoing,attached:[]});
 expect(next.events.at(-1)).toMatchObject({kind:'retreated',paid:['fire']});
 expect(getRetreatCost(next.players.P1)).toBe(2);
 expect(player.active!.attached).toEqual(['fire']);
});
