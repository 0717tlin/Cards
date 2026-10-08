// UFC fighter and trainer card pool, with two fixed starter decks.

import type { FighterCard, TrainerCard, CardDefinition } from "./types.js";
import type { EnergyType } from "./types.js";

/**
 * Build a card definition. Defaults stage to "basic" and derives the art key
 * from the id (frontend resolves it, falling back to a placeholder).
 */
function fighter(c: Omit<FighterCard, "stage" | "art"> & Partial<Pick<FighterCard, "stage" | "art">>): FighterCard {
  const rarity = c.rarity ?? (c.isEx ? "epic" : c.id === "ilia-topuria" ? "rare" : c.ability || c.attacks.some((attack) => attack.effects?.length) ? "uncommon" : "common");
  return { stage: "basic", art: c.id, ...c, rarity };
}

// --- Card pool -------------------------------------------------------------

export const CARD_POOL: Record<string, FighterCard> = {
  // Lesser-known contenders and veterans; basic attacks deal damage only.
  "benoit-saint-denis": fighter({
    id: "benoit-saint-denis", name: "Benoît Saint Denis", type: "fire", hp: 80,
    weakness: "water", isEx: false, retreatCost: 1,
    attacks: [
      { id: "bsd-jab", name: "Jab", cost: ["fire"], damage: 20 },
      { id: "bsd-elbow", name: "Elbow", cost: ["fire", "fire", "colorless"], damage: 50 },
    ],
  }),
  "renato-moicano": fighter({
    id: "renato-moicano", name: "Renato Moicano", type: "fire", hp: 80,
    weakness: "water", isEx: false, retreatCost: 1,
    attacks: [
      { id: "moicano-jab", name: "Jab", cost: ["fire"], damage: 20 },
      { id: "moicano-high-kick", name: "High Kick", cost: ["fire", "fire", "colorless"], damage: 50 },
    ],
  }),
  "brandon-royval": fighter({
    id: "brandon-royval", name: "Brandon Royval", type: "water", hp: 50,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [
      { id: "royval-jab", name: "Jab", cost: ["water"], damage: 20 },
      { id: "royval-knee", name: "Knee", cost: ["water", "water", "colorless"], damage: 40 },
    ],
  }),
  "amir-albazi": fighter({
    id: "amir-albazi", name: "Amir Albazi", type: "water", hp: 50,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [
      { id: "albazi-jab", name: "Jab", cost: ["water"], damage: 20 },
      { id: "albazi-cross", name: "Cross", cost: ["water", "water", "colorless"], damage: 40 },
    ],
  }),
  "dan-ige": fighter({
    id: "dan-ige", name: "Dan Ige", type: "grass", hp: 70,
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [
      { id: "ige-jab", name: "Jab", cost: ["grass"], damage: 20 },
      { id: "ige-overhand", name: "Overhand", cost: ["grass", "grass", "colorless"], damage: 50 },
    ],
  }),
  "melquizael-costa": fighter({
    id: "melquizael-costa", name: "Melquizael Costa", type: "grass", hp: 70,
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [
      { id: "costa-jab", name: "Jab", cost: ["grass"], damage: 20 },
      { id: "costa-hook", name: "Hook", cost: ["grass", "grass", "colorless"], damage: 50 },
    ],
  }),
  "tatsuro-taira": fighter({
    id: "tatsuro-taira", name: "Tatsuro Taira", type: "lightning", hp: 50,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [
      { id: "taira-jab", name: "Jab", cost: ["lightning"], damage: 20 },
      { id: "taira-roundhouse", name: "Roundhouse Kick", cost: ["lightning", "lightning", "colorless"], damage: 40 },
    ],
  }),
  "sumudaerji": fighter({
    id: "sumudaerji", name: "Sumudaerji", type: "lightning", hp: 50,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [
      { id: "sumudaerji-jab", name: "Jab", cost: ["lightning"], damage: 20 },
      { id: "sumudaerji-hook", name: "Hook", cost: ["lightning", "lightning", "colorless"], damage: 40 },
    ],
  }),
  "rinat-fakhretdinov": fighter({
    id: "rinat-fakhretdinov", name: "Rinat Fakhretdinov", type: "psychic", hp: 90,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [
      { id: "rinat-jab", name: "Jab", cost: ["psychic"], damage: 20 },
      { id: "rinat-cross", name: "Cross", cost: ["psychic", "psychic", "colorless"], damage: 50 },
    ],
  }),
  "anthony-hernandez": fighter({
    id: "anthony-hernandez", name: "Anthony Hernandez", type: "psychic", hp: 100,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [
      { id: "hernandez-jab", name: "Jab", cost: ["psychic"], damage: 20 },
      { id: "hernandez-cross", name: "Cross", cost: ["psychic", "psychic", "colorless"], damage: 50 },
    ],
  }),
  "khalil-rountree": fighter({
    id: "khalil-rountree", name: "Khalil Rountree Jr.", type: "fighting", hp: 110,
    weakness: "psychic", isEx: false, retreatCost: 2,
    attacks: [
      { id: "rountree-jab", name: "Jab", cost: ["fighting"], damage: 20 },
      { id: "rountree-kick", name: "Body Kick", cost: ["fighting", "fighting", "colorless"], damage: 40 },
    ],
  }),
  "roman-dolidze": fighter({
    id: "roman-dolidze", name: "Roman Dolidze", type: "fighting", hp: 100,
    weakness: "psychic", isEx: false, retreatCost: 2,
    attacks: [
      { id: "dolidze-jab", name: "Jab", cost: ["fighting"], damage: 20 },
      { id: "dolidze-hook", name: "Hook", cost: ["fighting", "fighting", "colorless"], damage: 40 },
    ],
  }),
  "azamat-murzakanov": fighter({
    id: "azamat-murzakanov", name: "Azamat Murzakanov", type: "fighting", hp: 110,
    weakness: "psychic", isEx: false, retreatCost: 2,
    attacks: [
      { id: "azamat-jab", name: "Jab", cost: ["fighting"], damage: 20 },
      { id: "azamat-hook", name: "Left Hook", cost: ["fighting", "fighting", "colorless"], damage: 40 },
    ],
  }),
  "sergei-pavlovich": fighter({
    id: "sergei-pavlovich", name: "Sergei Pavlovich", type: "colorless", hp: 120,
    weakness: "fighting", isEx: false, retreatCost: 3,
    attacks: [
      { id: "pavlovich-jab", name: "Jab", cost: ["colorless"], damage: 20 },
      { id: "pavlovich-overhand", name: "Overhand", cost: ["colorless", "colorless", "colorless"], damage: 50 },
    ],
  }),
  "sergey-spivak": fighter({
    id: "sergey-spivak", name: "Sergey Spivak", type: "colorless", hp: 120,
    weakness: "fighting", isEx: false, retreatCost: 3,
    attacks: [
      { id: "spivak-jab", name: "Jab", cost: ["colorless"], damage: 20 },
      { id: "spivak-overhand", name: "Overhand", cost: ["colorless", "colorless", "colorless"], damage: 50 },
    ],
  }),
  "giga-chikadze": fighter({
    id: "giga-chikadze", name: "Giga Chikadze", type: "psychic", hp: 60,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [{ id: "giga-kick", name: "Giga Kick", cost: ["psychic", "colorless"], damage: 60 }],
  }),
  "caio-borralho": fighter({
    id: "caio-borralho", name: "Caio Borralho", type: "lightning", hp: 80,
    weakness: "fighting", isEx: false, retreatCost: 2,
    attacks: [{ id: "clinch-knee", name: "Clinch Knee", cost: ["lightning"], damage: 20 }],
  }),
  "bobby-green": fighter({
    id: "bobby-green", name: "Bobby Green", type: "grass", hp: 60,
    rarity: "common",
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [{ id: "trash-talk", name: "Trash Talk", cost: ["grass"], damage: 0,
      effects: [{ kind: "burn" }],
      text: "Your opponent's active fighter is now Burned.",
    }],
  }),
  "khabib-nurmagomedov": fighter({
    id: "khabib-nurmagomedov", name: "Khabib Nurmagomedov", type: "water", hp: 80,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [{ id: "smother", name: "Smother", cost: ["water"], damage: 20,
      effects: [{ kind: "increaseRetreatCost", amount: 1 }],
      text: "During your opponent's next turn, their active fighter's Retreat Cost is 1 Colorless Energy more.",
    }],
  }),
  "islam-makhachev": fighter({
    id: "islam-makhachev", name: "Islam Makhachev", type: "fighting", hp: 90,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [{ id: "islam-calf-kick", name: "Calf Kick", cost: ["water"], damage: 30,
      effects: [{ kind: "benchDamageBonus", cardId: "khabib-nurmagomedov", amount: 10 }],
      text: "If Khabib Nurmagomedov is on your bench, this attack does 10 more damage.",
    }],
  }),
  "umar-nurmagomedov": fighter({
    id: "umar-nurmagomedov", name: "Umar Nurmagomedov", type: "water", hp: 60,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [{ id: "grapple", name: "Grapple", cost: ["water"], damage: 0,
      effects: [{ kind: "benchDamage", amount: 20, chooseWithCardId: "khabib-nurmagomedov" }],
      text: "Do 20 damage to a random fighter on your opponent's bench. If Khabib Nurmagomedov is on your bench, choose a fighter instead.",
    }],
  }),
  "islam-makhachev-ex": fighter({
    id: "islam-makhachev-ex", name: "Islam Makhachev ex", type: "fighting", hp: 160,
    weakness: "psychic", isEx: true, retreatCost: 2,
    attacks: [{ id: "darce", name: "D'arce", cost: ["water", "water", "colorless"], damage: 70,
      effects: [{ kind: "paralyzeAtOrBelowHp", hp: 30 }],
      text: "If the opponent's active fighter has 30 HP or less remaining after this attack, it is Paralyzed.",
    }],
  }),
  "charles-oliveira": fighter({
    id: "charles-oliveira", name: "Charles Oliveira", type: "lightning", hp: 60,
    rarity: "common",
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [{ id: "pull-guard", name: "Pull Guard", cost: ["lightning"], damage: 0,
      effects: [{ kind: "reduceIncomingDamage", amount: 10 }],
      text: "During your opponent's next turn, this fighter takes 10 less damage from attacks.",
    }],
  }),
  "do-bronx": fighter({
    id: "do-bronx", name: "Do Bronx", type: "lightning", hp: 130,
    weakness: "fighting", isEx: false, retreatCost: 1, stage: "stage1", evolvesFrom: "charles-oliveira",
    attacks: [
      { id: "calf-kick", name: "Calf Kick", cost: ["lightning"], damage: 40 },
      { id: "rear-naked-choke", name: "Rear-Naked Choke", cost: ["lightning", "lightning", "colorless"], damage: 60,
        effects: [{ kind: "coinDamageBonus", amount: 50 }],
        text: "Flip a coin. If heads, this attack does 50 more damage.",
      },
    ],
  }),
  merab: fighter({
    id: "merab", name: "Merab", type: "colorless", hp: 80,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [{ id: "single-leg", name: "Single Leg", cost: ["colorless"], damage: 20 }],
  }),
  "anshul-jubli": fighter({
    id: "anshul-jubli", name: "Anshul Jubli", type: "grass", hp: 60,
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [
      { id: "lion-jab", name: "Lion Jab", cost: ["colorless"], damage: 10 },
      { id: "do-not-redeem", name: "DO NOT REDEEM!!!", cost: ["colorless", "colorless"], damage: 20 },
    ],
  }),
  "tommy-mcmillan": fighter({
    id: "tommy-mcmillan", name: "Tommy McMillan", type: "colorless", hp: 80,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [{ id: "blitz", name: "Blitz", cost: ["colorless"], damage: 10,
      effects: [{ kind: "flipUntilTails", amount: 10 }],
      text: "Flip a coin until you get tails. This attack does 10 more damage for each heads.",
    }],
  }),
  "cm-punk": fighter({
    id: "cm-punk", name: "CM Punk", type: "colorless", hp: 50,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [
      { id: "punk-jab", name: "Jab", cost: ["colorless"], damage: 10 },
      { id: "go-to-sleep", name: "Go To Sleep", cost: ["colorless", "colorless", "colorless"], damage: 30 },
    ],
  }),
  "paddy-pimblett": fighter({
    id: "paddy-pimblett", name: "Paddy Pimblett", type: "fire", hp: 90,
    ability: {
      name: "Fattening Up",
      text: "Once during your turn, you may discard a Fire Energy attached to this fighter to heal 20 damage from it.",
      effect: { kind: "discardEnergyToHeal", energy: "fire", amount: 20 },
    },
    weakness: "water", isEx: false, retreatCost: 1,
    attacks: [
      { id: "paddy-jab", name: "Jab", cost: ["fire"], damage: 30 },
    ],
  }),
  "ilia-topuria": fighter({
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
        text: "This attack does 10 more damage for each Fire Energy attached to this fighter.",
      },
    ],
  }),

};

