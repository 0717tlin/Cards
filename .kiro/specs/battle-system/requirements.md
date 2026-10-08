# Battle System — Requirements

## Introduction

This spec defines the single-player battle for an original, TCG-Pocket-style card game. A human player battles an AI opponent. The scope is the **battle only** — no pack opening, no collection, no accounts, no persistence. Decks are fixed/predefined for this milestone. The battle logic lives in the pure `@card-game/engine` package and is consumed by the frontend UI and the AI.

Terminology follows `.kiro/steering/game-glossary.md`.

## Scope

**In scope**
- A complete, playable battle: setup, turns, energy, attacks, KOs, points, win/lose.
- Board of 1 active + up to 3 bench per player.
- A predefined pool of original fighter cards and two fixed 20-card decks (player and AI).
- A basic AI that always makes legal moves.
- A frontend that renders the battle and lets a human play against the AI end-to-end.

**Out of scope (this milestone)**
- Pack opening, collection, deck building UI, accounts, persistence, multiplayer/networking.
- Abilities/trainer/item cards. This milestone models **fighter cards only** with basic attacks.
- Evolution chains (all fighters are Basic for this milestone).

## Requirements

### R1 — Game setup
**User story:** As a player, I want a battle to start in a valid initial state so I can begin playing.

**Acceptance criteria**
1. WHEN a battle is created with two decks and a seed THEN the engine SHALL produce a deterministic initial state from that seed.
2. WHEN setup runs THEN each deck SHALL be shuffled using the injected seeded RNG (never `Math.random`).
3. WHEN setup runs THEN each player SHALL draw an opening hand of 5 cards.
4. IF a player's opening hand contains no Basic fighter THEN the engine SHALL redraw that hand (mulligan) until it contains at least one Basic fighter, using the seeded RNG. (Since all fighters are Basic this milestone, this always succeeds on the first draw; the rule is still enforced for correctness.)
5. WHEN setup completes THEN each player SHALL place exactly one Basic fighter as their active, and MAY place up to 3 additional Basics on their bench.
6. WHEN setup completes THEN the starting player SHALL be chosen deterministically from the seed.

### R2 — Turn structure
**User story:** As a player, I want turns to follow a clear, enforced sequence so the game is fair and predictable.

**Acceptance criteria**
1. WHEN a player's turn begins THEN the engine SHALL, in order: (a) generate 1 energy in that player's energy zone, (b) draw 1 card from their deck.
2. IF it is the very first turn of the game for the starting player THEN that player SHALL skip the draw step (a) still generates energy? — see decision D2. The confirmed rule: the starting player skips their draw on turn 1 and generates NO energy on turn 1.
3. WHEN it is a player's turn THEN they MAY, in any order and subject to limits: attach the turn's energy to one of their fighters (at most once per turn), play Basic fighters from hand to open bench slots, and retreat the active fighter (at most once per turn, paying retreat cost).
4. WHEN a player uses an attack with their active fighter THEN the turn SHALL end immediately after the attack resolves.
5. WHEN a player chooses to pass THEN their turn SHALL end without an attack.
6. IF a player's deck is empty at the draw step THEN that player SHALL NOT lose by deck-out this milestone (draw is simply skipped); deck-out loss is out of scope.

### R3 — Energy
1. WHEN the energy step runs THEN exactly 1 energy of the player's deck-defined energy type SHALL be added to their energy zone (except starting player's turn 1, per R2.2).
2. WHEN a player attaches energy THEN it SHALL move from the energy zone onto exactly one of their fighters, at most once per turn.
3. WHEN energy is in the energy zone and not attached by end of turn THEN it SHALL be discarded (energy zone holds at most the current turn's energy).

### R4 — Playing fighters and bench
1. WHEN a player plays a Basic fighter from hand THEN it SHALL occupy one empty bench slot, up to a maximum of 3 benched fighters.
2. IF the bench is full (3) THEN the engine SHALL NOT allow playing another fighter.

### R5 — Attacks and combat
1. WHEN a player attempts an attack THEN the engine SHALL allow it only IF the active fighter has energy attached that meets or exceeds the attack's cost.
2. WHEN an attack resolves THEN base damage SHALL be dealt to the defending active fighter.
3. IF the defending fighter's type equals the attacker's weakness type THEN damage SHALL be increased by a fixed +20.
4. WHEN damage brings a fighter's remaining HP to 0 or below THEN that fighter SHALL be knocked out (KO).
5. WHEN a fighter is KO'd THEN the attacking player SHALL score points: 1 for a normal fighter, 2 for an EX fighter.

### R6 — Promotion after KO
1. WHEN a player's active fighter is KO'd AND they have at least one benched fighter THEN that player SHALL promote one benched fighter to active before play continues.
2. IF a player's active is KO'd AND they have no benched fighter THEN that player SHALL lose the game (see R7.2).

### R7 — Win / loss
1. WHEN a player reaches 3 or more points THEN that player SHALL win immediately.
2. WHEN a player has no active fighter and no benched fighter to promote THEN that player SHALL lose and the opponent SHALL win.
3. WHEN the game has a winner THEN no further moves SHALL be legal.

### R8 — Legal move API
1. WHEN asked for legal moves for the current state THEN the engine SHALL return the complete list of currently-legal moves for the player to act.
2. WHEN given a move THEN the engine SHALL reject any move not in the legal set and SHALL apply any legal move to produce the next state.
3. The UI and AI SHALL rely solely on this API; no rule is enforced only in the UI.

### R9 — AI opponent
1. WHEN it is the AI's turn THEN the AI SHALL choose only from the engine's legal moves.
2. The AI SHALL play to a simple heuristic (attach energy, attack when able, otherwise pass) and always terminate its turn.

### R10 — Frontend battle
1. WHEN the app loads THEN a battle vs AI SHALL start and render both players' active, bench, HP, attached energy, points, and whose turn it is.
2. WHEN it is the human's turn THEN the UI SHALL offer exactly the engine's legal moves and dispatch the chosen move.
3. WHEN the game ends THEN the UI SHALL show a win/lose result.

## Open decisions (resolved in design)
- **D1**: Opening hand size = 5 (matches TCG Pocket).
- **D2**: Starting player turn 1 skips draw AND generates no energy (matches TCG Pocket).
- **D3**: Weakness bonus = fixed +20.
- **D4**: Points to win = 3; EX KO = 2 points.
