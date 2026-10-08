# UI Expansion — Design

## Overview

Two tracks: an **engine change** (add a discard pile; make card data richer but backward-compatible) and a **frontend expansion** (navigation + three screens + a real card component). The engine stays pure and deterministic; the card data format is designed so future evolution and abilities slot in without a rewrite.

## Engine changes

### Card definition format (types.ts)

`FighterCard` gains stage variants, an optional ability, an optional `evolvesFrom`, and an art key. Fields unused by rules this milestone are still carried.

```ts
export type Stage = "basic" | "stage1" | "stage2";

export interface AbilityDef {
  name: string;
  text: string;      // display only this milestone; no effect resolution
}

export interface AttackDef {
  id: string;
  name: string;
  cost: EnergyType[];
  damage: number;
  text?: string;     // optional rules text; display only this milestone
}

export interface FighterCard {
  id: string;
  name: string;
  type: EnergyType;
  hp: number;
  attacks: AttackDef[];
  retreatCost: number;
  weakness: EnergyType | null;
  isEx: boolean;
  stage: Stage;                 // was "basic" only
  ability?: AbilityDef;         // NEW, data only
  evolvesFrom?: string;         // NEW, card id; unused in battle this milestone
  art?: string;                 // NEW, art key resolved by the frontend
}
```

Rule impact: `getLegalMoves` currently gates `playBasic` on `stage === "basic"`. That stays — only Basics are playable from hand this milestone, so Stage1/Stage2 cards simply are not legal to bench yet (evolution comes later). Decks used in battle must therefore be all-Basic; the Deck Builder enforces "at least one Basic" and battle setup already requires a Basic active.

### Discard pile (types.ts + turn.ts + moves.ts)

A discard entry is a tagged union so the UI can show both discarded fighters and energies:

```ts
export type DiscardEntry =
  | { kind: "fighter"; card: FighterCard }
  | { kind: "energy"; energy: EnergyType };

// PlayerState gains:
discard: DiscardEntry[];
```

Wiring:
- **End of turn** (`endTurn`): an unattached `pendingEnergy` is pushed as `{ kind: "energy", ... }` instead of just dropped.
- **Retreat** (`applyRetreat` in moves.ts): the energy paid for retreat is pushed as energy entries.
- **KO** (`applyAttack` in moves.ts): the KO'd fighter is pushed as `{ kind: "fighter", card }`, and each of its attached energies is pushed as energy entries.
- **cloneState/clonePlayer** (turn.ts): clone the new `discard` array.
- **setup.ts**: initialize `discard: []` per player.

Determinism is unaffected (no new randomness). New tests assert discard contents after retreat, end-of-turn, and KO. All existing tests keep passing because discard is additive.

### API surface

No new public functions. `BattleState` and `FighterCard` gain fields (additive). Frontend reads `player.discard`, `player.deck.length`, `player.pendingEnergy` for the new layout.

## Frontend architecture

```
frontend/src/
├── main.tsx
├── App.tsx                     # nav shell + active screen
├── styles.css
├── navigation/
│   └── useAppView.ts           # zustand: "viewer" | "builder" | "battle"
├── cards/
│   ├── cardArt.ts              # art-key -> placeholder style resolver
│   └── Card.tsx                # the framed card component (+ size variants)
├── screens/
│   ├── CardViewer.tsx
│   ├── DeckBuilder.tsx
│   └── Battle.tsx              # moved/rebuilt from old App battle UI
├── deck/
│   └── useDeckBuilder.ts       # zustand: selection, validation, build -> FighterCard[]
└── store/
    └── battleStore.ts          # existing; newGame accepts a human deck
```

### Navigation
A tiny zustand store `useAppView` holds the current screen and a setter. `App.tsx` renders a top nav (three buttons) + the active screen. In-memory only.

### Card component (Card.tsx)
Props: `card: FighterCard`, `size?: "sm" | "md" | "lg"`, optional overlays for battle (damage/HP remaining, attached-energy pips, badges). Layout mirrors the reference:
- Top bar: stage label (left), name, HP + type symbol (right).
- Art box: placeholder from `cardArt.ts` (type-colored gradient + name); swapped for a real `<img>` when `card.art` resolves to an asset later.
- Ability block (if `card.ability`): name + text, visually distinct.
- Attacks: each row = cost pips + name + damage; optional text under it.
- Bottom row: weakness (type + "+20") and retreat cost (pips).
`cardArt.ts` maps `EnergyType` to colors and returns a deterministic placeholder; a real asset map can be added later keyed by `card.art`.

### Card Viewer (CardViewer.tsx)
Grid of all definitions from the engine's card pool, each rendered with `Card size="md"`. Optional type filter (simple buttons). Read-only.

### Deck Builder (DeckBuilder.tsx + useDeckBuilder.ts)
- Store holds a `Map<cardId, count>` selection and derives: total count, per-card counts, legality (== 20 cards, each count <= COPY_LIMIT=2, >= 1 Basic).
- Left: card pool (click to add). Right: current deck list (click to remove), a live counter (n/20), rule warnings, and a "Battle with this deck" button enabled only when legal.
- `build(): FighterCard[]` expands the selection into a 20-card array and hands it to `battleStore.newGame({ humanDeck })`, then switches the view to Battle.

### Battle (Battle.tsx)
Rebuild the current battle UI into the PTCGP layout using `Card`:
- Opponent zone (top): active + bench (face-up), deck count, discard count, energy indicator, points.
- Center: controls (buttons from legal moves — unchanged logic) + battle log.
- Player zone (bottom): active + 3 bench, energy zone (pending energy), deck count, discard pile (click to inspect), points.
- Hand: row of `Card size="sm"` at the very bottom.
`battleStore.newGame` is extended to accept an optional `{ humanDeck?: FighterCard[] }`; if absent, it uses `DECK_PLAYER` (so Battle works even if you never visited the builder). AI keeps `DECK_AI`.

### battleStore changes
- `newGame(opts?: { humanDeck?: FighterCard[] })` uses the provided deck for P1, else the default.
- Everything else (AI loop, dispatch, awaitPromotion handling) is unchanged.

## Testing strategy
- **Engine**: extend vitest — discard after end-of-turn (unattached energy), after retreat (paid energy), after KO (fighter + its energy). Assert existing 20 tests still pass. Assert new card fields don't break setup/legal-move/attack flows.
- **Frontend**: type-check + `vite build`; run the dev server and confirm all three screens render and a battle started from a built deck plays to completion. (No component test runner is set up; keep verification at build + manual, consistent with the current project.)

## Decisions locked
- Only Basics are battle-legal this milestone; Stage1/Stage2 exist in data + viewer but can't be benched yet (evolution deferred).
- Copy limit 2, deck size 20.
- Discard pile is a tagged entry list; rules use only fighter entries + counts.
- Ability + evolvesFrom are display/data only.
- Placeholder art via type-colored box; real art swaps in later via `card.art`.
- Decks are in-memory; battleStore falls back to the default deck when none is built.
