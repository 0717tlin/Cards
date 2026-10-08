import { beforeEach, describe, expect, it, vi } from 'vitest';
const memory=new Map<string,string>();
beforeEach(()=>{vi.resetModules();memory.clear();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)});vi.stubGlobal('crypto',{randomUUID:()=> 'new-deck'});});
describe('saved decks',()=>{
 it('deletes whole decks containing retired cards and preserves current decks',async()=>{
  const {useSavedDecks}=await import('./useSavedDecks');
  const starter=useSavedDecks.getState().decks[0]!;
  const retired={id:'retired',name:'Retired deck',selection:{...starter.selection,'retired-fighter':1},energyTypes:['water']};
  memory.set('card-battle.saved-decks.v1',JSON.stringify([starter,retired]));
  vi.resetModules();
  const fresh=await import('./useSavedDecks');
  expect(fresh.useSavedDecks.getState().decks).toEqual([starter]);
  expect(JSON.parse(memory.get('card-battle.saved-decks.v1')!)).toEqual([starter]);
 });
 it('persists an empty list when every saved deck contains retired cards',async()=>{
  memory.set('card-battle.saved-decks.v1',JSON.stringify([{id:'old',name:'Old deck',selection:{'retired-fighter':20}}]));
  const {useSavedDecks}=await import('./useSavedDecks');
  expect(useSavedDecks.getState().decks).toEqual([]);
  expect(memory.get('card-battle.saved-decks.v1')).toBe('[]');
  vi.resetModules();
  expect((await import('./useSavedDecks')).useSavedDecks.getState().decks).toEqual([]);
 });
 it('keeps retired decks out of the game when the cleanup cannot write storage',async()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify([{id:'old',name:'Old deck',selection:{'retired-fighter':20}}]),setItem:()=>{throw Error('blocked')}});
  const {useSavedDecks}=await import('./useSavedDecks');
  expect(useSavedDecks.getState().decks).toEqual([]);
 });
 it('persists selected energies and migrates old saved decks',async()=>{
  const {useSavedDecks}=await import('./useSavedDecks');
  const starter=useSavedDecks.getState().decks[0]!;
  useSavedDecks.getState().save(null,'Mixed',starter.selection,['fire','lightning']);
  vi.resetModules();
  const fresh=await import('./useSavedDecks');
  expect(fresh.useSavedDecks.getState().decks[1]!.energyTypes).toEqual(['fire','lightning']);
  memory.set('card-battle.saved-decks.v1',JSON.stringify([{id:'old',name:'Old',selection:starter.selection}]));
  vi.resetModules();
  expect((await import('./useSavedDecks')).useSavedDecks.getState().decks[0]!.energyTypes).toEqual(['fire']);
 });
 it('persists multiple decks, reloads them and updates an existing id',async()=>{const {useSavedDecks}=await import('./useSavedDecks');const starter=useSavedDecks.getState().decks[0]!;const id=useSavedDecks.getState().save(null,' Second Deck ',starter.selection);expect(id).toBe('new-deck');useSavedDecks.getState().save(id,'Renamed',starter.selection);expect(useSavedDecks.getState().decks).toHaveLength(2);vi.resetModules();const reloaded=await import('./useSavedDecks');expect(reloaded.useSavedDecks.getState().decks.map(d=>d.name)).toEqual(['Starter Deck','Renamed']);});
 it('rejects invalid decks without writing storage',async()=>{const {useSavedDecks}=await import('./useSavedDecks');expect(useSavedDecks.getState().save(null,'Bad',{})).toBeNull();expect(memory.size).toBe(0);});
 it('recovers from malformed stored data',async()=>{memory.set('card-battle.saved-decks.v1','not json');const {useSavedDecks}=await import('./useSavedDecks');expect(useSavedDecks.getState().decks[0]!.name).toBe('Starter Deck');});
 it('reports storage failures without claiming the deck was saved',async()=>{const {useSavedDecks}=await import('./useSavedDecks');vi.stubGlobal('localStorage',{setItem:()=>{throw Error('full')}});const starter=useSavedDecks.getState().decks[0]!;expect(useSavedDecks.getState().save(null,'Test',starter.selection)).toBeNull();expect(useSavedDecks.getState().error).toContain("Couldn't save");expect(useSavedDecks.getState().decks).toHaveLength(1);});
});
