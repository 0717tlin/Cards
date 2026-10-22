import { describe, expect, it } from "vitest";
import { CARD_POOL, createBattle, reserveFighterUids } from "./index.js";
import { makeUid } from "./setup.js";

describe("restored battle fighter IDs", () => {
  it("reserves active, benched, and historical IDs before creating another fighter", () => {
    const state = createBattle({ seed: 1, deckP1: Array(20).fill(CARD_POOL.merab!), deckP2: Array(20).fill(CARD_POOL.merab!), energyTypeP1: "water", energyTypeP2: "water" });
    state.players.P1.active!.uid = "merab#80000";
    state.events.push({ kind: "fighterBenched", player: "P1", uid: "old-fighter#90000" });
    reserveFighterUids(state);
    expect(Number(makeUid("new-fighter").split("#")[1])).toBeGreaterThan(90000);
  });
});
