import { describe, expect, it } from "vitest";
import { CARD_POOL, TRAINER_POOL, type CardDefinition } from "@card-game/engine";
import { DEFAULT_CATALOG_OPTIONS, filterAndSortCards, type CardCatalogOptions } from "./cardCatalog";

const cards: CardDefinition[] = [
  CARD_POOL["tai-tuivasa"]!, CARD_POOL["joshua-van-ex"]!, TRAINER_POOL["herb-dean"]!,
  CARD_POOL["khabib-nurmagomedov"]!, CARD_POOL["justin-gaethje"]!, TRAINER_POOL["fight-contract"]!,
];
function ids(options: Partial<CardCatalogOptions> = {}) {
  return filterAndSortCards(cards, { ...DEFAULT_CATALOG_OPTIONS, ...options }).map(card => card.id);
}

describe("card catalog filters and sorting", () => {
  it("defaults to energy-type order followed by Items and Supporters", () => {
    expect(ids()).toEqual(["khabib-nurmagomedov", "joshua-van-ex", "justin-gaethje", "tai-tuivasa", "fight-contract", "herb-dean"]);
    expect(ids({ direction: "descending" })).toEqual(["herb-dean", "fight-contract", "tai-tuivasa", "justin-gaethje", "joshua-van-ex", "khabib-nurmagomedov"]);
  });
  it("combines type and rarity filters", () => {
    expect(ids({ filter: "water", rarity: "rare" })).toEqual(["khabib-nurmagomedov"]);
    expect(ids({ filter: "water", rarity: "epic" })).toEqual([]);
    expect(ids({ filter: "fighter", rarity: "common" })).toEqual(["justin-gaethje", "tai-tuivasa"]);
    expect(ids({ filter: "item" })).toEqual(["fight-contract"]);
    expect(ids({ filter: "supporter" })).toEqual(["herb-dean"]);
  });
  it("sorts HP in both directions, keeps trainers last, and breaks ties by name", () => {
    expect(ids({ sort: "hp" })).toEqual(["justin-gaethje", "khabib-nurmagomedov", "joshua-van-ex", "tai-tuivasa", "fight-contract", "herb-dean"]);
    expect(ids({ sort: "hp", direction: "descending" })).toEqual(["tai-tuivasa", "joshua-van-ex", "khabib-nurmagomedov", "justin-gaethje", "fight-contract", "herb-dean"]);
  });
  it("sorts rarity from Common to Epic or Epic to Common", () => {
    expect(ids({ sort: "rarity" })).toEqual(["fight-contract", "herb-dean", "justin-gaethje", "tai-tuivasa", "khabib-nurmagomedov", "joshua-van-ex"]);
    expect(ids({ sort: "rarity", direction: "descending" })).toEqual(["joshua-van-ex", "khabib-nurmagomedov", "fight-contract", "herb-dean", "justin-gaethje", "tai-tuivasa"]);
  });
  it("treats missing rarity as Common and does not mutate source cards", () => {
    const source = [{ ...TRAINER_POOL["herb-dean"]!, rarity: undefined }, ...cards];
    const before = source.slice();
    const results = filterAndSortCards(source, { ...DEFAULT_CATALOG_OPTIONS, rarity: "common", sort: "hp", direction: "descending" });
    expect(results).toHaveLength(5);
    expect(source).toEqual(before);
  });
});