export const TRAINER_POOL: Record<string, TrainerCard> = {
  bandages: { id: "bandages", name: "Bandages", kind: "item", text: "Heal 20 damage from 1 of your fighters.", effect: { kind: "heal", amount: 20, target: "anyOwn" } },
  "footwork-drill": { id: "footwork-drill", name: "Footwork Drill", kind: "item", text: "During this turn, your active fighter's Retreat Cost is 1 energy less.", effect: { kind: "reduceRetreat", amount: 1 } },
  "dana-white": { id: "dana-white", name: "Dana White", kind: "supporter", text: "Draw 2 cards.", effect: { kind: "draw", count: 2 } },
  cutman: { id: "cutman", name: "Cutman", kind: "supporter", text: "Heal 30 damage from your active fighter.", effect: { kind: "heal", amount: 30, target: "active" } },
};

export const ALL_CARD_POOL: Record<string, CardDefinition> = { ...CARD_POOL, ...TRAINER_POOL };

function repeat<T extends CardDefinition>(card: T, n: number): T[] {
  return Array.from({ length: n }, () => card);
}

// --- Fixed decks (20 cards each) -------------------------------------------

/** Player starter deck: UFC fighters and trainers. Energy type = fire. */
export const DECK_PLAYER: CardDefinition[] = [
  ...repeat(CARD_POOL["ilia-topuria"]!, 4),
  ...repeat(TRAINER_POOL["dana-white"]!, 2),
  ...repeat(TRAINER_POOL["footwork-drill"]!, 2),
  ...repeat(TRAINER_POOL.bandages!, 2),
  ...repeat(TRAINER_POOL.cutman!, 2),
  ...repeat(CARD_POOL.merab!, 4),
  ...repeat(CARD_POOL["tommy-mcmillan"]!, 4),
];

/** AI deck: Dagestani fighters and colorless support. Energy type = water. */
export const DECK_AI: FighterCard[] = [
  ...repeat(CARD_POOL["khabib-nurmagomedov"]!, 4),
  ...repeat(CARD_POOL["islam-makhachev"]!, 4),
  ...repeat(CARD_POOL["islam-makhachev-ex"]!, 4),
  ...repeat(CARD_POOL.merab!, 4),
  ...repeat(CARD_POOL["tommy-mcmillan"]!, 4),
];

export const PLAYER_ENERGY: EnergyType = "fire";
export const AI_ENERGY: EnergyType = "water";
