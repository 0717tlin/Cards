// Original creature pool and two fixed decks. All names/creatures are original
// placeholders — no real Pokemon IP. Basic creatures only this milestone.

import type { CreatureCard, TrainerCard, CardDefinition } from "./types.js";
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
  merab: creature({
    id: "merab", name: "Merab", type: "colorless", hp: 80,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [{ id: "single-leg", name: "Single leg", cost: ["colorless"], damage: 20 }],
  }),
  "anshul-jubli": creature({
    id: "anshul-jubli", name: "Anshul Jubli", type: "grass", hp: 60,
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [
      { id: "lion-jab", name: "Lion Jab", cost: ["colorless"], damage: 10 },
      { id: "do-not-redeem", name: "DO NOT REDEEM!!!", cost: ["colorless", "colorless"], damage: 20 },
    ],
  }),
  "tommy-mcmillan": creature({
    id: "tommy-mcmillan", name: "Tommy mcmillan", type: "colorless", hp: 80,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [{ id: "blitz", name: "Blitz", cost: ["colorless"], damage: 10,
      effects: [{ kind: "flipUntilTails", amount: 10 }],
      text: "Flip a coin until you get tails. This attack does 10 more damage for each heads.",
    }],
  }),
  "cm-punk": creature({
    id: "cm-punk", name: "CM Punk", type: "colorless", hp: 50,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [
      { id: "punk-jab", name: "Jab", cost: ["colorless"], damage: 10 },
      { id: "go-to-sleep", name: "Go To Sleep", cost: ["colorless", "colorless", "colorless"], damage: 30 },
    ],
  }),
  "ilia-topuria": creature({
    id: "ilia-topuria",
    name: "Ilia Topuria",
    type: "fire",
    hp: 120,
    weakness: "water",
    isEx: false,
    retreatCost: 1,
    attacks: [
      { id: "ilia-jab", name: "Jab", cost: ["fire"], damage: 20 },
      {
        id: "right-hook",
        name: "Right Hook",
        cost: ["colorless", "colorless"],
        damage: 50,
        effects: [{ kind: "damagePerAttachedEnergy", energy: "fire", amount: 10 }],
        text: "This attack does 10 more damage for each Fire Energy attached to this mon.",
      },
    ],
  }),
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

export const TRAINER_POOL: Record<string, TrainerCard> = {
  bandages: { id: "bandages", name: "Bandages", kind: "item", text: "Heal 20 damage from 1 of your mons.", effect: { kind: "heal", amount: 20, target: "anyOwn" } },
  "footwork-drill": { id: "footwork-drill", name: "Footwork Drill", kind: "item", text: "During this turn, your active mon's Retreat Cost is 1 energy less.", effect: { kind: "reduceRetreat", amount: 1 } },
  "dana-white": { id: "dana-white", name: "Dana White", kind: "supporter", text: "Draw 2 cards.", effect: { kind: "draw", count: 2 } },
  cutman: { id: "cutman", name: "Cutman", kind: "supporter", text: "Heal 30 damage from your active mon.", effect: { kind: "heal", amount: 30, target: "active" } },
};

export const ALL_CARD_POOL: Record<string, CardDefinition> = { ...CARD_POOL, ...TRAINER_POOL };

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
