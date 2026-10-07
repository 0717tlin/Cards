import { useState } from "react";
import { motion } from "motion/react";
import { ALL_CARD_POOL as CARD_POOL, isCreatureCard, type CardDefinition, type EnergyType } from "@card-game/engine";
import { Card } from "../cards/Card";
import { CardZoom } from "../cards/CardZoom";
import { ENERGY_SYMBOL } from "../cards/cardArt";

const ALL_CARDS: CardDefinition[] = Object.values(CARD_POOL);
const TYPES: EnergyType[] = ["fire", "water", "grass", "lightning", "psychic", "fighting"];

export function CardViewer() {
  const [filter, setFilter] = useState<EnergyType | "all" | "item" | "supporter">("all");
  const [zoomed, setZoomed] = useState<CardDefinition | null>(null);
  const cards = filter === "all" ? ALL_CARDS : ALL_CARDS.filter((c) => isCreatureCard(c) ? c.type === filter : c.kind === filter);

  return (
    <div className="screen">
      <div className="screen__header">
        <h2>Card Viewer</h2>
        <div className="filter-row">
          <button
            className={`chip${filter === "all" ? " chip--on" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({ALL_CARDS.length})
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              className={`chip${filter === t ? " chip--on" : ""}`}
              onClick={() => setFilter(t)}
            >
              {ENERGY_SYMBOL[t]} {t}
            </button>
          ))}
          {(["item", "supporter"] as const).map((kind) => <button key={kind}
            className={`chip${filter === kind ? " chip--on" : ""}`} onClick={() => setFilter(kind)}>
            {kind === "item" ? "Items" : "Supporters"}
          </button>)}
        </div>
      </div>

      {/* Keyed by filter so the grid re-staggers in whenever the filter changes. */}
      <div className="card-grid" key={filter}>
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
        {cards.length === 0 && <p className="muted">No cards of this type.</p>}
      </div>

      <CardZoom card={zoomed} onClose={() => setZoomed(null)} />
    </div>
  );
}
