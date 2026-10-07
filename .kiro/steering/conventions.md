# Code Conventions

## General

- TypeScript strict mode. No `any` unless justified with a comment. Prefer precise types and discriminated unions.
- Prefer pure functions and immutable updates in the engine. Functions that apply a move return a new state rather than mutating in place (or mutate a draft that is clearly scoped). Never mutate shared state passed by the caller.
- Name things by domain terms (see game-glossary.md), not by implementation detail.

## Engine specifics

- The engine exposes a small, explicit API surface: create state, list legal moves, apply a move, check for a winner. UI and AI consume only this surface.
- Every rule should be reachable through "list legal moves" + "apply move". The UI should never need to know a rule the engine does not enforce. If the UI can construct an illegal action, the engine must reject it.
- No I/O, no timers, no logging side effects in engine code.

## Frontend specifics

- Components are function components with hooks.
- Game state lives in a Zustand store that wraps the engine; components read from the store and dispatch engine moves.
- Keep rendering dumb: the store holds the authoritative engine state, components render it.
- Use "mon" / "mons" in player-facing copy. Clicking a battle card opens an enlarged view; attack and retreat actions are offered there using engine legal moves.
- When the human must promote after a knockout, prompt them to choose a new active mon from the bench after animations finish.
- Keep the battle within the viewport. Active slots are larger than bench slots and visually separated from them.
- Battle tips, turn count, battle log, and End Turn belong in the side controls. Show Cancel beside the current optional target prompt; omit the Supporter availability hint.
- In the deck editor, click a card to add it, right-click to remove a copy, and hold for half a second to enlarge it. Moving off the card cancels the hold.
- Card artwork and rules sections keep identical proportions at all sizes, including hand and enlarged views.
- Attack effects are structured data on `AttackDef.effects` and resolve in engine combat; rules text only describes them. Damage bonuses are applied before weakness, and AI evaluates resolved damage.
- Coin flips consume the battle's seeded RNG. `flipUntilTails` adds its damage bonus for each heads, emits a `coinFlipped` event for every result, and animates before the attack lands. AI evaluates the expected bonus without consuming RNG.
- Decks and hands contain `CardDefinition` (mons, Items, Supporters). `ALL_CARD_POOL` includes every card; `CARD_POOL` retains mon definitions and `TRAINER_POOL` holds Items/Supporters. Use `isCreatureCard` before accessing mon-only fields.
- Trainer moves, healing targets, the one-Supporter-per-turn limit, and temporary retreat reductions are enforced by engine legal moves. Played trainers go to the discard pile. Healing is capped at full HP; no-effect healing/draw/reduction plays are not offered.
- Targeted cards use "Use", then highlight eligible mons on the board. Only a legal target click resolves the action; cancellation spends nothing. Retreat and required promotion also select highlighted benched mons on the board. The full battle log opens from a side button.

## Animation

- Events drive animations. The engine appends structured `BattleEvent`s to `state.events` for everything visible; the UI animates from those, never by diffing states or parsing the text log. A new visible mechanic needs a new event kind.
- Timing lives in `frontend/src/animation/timing.ts` (`EVENT_MS`). The store locks input (`busy`) for a move's total event time and paces the AI one move at a time; components use the same table so animations fit that window.
- `useBattleEvents` derives transient effects during render from the current batch; don't put animation state into the engine or the battle store.
- Animations are presentation only: no rules in the UI, and drag-and-drop/attacks must keep resolving through legal moves.
- Respect reduced motion: `MotionConfig reducedMotion="user"` plus `prefersReducedMotion()` in timing.
- Scheduled callbacks (timers) must check `gameId` so a new game cancels them.

## Testing

- Engine logic must have unit tests (Vitest). Cover turn flow, attack resolution, KO/points, and win conditions.
- Prefer testing through the public engine API (legal moves + apply move) over reaching into internals.
