# Animations & Screen Transitions — Design

## Overview

```
engine: applyMove(state, move) ──► new state (+ new entries in state.events)
                                           │
store:  commit state, compute animation time for the new events (duration table)
        lock input until the animations finish; if the AI is acting, schedule its next step
                                           │
UI:     useBattleEvents() turns new events into short-lived visual effects
        (turn banner, damage pops, lunges, KO ghosts); Motion does the animating
```

Rules stay in the engine. The store owns *timing*. Components own *how it looks*.

## 1. Engine: structured events

### Types (types.ts)

```ts
export type BattleEvent =
  | { kind: "battleStarted"; firstPlayer: PlayerId }
  | { kind: "turnStarted"; player: PlayerId; turnNumber: number }
  | { kind: "energyGenerated"; player: PlayerId; energy: EnergyType }
  | { kind: "cardDrawn"; player: PlayerId }
  | { kind: "energyAttached"; player: PlayerId; targetUid: string; energy: EnergyType }
  | { kind: "fighterBenched"; player: PlayerId; uid: string }
  | { kind: "retreated"; player: PlayerId; outUid: string; inUid: string; paid: EnergyType[] }
  | { kind: "promoted"; player: PlayerId; uid: string }
  | { kind: "attackUsed"; player: PlayerId; attackerUid: string; attackId: string; targetUid: string }
  | { kind: "damageDealt"; player: PlayerId; uid: string; amount: number; weakness: boolean }
  | { kind: "knockedOut"; player: PlayerId; fighter: FighterInPlay; pointsAwarded: number }
  | { kind: "energyDiscarded"; player: PlayerId; energy: EnergyType }
  | { kind: "gameWon"; player: PlayerId; reason: "points" | "noFighters" };

// BattleState gains:
events: BattleEvent[]; // append-only history, like `log`
```

In each event, `player` is the player the event happens to: the owner of the damaged or knocked-out fighter, or the player who acted.

### Where events are emitted
| Code path | Events |
|---|---|
| `createBattle` | `battleStarted` |
| `beginTurn` | `turnStarted`; `energyGenerated` and `cardDrawn` (except on turn 1 / when the deck is empty) |
| `endTurn` | `energyDiscarded` if energy was left unattached |
| `applyAttachEnergy` | `energyAttached` |
| `applyPlayBasic` | `fighterBenched` |
| `applyRetreat` | `retreated` |
| `applyPromote` | `promoted` |
| `applyAttack` | `attackUsed`, `damageDealt`; on KO `knockedOut` (with a snapshot of the fighter before removal), then `gameWon` or the turn change |

`cloneState` copies `events`, and `weakness` is taken from the same comparison `computeDamage` uses. This is an additive change with no rule changes. Engine version goes to 0.3.0.

## 2. Store: pacing and input lock

`battleStore` changes from "run the whole AI turn synchronously" to a paced runner:

```ts
interface BattleStore {
  state: BattleState;
  busy: boolean;          // true while animations play or the AI is acting (input locked)
  presented: number;      // index in state.events up to which the UI has been told to animate
  gameId: number;         // incremented by newGame; pending timers check it and bail out
  humanMoves: Move[];     // [] while busy
  ...
}
```

Flow for any move (human or AI):
1. `applyMove`, then collect `newEvents = state.events.slice(prevLength)`.
2. Commit the state and set `busy = true`.
3. Wait `animationTime(newEvents)`, computed from the duration table below.
4. If the AI is the acting player (including an AI promotion), wait `AI_THINK_MS`, apply `chooseMove`, and go back to step 1.
5. Otherwise set `busy = false` and recompute `humanMoves`.

Timers use `setTimeout`. Each callback captures `gameId` and does nothing if it has changed, so `newGame` cancels everything pending. The initial battle runs the same loop, so an AI-first opening is paced too.

### Duration table (`animation/timing.ts`)
| Event | ms | | Event | ms |
|---|---|---|---|---|
| turnStarted | 900 | | retreated / promoted | 450 |
| cardDrawn | 300 | | attackUsed | 350 |
| energyGenerated | 250 | | damageDealt | 550 |
| energyAttached | 400 | | knockedOut | 650 |
| fighterBenched | 350 | | energyDiscarded | 0 |
| gameWon | 0 (the banner stays up) | | battleStarted | 0 |

`animationTime(events)` is the sum of these durations. `AI_THINK_MS = 500`.

With reduced motion, every duration drops to 0 except a 200 ms minimum per AI action, so the opponent's turn is still readable. This is detected with `matchMedia("(prefers-reduced-motion: reduce)")` and applied to Motion through `<MotionConfig reducedMotion="user">`.

