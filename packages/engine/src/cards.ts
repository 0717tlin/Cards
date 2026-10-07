// Original creature pool and two fixed decks. All names/creatures are original
// placeholders — no real Pokemon IP. Basic creatures only this milestone.

import type { CreatureCard } from "./types.js";
import type { EnergyType } from "./types.js";

/**
 * Build a card definition. Defaults stage to "basic" and derives the art key
 * from the id (frontend resolves it, falling back to a placeholder).
 */
function creature(c: Omit<CreatureCard, "stage" | "art"> & Partial<Pick<CreatureCard, "stage" | "art">>): CreatureCard {
  return { stage: "basic", art: c.id, ...c };
}

// --- Card pool -------------------------------------------------------------

export const CARD_POOL: Record<string, CreatureCard> = {
  emberpup: creature({
    id: "emberpup",
    name: "Emberpup",
    type: "fire",
    hp: 60,
    weakness: "water",
    isEx: false,
    retreatCost: 1,
    attacks: [
      { id: "ember-nip", name: "Ember Nip", cost: ["fire"], damage: 20 },
      { id: "flare-rush", name: "Flare Rush", cost: ["fire", "colorless"], damage: 40 },
    ],
  }),
  cinderhorn: creature({
    id: "cinderhorn",
    name: "Cinderhorn",
    type: "fire",
    hp: 110,
    weakness: "water",
    isEx: true,
    retreatCost: 2,
    attacks: [
      { id: "gore", name: "Gore", cost: ["fire", "colorless"], damage: 50 },
      { id: "inferno-charge", name: "Inferno Charge", cost: ["fire", "fire", "colorless"], damage: 90 },
    ],
  }),
  tidefin: creature({
    id: "tidefin",
    name: "Tidefin",
    type: "water",
    hp: 70,
    weakness: "lightning",
    isEx: false,
    retreatCost: 1,
    attacks: [
      { id: "splash", name: "Splash", cost: ["water"], damage: 20 },
      { id: "tidal-slam", name: "Tidal Slam", cost: ["water", "colorless"], damage: 40 },
    ],
  }),
  glacierjaw: creature({
    id: "glacierjaw",
    name: "Glacierjaw",
    type: "water",
    hp: 120,
    weakness: "lightning",
    isEx: true,
    retreatCost: 3,
    attacks: [
      { id: "frost-bite", name: "Frost Bite", cost: ["water", "colorless"], damage: 50 },
      { id: "deluge", name: "Deluge", cost: ["water", "water", "colorless"], damage: 100 },
    ],
  }),
  sparkmouse: creature({
    id: "sparkmouse",
    name: "Sparkmouse",
    type: "lightning",
    hp: 60,
    weakness: "fighting",
    isEx: false,
    retreatCost: 1,
    attacks: [
      { id: "zap", name: "Zap", cost: ["lightning"], damage: 20 },
      { id: "thunder-jolt", name: "Thunder Jolt", cost: ["lightning", "colorless"], damage: 40 },
    ],
  }),
  leafling: creature({
    id: "leafling",
    name: "Leafling",
    type: "grass",
    hp: 70,
    weakness: "fire",
    isEx: false,
    retreatCost: 1,
    attacks: [
      { id: "vine-whip", name: "Vine Whip", cost: ["grass"], damage: 20 },
      { id: "razor-leaf", name: "Razor Leaf", cost: ["grass", "colorless"], damage: 40 },
    ],
  }),
  mystifox: creature({
    id: "mystifox",
    name: "Mystifox",
    type: "psychic",
    hp: 70,
    weakness: "psychic",
    isEx: false,
    retreatCost: 1,
    attacks: [
      { id: "confuse", name: "Confuse", cost: ["psychic"], damage: 20 },
      { id: "mind-blast", name: "Mind Blast", cost: ["psychic", "colorless"], damage: 40 },
    ],
  }),
  boulderfist: creature({
    id: "boulderfist",
    name: "Boulderfist",
    type: "fighting",
    hp: 90,
    weakness: "psychic",
    isEx: false,
    retreatCost: 2,
    attacks: [
      { id: "jab", name: "Jab", cost: ["fighting"], damage: 20 },
      { id: "quake-punch", name: "Quake Punch", cost: ["fighting", "colorless"], damage: 50 },
    ],
  }),

  // --- Evolution-line examples (data + viewer only this milestone) ----------
  // These demonstrate the stage/ability/evolvesFrom fields. Evolution is not
  // playable in battle yet, so they are NOT in the fixed decks.
  sproutkit: creature({
    id: "sproutkit",
    name: "Sproutkit",
    type: "grass",
    hp: 60,
    weakness: "fire",
    isEx: false,
    retreatCost: 1,
    attacks: [{ id: "tackle", name: "Tackle", cost: ["colorless"], damage: 10 }],
  }),
  bloomcat: creature({
    id: "bloomcat",
    name: "Bloomcat",
    type: "grass",
    hp: 90,
    weakness: "fire",
    isEx: false,
    retreatCost: 1,
    stage: "stage1",
    evolvesFrom: "sproutkit",
    attacks: [{ id: "leaf-slash", name: "Leaf Slash", cost: ["grass", "colorless"], damage: 40 }],
  }),
  verdantia: creature({
    id: "verdantia",
    name: "Verdantia",
    type: "grass",
    hp: 150,
    weakness: "fire",
    isEx: true,
    retreatCost: 2,
    stage: "stage2",
    evolvesFrom: "bloomcat",
    ability: {
      name: "Photosynthesis",
      text: "Once during your turn, you may attach 1 extra energy to this creature.",
    },
    attacks: [
      { id: "solar-beam", name: "Solar Beam", cost: ["grass", "grass", "colorless"], damage: 110 },
    ],
  }),
};

function repeat(card: CreatureCard, n: number): CreatureCard[] {
  return Array.from({ length: n }, () => card);
}

// --- Fixed decks (20 cards each) -------------------------------------------

/** Player deck: fire-themed, with a Cinderhorn EX. Energy type = fire. */
export const DECK_PLAYER: CreatureCard[] = [
  ...repeat(CARD_POOL.emberpup!, 10),
  ...repeat(CARD_POOL.cinderhorn!, 4),
  ...repeat(CARD_POOL.boulderfist!, 6),
];

/** AI deck: water-themed, with a Glacierjaw EX. Energy type = water. */
export const DECK_AI: CreatureCard[] = [
  ...repeat(CARD_POOL.tidefin!, 10),
  ...repeat(CARD_POOL.glacierjaw!, 4),
  ...repeat(CARD_POOL.sparkmouse!, 6),
];

export const PLAYER_ENERGY: EnergyType = "fire";
export const AI_ENERGY: EnergyType = "water";
