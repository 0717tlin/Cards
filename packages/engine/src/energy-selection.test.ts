import { expect, it } from 'vitest';
import { createBattle, CARD_POOL, applyMove } from './index.js';
import { beginTurn } from './turn.js';
import { nextInt } from './rng.js';
function fixture(){const s=createBattle({seed:12,deckP1:Array(20).fill(CARD_POOL.merab!),deckP2:Array(20).fill(CARD_POOL.merab!),energyTypeP1:'fire',energyTypeP2:'water',energyTypesP1:['fire','lightning','fire']});s.turnPlayer='P1';return s;}
it('uses seeded uniform selection, deduplicates types and leaves input untouched',()=>{const s=fixture(),old=structuredClone(s);expect(s.players.P1.energyTypes).toEqual(['fire','lightning']);const roll=nextInt(s.rngState,2);const n=beginTurn(s);expect(n.players.P1.pendingEnergy).toBe(['fire','lightning'][roll.value]);expect(n.rngState).toBe(roll.state);expect(s).toEqual(old);expect(beginTurn(s)).toEqual(n);});
it('generates only selected energies and samples both across turns',()=>{let s=fixture();const seen=new Set();for(let i=0;i<60;i++){s=beginTurn(s);seen.add(s.players.P1.pendingEnergy);s=applyMove(s,{type:'pass'});s=applyMove(s,{type:'pass'});}expect([...seen].sort()).toEqual(['fire','lightning']);});
it('single energy does not consume randomness and opening turn produces none',()=>{const s=fixture();s.players.P1.energyTypes=['grass'];const n=beginTurn(s);expect(n.players.P1.pendingEnergy).toBe('grass');expect(n.rngState).toBe(s.rngState);s.turnNumber=0;expect(beginTurn(s).players.P1.pendingEnergy).toBeNull();});
