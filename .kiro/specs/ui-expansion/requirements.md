# UI Expansion — Requirements

## Introduction

This spec expands the game from a single battle screen into a multi-screen app that resembles the reference game (PTCGP), and makes the card system data-driven so new cards can be added by supplying art + stats + attacks with no engine code. It also adds a discard pile to the battle (a new engine concept) and a first-version deck builder.

Scope builds on the completed `battle-system` spec. Terminology follows `.kiro/steering/game-glossary.md`. All content remains original (placeholder art, original fighters) — the reference card is a layout template only.

## Scope

**In scope**
- App navigation between three screens: **Card Viewer**, **Deck Builder**, **Battle**.
- A framed **Card component** matching the reference layout (art box, HP, type, stage, retreat, weakness, attacks with energy-cost pips), using placeholder art.
- A **data-driven card definition** format supporting stages (Basic / Stage 1 / Stage 2) and an optional **ability slot** (data only). Adding a card = adding one data entry + one art reference.
- A **discard pile** per player in the engine, receiving KO'd fighters and all discarded energy.
- A PTCGP-style **Battle layout**: active, 3 bench, hand, deck (count), energy zone, discard pile.
- A **first-version Deck Builder**: choose cards within deck rules, hold in memory, start a battle with the chosen deck.

**Out of scope / deferred (designed-for, not implemented)**
- **Evolution mechanics** in battle. The card format represents stages, but playing evolutions during a battle is deferred. All battle-legal fighters this milestone are still Basics.
- **Ability effects.** The card format carries an optional ability (name + text), but no ability resolves during play.
- Persistence (decks are in-memory only), accounts, pack opening, multiplayer, real art assets.

## Requirements

### R1 — App navigation
**User story:** As a player, I want to move between the card list, deck builder, and battle, so I can browse, build, and play.

**Acceptance criteria**
1. WHEN the app loads THEN it SHALL present navigation to three screens: Card Viewer, Deck Builder, Battle.
2. WHEN the player selects a screen THEN the app SHALL show that screen and indicate which is active.
3. Navigation state MAY be in-memory (no routing/persistence required).

### R2 — Data-driven card definitions
**User story:** As the game author, I want to add a card by providing art + stats + attacks only, so extending the card pool needs no engine changes.

**Acceptance criteria**
1. Each card SHALL be defined by data: id, name, type, hp, stage (`basic` | `stage1` | `stage2`), retreatCost, weakness (type | null), isEx, attacks (each: name, energy cost, damage, optional text), an optional ability (name + text, data only), an optional `evolvesFrom` (card id, for future evolution), and an art reference.
2. WHEN a new card definition and its art reference are added THEN it SHALL appear in the Card Viewer and be selectable in the Deck Builder with NO engine code changes.
3. The engine's battle rules SHALL depend only on the fields they use (hp, type, attacks, retreatCost, weakness, isEx, stage). Ability and evolvesFrom SHALL be carried but unused this milestone.
4. Existing cards SHALL be migrated to this format with equivalent behavior.

### R3 — Card component (visual)
**User story:** As a player, I want cards to look like the reference game so the game feels familiar.

**Acceptance criteria**
1. The Card component SHALL display: an art box (placeholder art), HP with type, stage label, each attack with its energy-cost pips + damage, an ability block when present, and a bottom row with weakness and retreat cost.
2. WHEN a card has no art asset THEN a deterministic placeholder (e.g. colored box keyed by type) SHALL render.
3. The Card component SHALL be reused by the Card Viewer, Deck Builder, and Battle (with size variants as needed).

### R4 — Card Viewer
1. WHEN the Card Viewer is shown THEN it SHALL list all card definitions rendered with the Card component.
2. The viewer MAY provide simple filtering by type (optional this version).

### R5 — Deck Builder (first version)
**User story:** As a player, I want to assemble a deck and battle with it.

**Acceptance criteria**
1. WHEN building a deck THEN the player SHALL add/remove cards subject to rules: exactly 20 cards; at most a fixed per-card copy limit (default 2); at least one Basic.
2. WHEN the current selection violates a rule THEN the builder SHALL indicate it and SHALL NOT allow starting a battle.
3. WHEN the deck is legal AND the player starts a battle THEN a battle SHALL begin using that deck for the human; the AI SHALL use a predefined deck.
4. The built deck SHALL be held in memory for the session (no persistence required).

### R6 — Discard pile (engine)
**User story:** As a player, I want KO'd fighters and spent energy to go to a discard pile, matching the real game.

**Acceptance criteria**
1. Each player's state SHALL include a discard pile.
2. WHEN a fighter is knocked out THEN that fighter SHALL be placed in its owner's discard pile, and its attached energy SHALL be discarded (to the discard pile as energy entries).
3. WHEN energy is discarded (unattached at end of turn, or paid as a retreat cost) THEN it SHALL be added to the discarding player's discard pile.
4. Discard behavior SHALL be deterministic and covered by tests. Existing battle-system tests SHALL continue to pass.

### R7 — Battle layout (PTCGP-style)
1. WHEN in battle THEN the layout SHALL show, for each player: active spot, 3 bench spots, hand, deck (as a count/stack), energy zone (pending energy), and discard pile (count + inspectable).
2. The battle SHALL use the new Card component for fighters in play and in hand.
3. The battle SHALL remain fully playable vs AI end-to-end using the existing engine move flow, with the human deck coming from the Deck Builder (or a default deck if none was built).

## Open decisions (resolved in design)
- **D1**: Per-card copy limit default = 2; deck size = 20 (unchanged).
- **D2**: Placeholder art = type-colored box with the card name; art reference is a string key resolved by the frontend.
- **D3**: Discard pile stores a tagged list of entries (fighters and energies) for display; engine rules only need counts + fighter list.
- **D4**: Ability + evolvesFrom are represented in data and shown in the UI but do not affect battle rules this milestone.
