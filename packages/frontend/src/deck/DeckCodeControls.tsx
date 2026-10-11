import { useRef, useState } from "react";
import { readSharedDeck, type SharedDeck } from "@card-game/engine";
import { Dialog } from "../screens/BattleDialogs";
import { useAppView } from "../navigation/useAppView";
import { useDeckBuilder } from "./useDeckBuilder";
import { useSavedDecks } from "./useSavedDecks";
import { createDeckCode, importDeckCode, DECK_CODE_PATTERN } from "./deckCodes";

export function CopyDeckCodeButton({ deck }: { deck: SharedDeck }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const job = useRef(0);
  function close() { job.current++; setOpen(false); }
  async function copy(code: string, current = job.current) {
    try {
      await navigator.clipboard.writeText(code);
      if (job.current === current) setMessage("Code copied to clipboard.");
    } catch { if (job.current === current) setMessage("Select the code above and copy it."); }
  }
  async function create() {
    const current = ++job.current;
    setOpen(true); setCode(""); setError(""); setMessage(""); setBusy(true);
    try {
      const code = await createDeckCode(deck);
      if (job.current !== current) return;
      setCode(code);
      await copy(code, current);
    } catch (error) { if (job.current === current) setError(error instanceof Error ? error.message : "Couldn't copy this deck."); }
    finally { if (job.current === current) setBusy(false); }
  }
  return <>
    <button className="btn" disabled={!readSharedDeck(deck)} onClick={create} aria-label={`Copy code for ${deck.name}`}>Copy code</button>
    {open && <Dialog title="Deck code" className="deck-code-dialog" onClose={close}>
      <p><strong>{deck.name}</strong></p>
      {busy && !code && <p className="muted" role="status">Creating code…</p>}
      {code && <>
        <input className="deck-code-value" aria-label="Deck code" value={code} readOnly onFocus={event => event.target.select()} />
        <p className="muted small">Paste this code into Import code to create a copy of the deck, including its energy types.</p>
        <button className="btn" onClick={() => copy(code)}>Copy to clipboard</button>
      </>}
      {message && <p className="ok small" role="status">{message}</p>}
      {error && <p className="warn small" role="alert">{error}</p>}
    </Dialog>}
  </>;
}

export function ImportDeckCodeButton() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const job = useRef(0);
  function close() { job.current++; setOpen(false); }
  async function importDeck() {
    const current = ++job.current;
    setBusy(true); setError("");
    try {
      const deck = await importDeckCode(code);
      if (job.current !== current) return;
      const store = useSavedDecks.getState();
      const id = store.save(null, deck.name, deck.selection, deck.energyTypes);
      if (!id) throw new Error(useSavedDecks.getState().error ?? "Couldn't save the imported deck.");
      useDeckBuilder.getState().load({ ...deck, id });
      setOpen(false);
      useAppView.getState().setView("builder");
    } catch (error) { if (job.current === current) setError(error instanceof Error ? error.message : "Couldn't import this deck."); }
    finally { if (job.current === current) setBusy(false); }
  }
  return <>
    <button className="btn" onClick={() => { job.current++; setOpen(true); setCode(""); setError(""); setBusy(false); }}>Import code</button>
    {open && <Dialog title="Import deck" className="deck-code-dialog" onClose={close}>
      <form onSubmit={event => { event.preventDefault(); if (!busy && DECK_CODE_PATTERN.test(code)) void importDeck(); }}>
        <label>Deck code<input className="deck-code-value" aria-label="Enter deck code" autoFocus maxLength={6} value={code} disabled={busy}
          autoComplete="off" spellCheck={false} placeholder="ABC123" onChange={event => setCode(event.target.value.trim().toUpperCase())} /></label>
        <p className="muted small">Import saves a new deck and opens it in the deck builder.</p>
        {error && <p className="warn small" role="alert">{error}</p>}
        <button type="submit" className="btn btn--new" disabled={busy || !DECK_CODE_PATTERN.test(code)}>{busy ? "Importing…" : "Import deck"}</button>
      </form>
    </Dialog>}
  </>;
}
