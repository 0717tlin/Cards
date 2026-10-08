# Game Glossary & Rules Summary

This game is a UFC-themed card battler. The card pool contains UFC fighters and fight-themed Items and Supporters. Do not add fantasy fighter cards.

## Core terms

- **Fighter** (plural: **fighters**) — the player-facing name for a fightable unit and its card. Has HP, a type, one or more attacks, a retreat cost, and an optional weakness. Existing engine types such as `FighterCard` keep their names.
- **Active** — the one fighter currently in the fighting slot for a player.
- **Bench** — up to 3 additional fighters a player controls, not currently fighting.
- **Energy** — a resource attached to fighters to pay for attacks. Generated once per turn from the energy zone (there are no energy cards).
- **Energy Zone** — produces one energy per turn that the player may attach to one of their fighters.
- **Hand** — cards a player is holding, not yet in play.
- **Deck** — a player's 20-card library.
- **Item** — a one-use card played from hand and discarded after resolving. Any number may be played during your turn.
- **Supporter** — a one-use card played from hand and discarded after resolving. Only one Supporter may be played per turn.
- **Footwork Drill** — an Item that reduces the active fighter's retreat cost by one energy for this turn. Multiple copies stack, with a minimum cost of zero.

## Turn flow (per player turn)

1. Draw a card (the very first player skips their first-turn draw of the extra card, per standard TCG-Pocket openings — final rule confirmed in the spec).
2. Attach one energy from the energy zone to one fighter (optional, once per turn).
3. Play fighters from hand to the bench; promote/evolve as rules allow.
4. Use one attack with the active fighter (this ends the turn), or retreat/pass.

## Winning

- Players score **points** by knocking out opposing fighters.
- A normal KO awards 1 point; an **EX** fighter KO awards 2 points.
- First player to reach **3 points** wins. (Alternate loss: a player who cannot field an active fighter loses.)

## Combat details

- **Weakness**: if the defending fighter's type matches the attacker's weakness, damage is increased (fixed +20 in TCG Pocket; final value confirmed in the spec).
- **Retreat cost**: energy that must be discarded to move the active fighter to the bench.
- **Attacks** have an energy cost (count and/or specific types) and a damage value, and may have extra effects.

Anything ambiguous here is pinned down precisely in the battle-system spec before implementation.
