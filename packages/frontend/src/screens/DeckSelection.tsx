import { useState } from "react";
import { ALL_CARD_POOL } from "@card-game/engine";
import { useSavedDecks, buildDeck, validateDeck } from "../deck/useSavedDecks";
import { useDeckBuilder } from "../deck/useDeckBuilder";
import { useBattleStore } from "../store/battleStore";
import { useAppView } from "../navigation/useAppView";
import { Dialog } from "./BattleDialogs";
import { CopyDeckCodeButton, ImportDeckCodeButton } from "../deck/DeckCodeControls";
export function DeckSelection() {
 const decks=useSavedDecks(s=>s.decks);
 const deleteDeck=useSavedDecks(s=>s.deleteDeck);
 const error=useSavedDecks(s=>s.error);
 const [deletingId,setDeletingId]=useState<string|null>(null);
 const setView=useAppView(s=>s.setView);
 const newGame=useBattleStore(s=>s.newGame);
 const deletingDeck=decks.find(deck=>deck.id===deletingId);
 return <div className="screen deck-select">
  <div className="screen__header"><h2>Choose your deck</h2><div className="deck-select__actions"><ImportDeckCodeButton /><button className="btn" onClick={()=>{useDeckBuilder.getState().newDeck();setView("builder")}}>Create deck</button></div></div>
  <p className="muted small">Decks are saved in this browser.</p>
  {error && !deletingDeck && <p className="warn small" role="alert">{error}</p>}
  {decks.length === 0 && <p className="muted">No saved decks. Create a UFC fighter deck to start playing.</p>}
  <div className="deck-select__list">{decks.map(deck=>{
   const validation=validateDeck(deck.selection);
   return <article className="deck-select__deck" key={deck.id}>
    <h3>{deck.name}</h3><span className="muted small">{validation.total} cards</span>
    <p className="small">Energy: {deck.energyTypes.map(type => type === "lightning" ? "Electric" : type[0]!.toUpperCase() + type.slice(1)).join(" · ")}</p>
    <div className="deck-select__cards">{Object.entries(deck.selection).map(([id,count])=><span key={id}>{count} × {ALL_CARD_POOL[id]?.name??id}</span>)}</div>
    {!validation.legal&&<p className="warn small">{validation.issues.join(" ")}</p>}
    <div className="deck-select__actions"><button className="btn btn--new" disabled={!validation.legal} onClick={()=>{const cards=buildDeck(deck.selection);if(cards){newGame({humanDeck:cards,energyTypes:deck.energyTypes});setView("battle")}}}>Play with {deck.name}</button><button className="btn" aria-label={`Edit ${deck.name}`} onClick={()=>{useDeckBuilder.getState().load(deck);setView("builder")}}>Edit</button>
     <button className="btn" aria-label={`Delete ${deck.name}`} onClick={()=>setDeletingId(deck.id)}>Delete</button>
     <CopyDeckCodeButton deck={deck} />
    </div>
   </article>
  })}</div>
  {deletingDeck && <Dialog title="Delete deck?" className="deck-delete-dialog" onClose={()=>setDeletingId(null)}>
   <p>Delete <strong>{deletingDeck.name}</strong>?</p>
   {error && <p className="warn small" role="alert">{error}</p>}
   <div className="deck-select__actions">
    <button className="btn" onClick={()=>setDeletingId(null)}>Cancel</button>
    <button className="btn" aria-label={`Confirm deletion of ${deletingDeck.name}`} onClick={()=>{if(deleteDeck(deletingDeck.id)){if(useDeckBuilder.getState().editingId===deletingDeck.id)useDeckBuilder.getState().newDeck();setDeletingId(null)}}}>Delete deck</button>
   </div>
  </Dialog>}
 </div>;
}