## 3. UI

### Library
`motion@13.4.6`, pinned exactly, imported from `motion/react`. It provides `AnimatePresence` for exit animations and `layoutId` for moving elements between containers. It's the main maintained React animation library and supports React 18.2+.

### `useBattleEvents` hook
It watches `state.events` from the last handled index and turns each new event into a short-lived effect held in local state. Each effect is cleared after its duration from the timing table:
- `turnBanner: { player } | null`
- `damagePops: { uid, amount, weakness, key }[]`
- `lunging: uid | null` and `shaking: uid | null`
- `koGhosts: { player, fighter, key }[]`
- `ringPulse: PlayerId | null` and `pointsPulse: PlayerId | null`
- `lastAttached: { uid, index } | null` (drives the energy fly)

### Animation techniques by requirement
- **Screen transitions (R3):** `AnimatePresence mode="wait"` around the view, keyed by `view`, with opacity plus a small y-offset, about 250 ms. The menu uses a staggered `motion` entrance.
- **Turn banner:** a fixed overlay `motion.div` that slides in, holds, and slides out.
- **Draw:** hand cards are wrapped in `AnimatePresence`. New cards enter with `x` offset from the deck side and fade in. A played card exits with a fade.
- **Bench / retreat / promote:** each in-play card is a `motion.div` with `layoutId={uid}`. Retreat and promote then move smoothly between slots, and a newly benched card uses its `initial` enter animation.
- **Energy attach:** the pending pip in the energy zone gets `layoutId={"energy-" + player}`. When `energyAttached` fires, the newly attached pip on the target gets the same `layoutId` for that render, so Motion flies it across. If that proves unreliable inside drop zones, the fallback is a scale pop-in (allowed by R4.4).
- **Attack:** the attacker gets a y-offset keyframe toward the center (up for the human, down for the AI). The defender gets an x-shake keyframe and a floating `-40` (plus "Weak!") pop. The HP number is keyed by value so it flashes when it changes.
- **Knock-out:** the engine removes the fighter immediately. The UI draws a `koGhost` (the snapshot from the event) in that active slot, plays the hit, then exits it toward the discard pile with scale down, fade, and translate. The empty slot or promotion drop zone appears after it.
- **Points and result:** the points badge pulses on `pointsPulse`, and the result banner springs in.
- **Other screens (R5):** grid items use `motion.div` with a staggered `initial`/`animate` and a `key` that includes the filter so they re-stagger when it changes. Deck-list rows use `AnimatePresence` with height and opacity. The count badge is keyed by its count so it pops.

### Interaction with drag and drop
While `busy`, `humanMoves` is empty, so the existing drag, drop, and attack logic already disables itself. End Turn does the same, and the hint shows "Opponent's turn…" or nothing. `layoutId` animations don't interfere with native drag-and-drop because they run on transforms.

## 4. File changes
```
engine/src/types.ts        + BattleEvent, BattleState.events
engine/src/setup.ts        emit battleStarted; init events
engine/src/turn.ts         emit turn/energy/draw/discard events; clone events
engine/src/moves.ts        emit move events
engine/src/events.test.ts  new
frontend/package.json      + motion@13.4.6 (exact); + vitest (store tests)
frontend/src/animation/timing.ts        duration table, reduced-motion helper
frontend/src/animation/useBattleEvents.ts
frontend/src/store/battleStore.ts       paced runner, busy, gameId
frontend/src/store/battleStore.test.ts  new
frontend/src/App.tsx                    MotionConfig + AnimatePresence around views
frontend/src/screens/*.tsx, cards/Card.tsx, styles.css
.kiro/steering/tech-stack.md, conventions.md   note Motion and "events drive animations"
```

## 5. Testing
- **Engine (Vitest):** each move type emits the expected events in order; KO includes a snapshot and `gameWon` is emitted correctly; events are deterministic for a given seed; the 25 existing tests still pass.
- **Store (Vitest with fake timers, no DOM):** the AI turn is applied one move at a time; `busy` blocks human moves; `newGame` mid-turn cancels pending steps; an AI-first opening is paced.
- **Browser (throwaway Playwright script, not committed):** screen transitions run; a full human turn plus a paced AI turn works; the KO ghost appears; drag-and-drop still works; no page errors; a reduced-motion run works.

## Decisions locked
- Events are an append-only field on the state, which also suits a future multiplayer server broadcasting them.
- Timing comes from a fixed table owned by the store, not from animation callbacks.
- Knock-outs are shown with ghosts from event snapshots, with no "delayed commit" of engine state.
- Motion 13.4.6, pinned exactly.
