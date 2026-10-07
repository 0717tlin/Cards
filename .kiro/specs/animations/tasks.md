# Animations & Screen Transitions — Implementation Plan

- [x] 1. Engine: structured battle events
  - Add `BattleEvent` and `BattleState.events`; emit events in setup/turn/moves per the design table; clone events.
  - `events.test.ts`: per-move events and order, KO snapshot, `gameWon`, determinism. Existing tests still green. Bump to 0.3.0.
  - _Requirements: R1_

- [x] 2. Add Motion and the timing module
  - Install `motion@13.4.6` (exact) in the frontend.
  - `animation/timing.ts`: duration table, `animationTime(events)`, `AI_THINK_MS`, reduced-motion detection.
  - _Requirements: R2, R6.1_

- [x] 3. Paced battle store
  - Replace the synchronous AI loop with the paced runner (`busy`, `gameId` cancellation, one AI move per step, paced opening).
  - Add Vitest to the frontend and write `battleStore.test.ts` with fake timers: stepping, input lock, cancel on new game, AI-first opening.
  - _Requirements: R2_

- [x] 4. Screen transitions
  - `MotionConfig reducedMotion="user"` + `AnimatePresence mode="wait"` keyed by view in `App.tsx`; staggered menu entrance.
  - _Requirements: R3, R6.1_

- [x] 5. `useBattleEvents` hook
  - Turn new events into short-lived effects (turn banner, damage pops, lunge/shake, KO ghosts, ring/points pulse, last attached).
  - _Requirements: R4_

- [x] 6. Battle animations
  - Turn banner, draw enter, bench/retreat/promote via `layoutId`, energy fly (with pop-in fallback), attack lunge + shake + damage pop + HP flash, KO ghost exit, points pulse, result banner.
  - Confirm drag-and-drop, attack clicks, and End Turn still work and are locked while busy.
  - _Requirements: R4, R6.2, R6.3_

- [x] 7. Other-screen polish
  - Staggered grid entry (viewer + builder, re-stagger on filter), deck-list row add/remove, count badge pop.
  - _Requirements: R5_

- [x] 8. Steering + verification
  - Update `tech-stack.md` (Motion) and `conventions.md` (events drive animations; no rules in UI).
  - `npm run build` + `npm run test` green; throwaway browser check of transitions, a full paced AI turn, a KO, drag-and-drop, and reduced motion.
  - _Requirements: R1–R6_
