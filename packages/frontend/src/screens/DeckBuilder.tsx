import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ALL_CARD_POOL as CARD_POOL, isFighterCard, type CardDefinition } from "@card-game/engine";
import { Card, Pop, EnergyPip } from "../cards/Card";
import { CardZoom } from "../cards/CardZoom";
import { useDeckBuilder, DECK_SIZE, COPY_LIMIT } from "../deck/useDeckBuilder";
import { useBattleStore } from "../store/battleStore";
import { useAppView } from "../navigation/useAppView";
import { ENERGY_OPTIONS, useSavedDecks } from "../deck/useSavedDecks";

const ALL_CARDS: CardDefinition[] = Object.values(CARD_POOL);

export function DeckBuilder() {
  const selection = useDeckBuilder((s) => s.selection);
  const add = useDeckBuilder((s) => s.add);
  const remove = useDeckBuilder((s) => s.remove);
  const clear = useDeckBuilder((s) => s.clear);
  const build = useDeckBuilder((s) => s.build);
  const validation = useDeckBuilder((s) => s.validation)();
  const name = useDeckBuilder((s) => s.name);
  const setName = useDeckBuilder((s) => s.setName);
  const energyTypes = useDeckBuilder((s) => s.energyTypes);
  const toggleEnergy = useDeckBuilder((s) => s.toggleEnergy);
  const save = useSavedDecks((s) => s.save);
  const saveError = useSavedDecks((s) => s.error);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(false); }, [selection, name, energyTypes]);
  function saveDeck() {
    const id = save(useDeckBuilder.getState().editingId, name, selection, energyTypes);
    if (id) { useDeckBuilder.setState({editingId:id}); setSaved(true); }
  }

  const newGame = useBattleStore((s) => s.newGame);
  const setView = useAppView((s) => s.setView);

  const [zoomed, setZoomed] = useState<CardDefinition | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  function cancelHold() {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }
  useEffect(() => () => cancelHold(), []);

  const selectedEntries = Object.entries(selection);

  function startBattle() {
    const deck = build();
    if (!deck || !energyTypes.length) return;
    newGame({ humanDeck: deck, energyTypes });
    setView("battle");
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <h2>Deck Builder</h2>
        <div className="deck-status">
          <Pop value={validation.total} className={validation.legal ? "ok" : "warn"}>
            {validation.total}/{DECK_SIZE}
          </Pop>
          <button className="btn" onClick={clear} disabled={validation.total === 0}>
            Clear
          </button>
          <button className="btn btn--new" onClick={startBattle} disabled={!validation.legal || !energyTypes.length}>
            Battle with this deck
          </button>
        </div>
      </div>
      <div className="deck-save">
        <label>Deck name <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn btn--new" disabled={!validation.legal || !name.trim() || !energyTypes.length} onClick={saveDeck}>Save deck</button>
        <button className="btn" onClick={() => setView("deckSelection")}>Saved decks</button>
        {saved && <span className="ok small" role="status">Deck saved.</span>}
        {saveError && <span className="warn small" role="alert">{saveError}</span>}
      </div>
      <fieldset className="deck-energies"><legend>Energy types</legend>
        {ENERGY_OPTIONS.map(type => <label key={type}><input type="checkbox" checked={energyTypes.includes(type)} onChange={() => toggleEnergy(type)} /><EnergyPip type={type} />{type === "lightning" ? "Electric" : type[0]!.toUpperCase() + type.slice(1)}</label>)}
        <p className={energyTypes.length ? "muted small" : "warn small"}>{energyTypes.length ? "One selected type is generated each turn. Multiple types have an equal random chance." : "Select at least one energy type."}</p>
      </fieldset>

      {validation.issues.length > 0 && (
        <ul className="issues">
          {validation.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
      {validation.legal && <p className="ok small">Deck is legal — ready to battle.</p>}

      <div className="builder">
        <section className="builder__pool">
          <div className="slot-label">
            Click to add (max {COPY_LIMIT} each) · right-click to remove · hold to enlarge
          </div>
          <div className="card-grid card-grid--sm">
            {ALL_CARDS.map((c, i) => {
              const count = selection[c.id] ?? 0;
              const isBasic = isFighterCard(c) && c.stage === "basic";
              return (
                <motion.div
                  key={c.id}
                  className="pool-card"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 26 }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    cancelHold();
                    remove(c.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    cancelHold();
                    held.current = false;
                    holdOrigin.current = { x: e.clientX, y: e.clientY };
                    holdTimer.current = setTimeout(() => { held.current = true; setZoomed(c); }, 500);
                  }}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onPointerMove={(e) => {
                    const origin = holdOrigin.current;
                    if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 10) cancelHold();
                  }}
                >
                  <Card card={c} size="sm" onClick={() => { if (held.current) { held.current = false; return; } add(c.id); }} />
                  <div className="pool-card__meta">
                    <span className="muted small">
                      {isFighterCard(c) ? (isBasic ? "basic" : `${c.stage} · evolution`) : c.kind}
                    </span>
                    {count > 0 && (
                      <Pop value={count} className="count-badge">
                        ×{count}
                      </Pop>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <aside className="builder__deck">
          <div className="slot-label">Your deck</div>
          {selectedEntries.length === 0 && <p className="muted small">No cards yet.</p>}
          <ul className="deck-list">
            <AnimatePresence initial={false}>
              {selectedEntries.map(([id, count]) => (
                <motion.li
                  key={id}
                  layout
                  initial={{ opacity: 0, height: 0, x: -12 }}
                  animate={{ opacity: 1, height: "auto", x: 0 }}
                  exit={{ opacity: 0, height: 0, x: 12 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  onContextMenu={(e) => { e.preventDefault(); cancelHold(); remove(id); }}
                >
                  <span>
                    {CARD_POOL[id]?.name ?? id} <Pop value={count}>×{count}</Pop>
                  </span>
                  <button className="btn btn--sm" onClick={() => remove(id)}>
                    −
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </aside>
      </div>

      <CardZoom card={zoomed} onClose={() => setZoomed(null)} />
    </div>
  );
}
