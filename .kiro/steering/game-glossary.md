# Game Glossary & Rules Summary

This game is an original, TCG-Pocket-style card battler. Names, art, and creatures are original placeholders — do NOT use real Pokemon names, art, or characters. Only the mechanics are modeled.

## Core terms

- **Creature card** — a card representing a fightable unit. Has HP, a type, one or more attacks, a retreat cost, and an optional weakness.
- **Active** — the one creature currently in the fighting slot for a player.
- **Bench** — up to 3 additional creatures a player controls, not currently fighting.
- **Energy** — a resource attached to creatures to pay for attacks. Generated once per turn from the energy zone (there are no energy cards).
- **Energy Zone** — produces one energy per turn that the player may attach to one of their creatures.
- **Hand** — cards a player is holding, not yet in play.
- **Deck** — a player's 20-card library.

## Turn flow (per player turn)

1. Draw a card (the very first player skips their first-turn draw of the extra card, per standard TCG-Pocket openings — final rule confirmed in the spec).
2. Attach one energy from the energy zone to one creature (optional, once per turn).
3. Play creatures from hand to the bench; promote/evolve as rules allow.
4. Use one attack with the active creature (this ends the turn), or retreat/pass.

## Winning

- Players score **points** by knocking out opposing creatures.
- A normal KO awards 1 point; an **EX** creature KO awards 2 points.
- First player to reach **3 points** wins. (Alternate loss: a player who cannot field an active creature loses.)

## Combat details

- **Weakness**: if the defending creature's type matches the attacker's weakness, damage is increased (fixed +20 in TCG Pocket; final value confirmed in the spec).
- **Retreat cost**: energy that must be discarded to move the active creature to the bench.
- **Attacks** have an energy cost (count and/or specific types) and a damage value, and may have extra effects.

Anything ambiguous here is pinned down precisely in the battle-system spec before implementation.
