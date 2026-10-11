import { useState } from "react";
import { motion } from "motion/react";
import { ALL_CARD_POOL as CARD_POOL, type CardDefinition } from "@card-game/engine";
import { Card } from "../cards/Card";
import { CardZoom } from "../cards/CardZoom";
import { CardCatalogControls, useCardCatalog } from "../cards/CardCatalogControls";

const ALL_CARDS: CardDefinition[] = Object.values(CARD_POOL);

export function CardViewer() {
  const { cards, options, setOptions } = useCardCatalog(ALL_CARDS);
  const [zoomed, setZoomed] = useState<CardDefinition | null>(null);

  return (
    <div className="screen">
      <div className="screen__header">
        <h2>Card Viewer</h2>
      </div>
      <CardCatalogControls options={options} onChange={setOptions} count={cards.length} total={ALL_CARDS.length} />

      <div className="card-grid card-grid--viewer">
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 280, damping: 24 }}
          >
            <Card card={c} size="md" onClick={() => setZoomed(c)} />
          </motion.div>
        ))}
        {cards.length === 0 && <p className="muted">No cards match these filters.</p>}
      </div>

      <p className="muted small"><a href="/images/credits.html" target="_blank" rel="noopener noreferrer">Photo credits</a></p>
      <CardZoom card={zoomed} onClose={() => setZoomed(null)} />
    </div>
  );
}
