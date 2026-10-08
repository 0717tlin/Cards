import { create } from "zustand";
import { ALL_CARD_POOL, type CardDefinition, type EnergyType } from "@card-game/engine";
import { buildDeck, validateDeck, DECK_SIZE, COPY_LIMIT, type SavedDeck, type DeckSelection } from "./useSavedDecks";
export { DECK_SIZE, COPY_LIMIT } from "./useSavedDecks";
export type DeckValidation = ReturnType<typeof validateDeck>;
interface DeckBuilderStore {
 selection: DeckSelection;
 editingId: string | null;
 name: string;
 energyTypes: EnergyType[];
 toggleEnergy: (type: EnergyType) => void;
 setName: (name: string) => void;
 load: (deck: SavedDeck) => void;
 newDeck: () => void;
 add: (id: string) => void;
 remove: (id: string) => void;
 clear: () => void;
 validation: () => DeckValidation;
 build: () => CardDefinition[] | null;
}
export const useDeckBuilder = create<DeckBuilderStore>((set,get)=>({
 selection:{},editingId:null,name:"My Deck",energyTypes:["fire"],
 toggleEnergy:type=>set({energyTypes:get().energyTypes.includes(type)?get().energyTypes.filter(t=>t!==type):[...get().energyTypes,type]}),
 setName:name=>set({name}),
 load:deck=>set({selection:{...deck.selection},editingId:deck.id,name:deck.name,energyTypes:[...deck.energyTypes]}),
 newDeck:()=>set({selection:{},editingId:null,name:"My Deck",energyTypes:["fire"]}),
 add:id=>{if(!ALL_CARD_POOL[id])return;const count=get().selection[id]??0;if(count>=COPY_LIMIT||Object.values(get().selection).reduce((a,b)=>a+b,0)>=DECK_SIZE)return;set({selection:{...get().selection,[id]:count+1}})},
 remove:id=>{const count=get().selection[id]??0;if(!count)return;const selection={...get().selection};if(count===1)delete selection[id];else selection[id]=count-1;set({selection})},
 clear:()=>set({selection:{}}),
 validation:()=>validateDeck(get().selection),
 build:()=>buildDeck(get().selection),
}));
