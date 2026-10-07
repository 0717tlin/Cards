import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ALL_CARD_POOL as CARD_POOL, isCreatureCard, type CardDefinition } from "@card-game/engine";
import { Card, Pop } from "../cards/Card";
import { CardZoom } from "../cards/CardZoom";
import { useDeckBuilder, DECK_SIZE, COPY_LIMIT } from "../deck/useDeckBuilder";
import { useBattleStore } from "../store/battleStore";
import { useAppView } from "../navigation/useAppView";

const ALL_CARDS: CardDefinition[] = Object.values(CARD_POOL);

export function DeckBuilder() {
  const selection = useDeckBuilder((s) => s.selection);
  const add = useDeckBuilder((s) => s.add);
  const remove = useDeckBuilder((s) => s.remove);
  const clear = useDeckBuilder((s) => s.clear);
  const build = useDeckBuilder((s) => s.build);
  const validation = useDeckBuilder((s) => s.validation)();

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
    if (!deck) return;
    newGame({ humanDeck: deck });
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
          <button className="btn btn--new" onClick={startBattle} disabled={!validation.legal}>
            Battle with this deck
          </button>
        </div>
      </div>

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
              const isBasic = isCreatureCard(c) && c.stage === "basic";
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
                    <span className={isBasic || !isCreatureCard(c) ? "muted small" : "warn small"}>
                      {isCreatureCard(c) ? (isBasic ? "basic" : `${c.stage} · not battle-legal yet`) : c.kind}
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
