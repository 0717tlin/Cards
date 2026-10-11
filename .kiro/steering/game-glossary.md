# Game Glossary & Rules Summary

This game is a UFC-themed card battler. The card pool contains UFC fighters and fight-themed Items and Supporters. Do not add fantasy fighter cards.

## Core terms

- **Fighter** (plural: **fighters**) — the player-facing name for a fightable unit and its card. Has HP, a type, one or more attacks, a retreat cost, and an optional weakness. Existing engine types such as `FighterCard` keep their names.
- **Basic** — a standalone fighter played directly, with no evolution in the card pool.
- **Prospect** — a fighter played directly that has an evolution in the card pool.
- **Identity** — an evolved form of a Prospect. Play it onto its matching Prospect using the evolution action. Internal `basic` includes both Basic and Prospect; `stage1` displays as Identity unless an explicit Contender label is set.
- **Contender** — the first evolution in a Prospect → Contender → Champion chain, internally `stage1`.
- **Champion** — the second evolution in that chain, internally `stage2`. It must evolve from its matching Contender.
- **Active** — the one fighter currently in the fighting slot for a player.
- **Defending fighter** — the specific opposing fighter that is active when an attack resolves. Effects on that fighter do not transfer to a replacement active fighter.
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
4. Use one attack with the active fighter (this ends the turn), or retreat/pass. Relentless Pressure allows two attacks; only the second ends the turn.
5. At the turn boundary, check both active fighters: Bleeding deals 10 damage with no recovery flip and clears only on returning to the bench. Burn deals 20 damage, then tails removes Burn. Resolve all checkup damage before knockouts.

## Winning

- Players score **points** by knocking out opposing fighters.
- A normal KO awards 1 point; an **EX** fighter KO awards 2 points.
- First player to reach **3 points** wins. (Alternate loss: a player who cannot field an active fighter loses.)

## Combat details

- **Weakness**: if the defending fighter's type matches the attacker's weakness, damage is increased (fixed +20 in TCG Pocket; final value confirmed in the spec).
- **Retreat cost**: energy that must be discarded to move the active fighter to the bench.
- **Attacks** have an energy cost (count and/or specific types) and a damage value, and may have extra effects.
- **Father's Plan** searches the deck for a non-ex fighter whose printed name is Islam Makhachev or Umar Nurmagomedov and places it on top. Any evolution stage is eligible; it does not draw or shuffle.
- **From the Mountains of Caucasus** reduces those same named non-ex fighters' attacks by one Colorless requirement while Khabib is active or benched. Specific energy requirements remain; multiple Khabib do not stack this discount.
- **Koshi Guruma** prevents the defending fighter from retreating during its next turn. It still may attack or be switched by an effect. The restriction clears on returning to the bench or at the end of its owner's turn.

Anything ambiguous here is pinned down precisely in the battle-system spec before implementation.
