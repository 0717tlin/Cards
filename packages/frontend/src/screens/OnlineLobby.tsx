import { useState } from "react";
import { validateDeckSelection } from "@card-game/engine";
import { useOnlineSession } from "../multiplayer/onlineSession";
import { useSavedDecks } from "../deck/useSavedDecks";
import { useAppView } from "../navigation/useAppView";
import { Dialog } from "./BattleDialogs";

export function OnlineLobby() {
  const { room, status, error, leaving, createRoom, joinRoom, ready, leave, reconnect } = useOnlineSession();
  const decks = useSavedDecks(store => store.decks);
  const validDecks = decks.filter(deck => validateDeckSelection(deck.selection).legal && deck.energyTypes.length);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [deckId, setDeckId] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const setView = useAppView(store => store.setView);
  const connecting = status === "connecting" || status === "reconnecting";
  const chosen = validDecks.find(deck => deck.id === deckId) ?? validDecks[0];
  const self = room?.players[room.seat];
  const opponent = room?.players[room.seat === "P1" ? "P2" : "P1"];

  return <section className="online-lobby">
    <div className="online-lobby__intro"><span className="online-lobby__eyebrow">PRIVATE MATCH</span>
      <h1>Bring a friend to the cage</h1>
      <p>Share a room code, choose your decks, and battle. Your seat is saved in this browser so you can reconnect.</p>
    </div>
    {error && <p className="online-message online-message--error" role="alert">{error}</p>}
    {connecting && <p className="online-message" role="status">{status === "reconnecting" ? "Reconnecting to your room…" : "Connecting…"}</p>}
    {!room ? <form className="online-panel" onSubmit={event => { event.preventDefault(); joinRoom(name, code); }}>
      <label htmlFor="guest-name">Guest name</label>
      <input id="guest-name" autoComplete="nickname" maxLength={24} placeholder="Your name" value={name} onChange={event => setName(event.target.value)} disabled={connecting} />
      <button type="button" className="btn btn--new" disabled={!name.trim() || connecting} onClick={() => createRoom(name)}>Create private room</button>
      <div className="online-panel__divider">or join a friend</div>
      <label htmlFor="room-code">Room code</label>
      <input id="room-code" className="online-code-input" autoComplete="off" maxLength={6} placeholder="ABC123" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} disabled={connecting} />
      <button type="submit" className="btn" disabled={!name.trim() || code.length !== 6 || connecting}>Join room</button>
    </form> : <div className="online-panel">
      <div className="online-room-code"><span>Room code</span><strong>{room.code}</strong>
        <button className="btn btn--sm" onClick={async () => { try { await navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>{copied ? "Copied!" : "Copy code"}</button>
      </div>
      <div className="online-guests">
        <div><strong>{self?.name} <small>(you)</small></strong><span>{status !== "connected" ? "Reconnecting…" : self?.ready ? "Ready" : "Choosing a deck"}</span></div>
        <div><strong>{opponent?.name ?? "Waiting for a friend…"}</strong><span>{!opponent ? "Share your room code" : !opponent.connected ? "Disconnected · seat reserved" : opponent.ready ? "Ready" : "Choosing a deck"}</span></div>
      </div>
      {room.status === "waiting" ? <>
        <label htmlFor="online-deck">Your deck</label>
        <select id="online-deck" value={chosen?.id ?? ""} onChange={event => setDeckId(event.target.value)} disabled={self?.ready || status !== "connected"}>
          {validDecks.length ? validDecks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>) : <option value="">No legal decks available</option>}
        </select>
        {!validDecks.length && <p className="muted">Create a legal 20-card deck with no more than two copies of a card.</p>}
        <button className="btn btn--new" disabled={status !== "connected" || (!self?.ready && !chosen)} onClick={() => ready(self?.ready ? null : chosen ?? null)}>{self?.ready ? "Not ready" : "Ready to battle"}</button>
        <p className="muted small">The match starts when both players are connected and ready.</p>
      </> : <button className="btn btn--new" onClick={() => setView("battle")}>{room.status === "finished" ? "View result" : "Return to battle"}</button>}
      {status !== "connected" && <button className="btn" onClick={reconnect}>Reconnect now</button>}
      <button className="btn" disabled={leaving} onClick={() => setConfirmLeave(true)}>{leaving ? "Leaving…" : "Leave room"}</button>
    </div>}
    {confirmLeave && <Dialog title="Leave room?" onClose={() => setConfirmLeave(false)}>
      <p>{room?.status === "playing" ? "Leaving ends the match and awards the win to your opponent. Refreshing or reconnecting keeps your seat instead." : "Leave this private room?"}</p>
      <div className="online-confirm"><button className="btn" onClick={() => setConfirmLeave(false)}>Stay</button><button className="btn btn--new" onClick={() => { leave(); setConfirmLeave(false); }}>Leave room</button></div>
    </Dialog>}
  </section>;
}
