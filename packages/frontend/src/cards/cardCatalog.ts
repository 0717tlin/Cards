import { isFighterCard, type CardDefinition, type CardRarity, type EnergyType } from "@card-game/engine";

export const CARD_TYPES: EnergyType[] = ["fire", "water", "grass", "lightning", "psychic", "fighting", "colorless"];
export const CARD_RARITIES: CardRarity[] = ["common", "uncommon", "rare", "epic"];
export type CardFilter = "all" | "fighter" | EnergyType | "item" | "supporter";
export interface CardCatalogOptions {
  filter: CardFilter;
  rarity: "all" | CardRarity;
  sort: "type" | "hp" | "rarity";
  direction: "ascending" | "descending";
}
export const DEFAULT_CATALOG_OPTIONS: CardCatalogOptions = {
  filter: "all", rarity: "all", sort: "type", direction: "ascending",
};

function typeRank(card: CardDefinition): number {
  return isFighterCard(card) ? CARD_TYPES.indexOf(card.type) : CARD_TYPES.length + (card.kind === "supporter" ? 1 : 0);
}

/** Trainer cards have no HP and stay after fighters when sorting by HP. */
export function filterAndSortCards(cards: readonly CardDefinition[], options: CardCatalogOptions): CardDefinition[] {
  return cards.filter(card => {
    const matchesType = options.filter === "all" || (isFighterCard(card)
      ? options.filter === "fighter" || card.type === options.filter
      : card.kind === options.filter);
    return matchesType && (options.rarity === "all" || (card.rarity ?? "common") === options.rarity);
  }).sort((a, b) => {
    let difference = 0;
    switch (options.sort) {
      case "type": difference = typeRank(a) - typeRank(b); break;
      case "rarity": difference = CARD_RARITIES.indexOf(a.rarity ?? "common") - CARD_RARITIES.indexOf(b.rarity ?? "common"); break;
      case "hp": {
        const fighterA = isFighterCard(a);
        const fighterB = isFighterCard(b);
        if (fighterA !== fighterB) return fighterA ? -1 : 1;
        if (fighterA && fighterB) difference = a.hp - b.hp;
        break;
      }
    }
    return difference * (options.direction === "ascending" ? 1 : -1)
      || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
