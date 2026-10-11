import { useMemo, useState } from "react";
import type { CardDefinition } from "@card-game/engine";
import { CARD_TYPES, CARD_RARITIES, DEFAULT_CATALOG_OPTIONS, filterAndSortCards, type CardCatalogOptions } from "./cardCatalog";
import { ENERGY_SYMBOL } from "./cardArt";

export function useCardCatalog(allCards: readonly CardDefinition[]) {
  const [options, setOptions] = useState<CardCatalogOptions>(DEFAULT_CATALOG_OPTIONS);
  const cards = useMemo(() => filterAndSortCards(allCards, options), [allCards, options]);
  return { cards, options, setOptions };
}

export function CardCatalogControls({ options, onChange, count, total }: {
  options: CardCatalogOptions;
  onChange: (options: CardCatalogOptions) => void;
  count: number;
  total: number;
}) {
  return <div className="card-catalog-controls">
    <label>Filter
      <select value={options.filter} onChange={event => onChange({ ...options, filter: event.target.value as CardCatalogOptions["filter"] })}>
        <option value="all">All Cards</option>
        <option value="fighter">All Fighters</option>
        {CARD_TYPES.map(type => <option key={type} value={type}>{ENERGY_SYMBOL[type]} {type === "lightning" ? "Electric" : type[0]!.toUpperCase() + type.slice(1)}</option>)}
        <option value="item">Items</option>
        <option value="supporter">Supporters</option>
      </select>
    </label>
    <label>Rarity
      <select value={options.rarity} onChange={event => onChange({ ...options, rarity: event.target.value as CardCatalogOptions["rarity"] })}>
        <option value="all">All Rarities</option>
        {CARD_RARITIES.map(rarity => <option key={rarity} value={rarity}>{rarity[0]!.toUpperCase() + rarity.slice(1)}</option>)}
      </select>
    </label>
    <label>Sort By
      <select value={options.sort} onChange={event => onChange({ ...options, sort: event.target.value as CardCatalogOptions["sort"] })}>
        <option value="type">Type</option>
        <option value="hp">HP</option>
        <option value="rarity">Rarity</option>
      </select>
    </label>
    <div className="card-catalog-controls__order">
      <span>Order</span>
      <button type="button" className="btn card-catalog-controls__toggle"
        aria-label="Descending sort order" aria-pressed={options.direction === "descending"}
        title={`Switch to ${options.direction === "ascending" ? "descending" : "ascending"} order`}
        onClick={() => onChange({ ...options, direction: options.direction === "ascending" ? "descending" : "ascending" })}>
        <span aria-hidden="true">{options.direction === "ascending" ? "↑" : "↓"}</span> {options.direction === "ascending" ? "Ascending" : "Descending"}
      </button>
    </div>
    <span className="muted small" role="status">{count} of {total} cards</span>
  </div>;
}
