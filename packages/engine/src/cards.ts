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
  "sean-strickland": fighter({
    id: "sean-strickland", name: "Sean Strickland", hp: 60, type: "colorless", weakness: "fighting", isEx: false,
    rarity: "common", retreatCost: 1, stageLabel: "Prospect",
    attacks: [{ id: "strickland-jab", name: "Jab", cost: ["colorless"], damage: 10 }],
  }),
  "sean-strickland-contender": fighter({
    id: "sean-strickland-contender", name: "Sean Strickland", hp: 100, type: "colorless", weakness: "fighting", isEx: false,
    rarity: "uncommon", retreatCost: 2, stage: "stage1", stageLabel: "Contender", evolvesFrom: "sean-strickland", art: "sean-strickland",
    attacks: [{ id: "strickland-teep", name: "Teep", cost: ["colorless"], damage: 20 }],
  }),
  "sean-strickland-champion": fighter({
    id: "sean-strickland-champion", name: "Sean Strickland", hp: 150, type: "colorless", weakness: "fighting", isEx: false,
    rarity: "rare", retreatCost: 3, stage: "stage2", stageLabel: "Champion", evolvesFrom: "sean-strickland-contender", art: "sean-strickland",
    attacks: [{ id: "strickland-jab-teep", name: "Jab & Teep", cost: ["colorless", "colorless"], damage: 90 }],
    ability: { name: "Underdog", text: "If your opponent has more points than you, this fighter's attacks do 30 more damage.", effect: { kind: "damageBonusWhenBehindOnPoints", amount: 30 } },
  }),
  "israel-adesanya": fighter({
    id: "israel-adesanya", name: "Israel Adesanya", type: "psychic", hp: 70,
    weakness: "psychic", isEx: false, retreatCost: 1, rarity: "uncommon", isProspect: true,
    attacks: [{ id: "adesanya-feint", name: "Feint", cost: ["colorless"], damage: 0,
      effects: [{ kind: "increaseIncomingDamage", amount: 20 }],
      text: "During your next turn, your opponent's active fighter takes 20 more damage from attacks." }],
  }),
  "the-last-stylebender": fighter({
    id: "the-last-stylebender", name: "The Last Stylebender", type: "psychic", hp: 120,
    weakness: "psychic", isEx: false, retreatCost: 2, rarity: "rare", stage: "stage1", evolvesFrom: "israel-adesanya", art: "israel-adesanya",
    ability: { name: "Hatake", text: "This fighter may use the attacks of any non-ex fighter on your bench, as long as it has the required energy.", effect: { kind: "useNonExBenchAttacks" } },
    attacks: [],
  }),
  "paulo-costa": fighter({
    id: "paulo-costa", name: "Paulo Costa", type: "fighting", hp: 70,
    weakness: "psychic", isEx: false, retreatCost: 1, rarity: "common",
    attacks: [{ id: "costa-roundhouse-kick", name: "Roundhouse Kick", cost: ["fighting", "colorless"], damage: 40 }],
  }),
  "secret-juice": fighter({
    id: "secret-juice", name: "Secret Juice", type: "fighting", hp: 140,
    weakness: "psychic", isEx: false, retreatCost: 2, rarity: "uncommon", stage: "stage1", evolvesFrom: "paulo-costa",
    attacks: [{ id: "head-kick", name: "Head Kick", cost: ["fighting", "fighting", "colorless"], damage: 80 }],
  }),
  "connor-mcgregor": fighter({
    id: "connor-mcgregor", name: "Connor McGregor", type: "grass", hp: 80,
    weakness: "fire", isEx: false, retreatCost: 1, rarity: "rare",
    attacks: [{ id: "capoeira-kick", name: "Capoeira Kick", cost: ["grass", "grass"], damage: 0,
      effects: [{ kind: "discardAllSelfEnergy" }, { kind: "damageAnyFighter", amount: 50 }],
      text: "Discard all energy from this fighter. Do 50 damage to one of your opponent's fighters (active or benched)." }],
  }),
  "sean-omalley": fighter({
    id: "sean-omalley", name: "Sean O'Malley", type: "grass", hp: 60,
    weakness: "fire", isEx: false, retreatCost: 1, rarity: "uncommon",
    attacks: [{ id: "feint", name: "Feint", cost: ["colorless"], damage: 0,
      effects: [{ kind: "increaseIncomingDamage", amount: 20 }],
      text: "During your next turn, your opponent's active fighter takes 20 more damage from attacks." }],
  }),
  suga: fighter({
    id: "suga", name: "Suga", type: "grass", hp: 110,
    weakness: "fire", isEx: false, retreatCost: 1, rarity: "rare", stage: "stage1", evolvesFrom: "sean-omalley",
    attacks: [{ id: "suga-switch-kick", name: "Switch Kick", cost: ["grass", "grass"], damage: 70,
      effects: [{ kind: "switchWithBench" }],
      text: "Choose a fighter from your bench and switch it into the active spot." }],
  }),
  "joshua-van-ex": fighter({
    id: "joshua-van-ex", name: "Joshua Van ex", type: "lightning", hp: 110,
    weakness: "fighting", isEx: true, retreatCost: 1, rarity: "epic",
    ability: { name: "Relentless Pressure", text: "This fighter may attack twice in a turn.", effect: { kind: "attackTwice" } },
    attacks: [
      { id: "slick-jab", name: "Slick Jab", cost: ["lightning"], damage: 20,
        effects: [{ kind: "ignoreWeakness" }], text: "This attack is not affected by weakness." },
      { id: "oblique-kick", name: "Oblique Kick", cost: ["lightning", "lightning"], damage: 40,
        effects: [{ kind: "discardSelfEnergy", amount: 1 }], text: "Discard an energy from this fighter." },
    ],
  }),
  "petr-yan": fighter({
    id: "petr-yan", name: "Petr Yan", type: "psychic", hp: 70,
    weakness: "psychic", isEx: false, retreatCost: 1, rarity: "rare",
    ability: { name: "Download", text: "Once during your turn, if this fighter is active, you may look at the top card of your opponent's deck.", effect: { kind: "peekOpponentDeck" } },
    attacks: [{ id: "left-hook", name: "Left Hook", cost: ["psychic", "psychic"], damage: 40 }],
  }),
  "justin-gaethje": fighter({
    id: "justin-gaethje", name: "Justin Gaethje", type: "fighting", hp: 60,
    weakness: "psychic", isEx: false, retreatCost: 1, rarity: "common", stageLabel: "Prospect",
    attacks: [{ id: "gaethje-jab", name: "Jab", cost: ["fighting"], damage: 10 }],
  }),
  "justin-gaethje-contender": fighter({
    id: "justin-gaethje-contender", name: "Justin Gaethje", type: "fighting", hp: 90,
    weakness: "psychic", isEx: false, retreatCost: 1, rarity: "uncommon", stage: "stage1", stageLabel: "Contender", evolvesFrom: "justin-gaethje", art: "justin-gaethje",
    attacks: [{ id: "gaethje-cross", name: "Cross", cost: ["fighting", "fighting"], damage: 40 }],
  }),
  "justin-gaethje-champion": fighter({
    id: "justin-gaethje-champion", name: "Justin Gaethje", type: "fighting", hp: 140,
    weakness: "psychic", isEx: false, retreatCost: 2, rarity: "rare", stage: "stage2", stageLabel: "Champion", evolvesFrom: "justin-gaethje-contender", art: "justin-gaethje",
    attacks: [{ id: "dirty-boxing", name: "Dirty Boxing", cost: ["fighting", "fighting", "colorless"], damage: 90,
      effects: [{ kind: "damagedOpponentBonus", amount: 30 }], text: "If your opponent's active fighter has already taken damage, this attack does 30 more damage." }],
  }),
  "the-highlight-ex": fighter({
    id: "the-highlight-ex", name: "The Highlight ex", type: "fighting", hp: 140,
    weakness: "psychic", isEx: true, retreatCost: 2, rarity: "epic", stage: "stage1", evolvesFrom: "justin-gaethje",
    attacks: [{ id: "rolling-thunder", name: "Rolling Thunder", cost: ["fighting", "fighting", "colorless"], damage: 180,
      effects: [{ kind: "coinAttackFailsOnTails" }], text: "Flip a coin. If tails, this attack does nothing." }],
  }),
  "alexander-volkanovski": fighter({
    id: "alexander-volkanovski", name: "Alexander Volkanovski", type: "colorless", hp: 80,
    weakness: "fighting", isEx: false, retreatCost: 1, rarity: "rare",
    attacks: [{ id: "crafty-kickboxing", name: "Switch Kick", cost: ["colorless", "colorless"], damage: 40,
      effects: [{ kind: "switchWithBench" }],
      text: "Choose a fighter from your bench and switch it into the active spot.",
    }],
  }),
  "alexander-volkanovski-ex": fighter({
    id: "alexander-volkanovski-ex", name: "Alexander Volkanovski ex", type: "colorless", hp: 140,
    weakness: "fighting", isEx: true, retreatCost: 2, rarity: "epic",
    ability: {
      name: "A Land Down Under",
      text: "When this fighter moves from your bench to the active spot, attach one energy from your energy zone to it.",
      effect: { kind: "attachZoneEnergyOnBecomingActive" },
    },
    attacks: [{ id: "great-overhand", name: "Great Overhand", cost: ["colorless", "colorless", "colorless"], damage: 70 }],
  }),
  // Lesser-known contenders and veterans; basic attacks deal damage only.
  "benoit-saint-denis": fighter({
    id: "benoit-saint-denis", name: "Benoît Saint Denis", type: "fire", hp: 80,
    weakness: "water", isEx: false, retreatCost: 1,
    attacks: [
      { id: "bsd-elbow", name: "Elbow", cost: ["fire", "fire", "colorless"], damage: 50 },
    ],
  }),
  "renato-moicano": fighter({
    id: "renato-moicano", name: "Renato Moicano", type: "fire", hp: 80,
    weakness: "water", isEx: false, retreatCost: 1,
    attacks: [
      { id: "moicano-jab", name: "Jab", cost: ["fire"], damage: 20 },
    ],
  }),
  "brandon-royval": fighter({
    id: "brandon-royval", name: "Brandon Royval", type: "water", hp: 50,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [
      { id: "royval-knee", name: "Knee", cost: ["water", "colorless"], damage: 40 },
    ],
  }),
  "amir-albazi": fighter({
    id: "amir-albazi", name: "Amir Albazi", type: "water", hp: 50,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [
      { id: "albazi-jab", name: "Jab", cost: ["water"], damage: 20 },
    ],
  }),
  "dan-ige": fighter({
    id: "dan-ige", name: "Dan Ige", type: "grass", hp: 70,
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [
      { id: "ige-jab", name: "Jab", cost: ["grass"], damage: 20 },
    ],
  }),
  "melquizael-costa": fighter({
    id: "melquizael-costa", name: "Melquizael Costa", type: "grass", hp: 70,
    weakness: "fire", isEx: false, retreatCost: 1,
    attacks: [
      { id: "costa-hook", name: "Hook", cost: ["grass", "grass", "colorless"], damage: 50 },
    ],
  }),
  "tatsuro-taira": fighter({
    id: "tatsuro-taira", name: "Tatsuro Taira", type: "lightning", hp: 50,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [
      { id: "taira-jab", name: "Jab", cost: ["lightning"], damage: 20 },
    ],
  }),
  "sumudaerji": fighter({
    id: "sumudaerji", name: "Sumudaerji", type: "lightning", hp: 50,
    weakness: "fighting", isEx: false, retreatCost: 1,
    attacks: [
      { id: "sumudaerji-hook", name: "Hook", cost: ["lightning", "colorless"], damage: 40 },
    ],
  }),
  "rinat-fakhretdinov": fighter({
    id: "rinat-fakhretdinov", name: "Rinat Fakhretdinov", type: "psychic", hp: 90,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [
      { id: "rinat-jab", name: "Jab", cost: ["psychic"], damage: 20 },
    ],
  }),
  "anthony-hernandez": fighter({
    id: "anthony-hernandez", name: "Anthony Hernandez", type: "psychic", hp: 100,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [
      { id: "hernandez-cross", name: "Cross", cost: ["psychic", "psychic", "colorless"], damage: 50 },
    ],
  }),
  "khalil-rountree": fighter({
    id: "khalil-rountree", name: "Khalil Rountree Jr.", type: "fighting", hp: 110,
    weakness: "psychic", isEx: false, retreatCost: 2,
    attacks: [
      { id: "rountree-kick", name: "Body Kick", cost: ["fighting", "fighting", "colorless"], damage: 40 },
    ],
  }),
  "roman-dolidze": fighter({
    id: "roman-dolidze", name: "Roman Dolidze", type: "fighting", hp: 100,
    weakness: "psychic", isEx: false, retreatCost: 2,
    attacks: [
      { id: "dolidze-jab", name: "Jab", cost: ["fighting"], damage: 20 },
    ],
  }),
  "azamat-murzakanov": fighter({
    id: "azamat-murzakanov", name: "Azamat Murzakanov", type: "fighting", hp: 110,
    weakness: "psychic", isEx: false, retreatCost: 2,
    attacks: [
      { id: "azamat-hook", name: "Left Hook", cost: ["fighting", "fighting", "colorless"], damage: 40 },
    ],
  }),
  "sergei-pavlovich": fighter({
    id: "sergei-pavlovich", name: "Sergei Pavlovich", type: "colorless", hp: 130,
    weakness: "fighting", isEx: false, retreatCost: 3,
    attacks: [
      { id: "pavlovich-overhand", name: "Overhand", cost: ["colorless", "colorless", "colorless"], damage: 60 },
    ],
  }),
  "tai-tuivasa": fighter({
    id: "tai-tuivasa", name: "Tai Tuivasa", type: "colorless", hp: 140,
    weakness: "fighting", isEx: false, retreatCost: 4,
    attacks: [
      { id: "blobbing-out", name: "Blobbing Out", cost: ["colorless", "colorless", "colorless", "colorless"], damage: 70 },
    ],
  }),
  "giga-chikadze": fighter({
    id: "giga-chikadze", name: "Giga Chikadze", type: "psychic", hp: 60,
    weakness: "psychic", isEx: false, retreatCost: 1,
    attacks: [{ id: "giga-kick", name: "Giga Kick", cost: ["psychic", "colorless"], damage: 40 }],
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
  "king-green": fighter({
    id: "king-green", name: "King Green", type: "grass", hp: 110,
    rarity: "uncommon", weakness: "fire", isEx: false, retreatCost: 2,
    stage: "stage1", evolvesFrom: "bobby-green",
    attacks: [{ id: "ragebait-jab", name: "Ragebait Jab", cost: ["grass", "grass"], damage: 40,
      effects: [{ kind: "burn" }],
      text: "Your opponent's active fighter is now Burned.",
    }],
  }),
  "khabib-nurmagomedov": fighter({
    id: "khabib-nurmagomedov", name: "Khabib Nurmagomedov", type: "water", hp: 80,
    rarity: "rare",
    ability: {
      name: "From the Mountains of Caucasus",
      text: "As long as this fighter is in play, attacks from your Islam Makhachev and Umar Nurmagomedov cost 1 Colorless Energy less.",
      effect: { kind: "reduceNamedAttackCost", names: ["Islam Makhachev", "Umar Nurmagomedov"] },
    },
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [{ id: "khabib-single-leg", name: "Single Leg", cost: ["water"], damage: 10 }],
  }),
  "islam-makhachev-prospect": fighter({
    id: "islam-makhachev-prospect", name: "Islam Makhachev", type: "water", hp: 60, weakness: "lightning", isEx: false,
    rarity: "common", retreatCost: 1, stageLabel: "Prospect", art: "islam-makhachev",
    attacks: [{ id: "islam-jab", name: "Jab", cost: ["water"], damage: 10 }],
  }),
  "islam-makhachev-contender": fighter({
    id: "islam-makhachev-contender", name: "Islam Makhachev", type: "water", hp: 90, weakness: "lightning", isEx: false,
    rarity: "uncommon", retreatCost: 1, stage: "stage1", stageLabel: "Contender", evolvesFrom: "islam-makhachev-prospect", art: "islam-makhachev",
    attacks: [{ id: "soto-gari", name: "Soto Gari", cost: ["water", "colorless"], damage: 40 }],
  }),
  "islam-makhachev": fighter({
    id: "islam-makhachev", name: "Islam Makhachev", type: "water", hp: 140,
    rarity: "rare",
    weakness: "lightning", isEx: false, retreatCost: 2, stage: "stage2", stageLabel: "Champion", evolvesFrom: "islam-makhachev-contender",
    attacks: [{ id: "koshi-guruma", name: "Koshi Guruma", cost: ["water", "colorless"], damage: 80,
      effects: [{ kind: "preventRetreat" }],
      text: "The defending fighter can't retreat during your opponent's next turn.",
    }],
  }),
  "umar-nurmagomedov": fighter({
    id: "umar-nurmagomedov", name: "Umar Nurmagomedov", type: "water", hp: 60,
    weakness: "lightning", isEx: false, retreatCost: 1,
    attacks: [{ id: "umar-calf-kick", name: "Calf Kick", cost: ["colorless"], damage: 20,
      effects: [{ kind: "coinDamageBonus", amount: 20 }],
      text: "Flip a coin. If heads, this attack does 20 more damage.",
    }],
  }),
  "islam-makhachev-ex": fighter({
    id: "islam-makhachev-ex", name: "Islam Makhachev ex", type: "water", hp: 140,
    weakness: "lightning", isEx: true, retreatCost: 2,
    attacks: [{ id: "darce", name: "Father's D'arce", cost: ["water", "water", "colorless"], damage: 70,
      effects: [{ kind: "paralyzeAtOrBelowHp", hp: 40 }],
      text: "If the opponent's active fighter has 40 HP or less remaining after this attack, it is Paralyzed.",
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
    id: "do-bronx", name: "Do Bronx", type: "lightning", hp: 120,
    weakness: "fighting", isEx: false, retreatCost: 1, rarity: "rare", stage: "stage1", evolvesFrom: "charles-oliveira",
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

  "el-matador-ex": fighter({
    id: "el-matador-ex", name: "El Matador EX", type: "fire", hp: 180,
    weakness: "water", isEx: true, retreatCost: 2,
    stage: "stage1", evolvesFrom: "ilia-topuria",
    ability: {
      name: "Furioso",
      text: "When you attach a Fire Energy to this fighter, both active fighters are now Burned.",
      effect: { kind: "burnBothActivesOnEnergyAttachment", energy: "fire" },
    },
    attacks: [{ id: "infernal", name: "Infernal", cost: ["colorless", "colorless"], damage: 40,
      effects: [{ kind: "damagePerAttachedEnergy", energy: "fire", amount: 20 }],
      text: "This attack does 20 more damage for each Fire Energy attached to this fighter.",
    }],
  }),
};

/** Display roles follow evolution links or explicit Prospect designation. */
export function getFighterStageLabel(card: FighterCard): string {
  if (card.stageLabel) return card.stageLabel;
  if (card.stage === "stage2") return "Stage 2";
  if (card.stage === "stage1") return "Identity";
  return card.isProspect || Object.values(CARD_POOL).some(evolution => evolution.evolvesFrom === card.id) ? "Prospect" : "Basic";
}

export const TRAINER_POOL: Record<string, TrainerCard> = {
  "fathers-plan": { id: "fathers-plan", name: "Father's Plan", kind: "item", rarity: "uncommon", art: "khabib-nurmagomedov", text: "Choose a non-ex fighter named Islam Makhachev or Umar Nurmagomedov from your deck and put it on top of your deck.", effect: { kind: "searchNamedFighterToTop", names: ["Islam Makhachev", "Umar Nurmagomedov"] } },
  "ali-abdelaziz": { id: "ali-abdelaziz", name: "Ali Abdelaziz", kind: "supporter", rarity: "uncommon", text: "Choose a fighter on your opponent's bench that has taken damage and switch it with their active fighter.", effect: { kind: "switchDamagedOpponentBench" } },
  "herb-dean": { id: "herb-dean", name: "Herb Dean", kind: "supporter", rarity: "common", text: "During this turn, your fighters' attacks do 10 more damage to your opponent's active fighter.", effect: { kind: "boostActiveAttackDamage", amount: 10 } },
  "fight-contract": { id: "fight-contract", name: "Fight Contract", kind: "item", rarity: "common", text: "Put a random Basic or Prospect fighter from your deck into your hand. Then shuffle your deck.", effect: { kind: "searchRandomBasic" } },
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
  ...repeat(CARD_POOL["ilia-topuria"]!, 2),
  ...repeat(CARD_POOL["el-matador-ex"]!, 2),
  ...repeat(CARD_POOL["benoit-saint-denis"]!, 2),
  ...repeat(CARD_POOL["paddy-pimblett"]!, 2),
  ...repeat(CARD_POOL.merab!, 2),
  ...repeat(CARD_POOL["tommy-mcmillan"]!, 2),
  ...repeat(TRAINER_POOL["dana-white"]!, 2),
  ...repeat(TRAINER_POOL["herb-dean"]!, 2),
  ...repeat(TRAINER_POOL.bandages!, 2),
  ...repeat(TRAINER_POOL["footwork-drill"]!, 2),
];

/** AI deck: Dagestani fighters and water/colorless support. Energy type = water. */
export const DECK_AI: CardDefinition[] = [
  ...repeat(CARD_POOL["khabib-nurmagomedov"]!, 2),
  ...repeat(CARD_POOL["islam-makhachev"]!, 2),
  ...repeat(CARD_POOL["islam-makhachev-ex"]!, 2),
  ...repeat(CARD_POOL["umar-nurmagomedov"]!, 2),
  ...repeat(CARD_POOL["islam-makhachev-prospect"]!, 2),
  ...repeat(CARD_POOL["islam-makhachev-contender"]!, 2),
  ...repeat(CARD_POOL.merab!, 2),
  ...repeat(CARD_POOL["alexander-volkanovski-ex"]!, 2),
  ...repeat(TRAINER_POOL["fight-contract"]!, 2),
  ...repeat(TRAINER_POOL["herb-dean"]!, 2),
];

export const PLAYER_ENERGY: EnergyType = "fire";
export const AI_ENERGY: EnergyType = "water";
