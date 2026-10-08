# Battle System — Design

## Overview

The battle engine is a pure, deterministic state machine in `@card-game/engine`. It exposes four core operations and nothing else:

- `createBattle(config): BattleState` — build the initial state from decks + seed.
- `getLegalMoves(state): Move[]` — every legal move for the player to act.
- `applyMove(state, move): BattleState` — validate and apply a move, returning a new state.
- `getWinner(state): PlayerId | null` — the winner, if any.

The frontend wraps these in a Zustand store; the AI consumes `getLegalMoves` + `applyMove`. This keeps every rule inside the engine (per steering: the UI can never construct a rule the engine doesn't enforce).

All state transitions are immutable: `applyMove` returns a new `BattleState` and never mutates its input. Determinism comes from a seeded RNG carried inside the state, so replaying the same moves from the same seed always yields the same result — which is what makes an authoritative multiplayer server viable later.

## Architecture

```
@card-game/engine
├── src/
│   ├── index.ts            # public API re-exports
│   ├── types.ts            # domain types (cards, state, moves)
│   ├── rng.ts              # seeded RNG (mulberry32 + helpers: shuffle, pick)
│   ├── cards.ts            # predefined original card pool + two fixed decks
│   ├── setup.ts            # createBattle: shuffle, deal, place active/bench, pick starter
│   ├── moves.ts            # getLegalMoves + applyMove (the rule core)
│   ├── combat.ts           # damage calc, weakness, KO, points
│   ├── turn.ts             # begin-turn (energy + draw), end-turn, promotion flow
│   └── winner.ts           # getWinner
```

Consumers:
```
frontend  --> store (zustand) --> engine API
ai        --> engine API
backend    --> engine API (health/echo for now; authoritative host later)
```

## Data model (types.ts)

```ts
export type PlayerId = "P1" | "P2";
export type EnergyType = "fire" | "water" | "grass" | "lightning" | "psychic" | "fighting" | "colorless";

export interface AttackDef {
  id: string;
  name: string;
  cost: EnergyType[];      // e.g. ["fire","colorless"]; colorless = any
  damage: number;
  // effects deferred; not modeled this milestone
}

export interface FighterCard {
  id: string;              // definition id (e.g. "ilia-topuria")
  name: string;
  type: EnergyType;
  hp: number;
  attacks: AttackDef[];
  retreatCost: number;     // count of energy to discard to retreat
  weakness: EnergyType | null;
  isEx: boolean;           // KO awards 2 points if true
  stage: "basic";          // only basics this milestone
}

export interface FighterInPlay {
  uid: string;             // unique per instance in a battle
  card: FighterCard;
  damage: number;          // accumulated damage; KO when damage >= card.hp
  attached: EnergyType[];  // energy attached to this fighter
}

export interface PlayerState {
  id: PlayerId;
  deck: FighterCard[];    // remaining library (top = index 0)
  hand: FighterCard[];
  active: FighterInPlay | null;
  bench: FighterInPlay[]; // max length 3
  energyType: EnergyType;  // this deck's energy zone output
  pendingEnergy: EnergyType | null; // energy generated this turn, not yet attached
  points: number;
}

export type Phase =
  | { kind: "main" }                         // normal play, current player acting
  | { kind: "awaitPromotion"; player: PlayerId }; // a KO left a player with no active

export interface BattleState {
  players: Record<PlayerId, PlayerState>;
  turnPlayer: PlayerId;
  turnNumber: number;      // 1-based; increments each turn start
  phase: Phase;
  rngState: number;        // seeded RNG state, advanced as randomness is consumed
  winner: PlayerId | null;
  log: string[];           // human-readable event log for the UI
}
```

### Moves (discriminated union)

```ts
export type Move =
  | { type: "attachEnergy"; targetUid: string }      // attach pendingEnergy to a fighter
  | { type: "playBasic"; handIndex: number }          // hand -> empty bench slot
  | { type: "retreat"; benchIndex: number }           // swap active with a benched fighter, pay cost
  | { type: "attack"; attackId: string }              // active attacks; ends turn
  | { type: "pass" }                                  // end turn with no attack
  | { type: "promote"; benchIndex: number };          // resolve awaitPromotion phase
```

`getLegalMoves` returns only entries valid right now. Examples:
- `attachEnergy` appears only if `pendingEnergy != null` and at least one fighter exists to receive it.
- `playBasic` appears per hand index that is a Basic fighter, only if bench has an open slot.
- `attack` appears per attack whose cost is satisfied by the active's attached energy.
- In `awaitPromotion` phase, ONLY `promote` moves are legal (for the player who must promote), regardless of whose turn it is.

## Key algorithms

### RNG (rng.ts)
Deterministic `mulberry32(seed)` producing a function that returns [0,1). Helpers `shuffle(rng, array)` (Fisher–Yates) and `nextInt`. The engine threads `rngState` through state so consumption is reproducible. Consumers pass a numeric `seed` to `createBattle`.

### Setup (setup.ts)
1. Seed RNG from config.seed.
2. For each player: shuffle deck, draw 5 (mulligan until a Basic is present — always true this milestone).
3. Auto-place: choose the first Basic in hand as active; optionally place up to 3 more Basics on bench (setup policy: place the active only, keep the rest in hand, to keep opening simple and deterministic).
4. Pick starting player from RNG.
5. Begin the starting player's first turn with the turn-1 exception (no energy, no draw).

### Energy cost check (combat.ts)
An attack cost is a multiset of `EnergyType`. `colorless` entries are satisfied by any energy. Algorithm: first match each specific (non-colorless) required type against the attached energy, removing matches; then require that the remaining attached count covers the number of colorless entries. Returns boolean.

### Damage (combat.ts)
`damage = attack.damage + (defender.card.weakness === attacker.card.type ? 20 : 0)`. Apply to `defender.damage`. If `defender.damage >= defender.card.hp`, it's KO'd: attacker gains `card.isEx ? 2 : 1` points; KO'd fighter (and its energy) is removed; if it was the active, the owning player enters `awaitPromotion` if they have bench, else they lose.

### Turn flow (turn.ts)
- `beginTurn(state)`: increment turnNumber, set pendingEnergy (unless turn-1 exception), draw 1 (unless turn-1 exception), clear per-turn flags.
- `endTurn(state)`: discard unattached pendingEnergy, swap turnPlayer, then `beginTurn`.
- Attacking calls combat then `endTurn`. If the attack triggered `awaitPromotion` for the defender, the phase is resolved (defender promotes) before the next turn fully proceeds — promotion is required before any other move.

### Winner (winner.ts)
`getWinner` returns `state.winner`. Winner is set the moment a player reaches 3 points (checked after each KO) or an opponent cannot promote.

## Per-turn flag tracking
`PlayerState` gets transient booleans, reset at `beginTurn`: `hasAttachedEnergy`, `hasRetreated`. (Added to the type in implementation; omitted above for brevity.) These enforce "once per turn" limits in `getLegalMoves`.

## AI (in engine or ai module — placed in engine/src/ai.ts for reuse)
`chooseMove(state): Move` heuristic, all via `getLegalMoves`:
1. If must promote → promote the highest-HP bench fighter.
2. Attach energy to the active if not yet attached.
3. If any attack is legal → use the highest-damage legal attack (ends turn).
4. Else → pass.
Guaranteed to terminate the AI turn (always ends with attack or pass).

## Frontend (design)
- `battleStore` (zustand): holds `BattleState`, exposes `legalMoves`, `dispatch(move)`, and a `runAiTurn()` that loops `chooseMove`/`applyMove` while it's the AI's turn.
- Components: `<Board/>` (both sides), `<FighterView/>` (hp bar, energy pips, EX badge), `<Hand/>`, `<Controls/>` (buttons generated from legal moves), `<ResultBanner/>`.
- After each human move, if the turn passed to AI, the store runs the AI turn, then re-renders.

## Testing strategy
Vitest in the engine, exercised through the public API:
- Setup determinism: same seed → identical state; hands contain a Basic.
- Turn-1 exception: starter gets no energy/no draw on turn 1.
- Energy: attach once per turn; cost checking incl. colorless.
- Combat: base damage, weakness +20, KO removal, point awards (normal=1, EX=2).
- Promotion: KO with bench → awaitPromotion → promote; KO with empty bench → loss.
- Win: reaching 3 points sets winner and empties the legal move set.
- AI: `chooseMove` always returns a legal move and always ends its turn.

## Decisions locked
- Opening hand 5; mulligan to guarantee a Basic.
- Turn-1 starter: no draw, no energy.
- Weakness: +20 flat.
- Win at 3 points; EX KO = 2.
- Only Basic fighters; fighter cards only (no trainers/items/abilities) this milestone.
- Setup auto-places active only; bench filled during play.
