# Battle System — Implementation Plan

- [ ] 1. Define engine domain types and public API skeleton
  - Create `types.ts` with `PlayerId`, `EnergyType`, `AttackDef`, `CreatureCard`, `CreatureInPlay`, `PlayerState`, `Phase`, `BattleState`, and the `Move` union.
  - Stub `index.ts` to re-export types and the four API functions.
  - _Requirements: R8_

- [ ] 2. Implement the seeded RNG
  - `rng.ts`: `mulberry32`, `shuffle` (Fisher–Yates), `nextInt`, threaded via numeric state.
  - Unit test: same seed → same sequence and same shuffle.
  - _Requirements: R1.1, R1.2_

- [ ] 3. Build the original card pool and two fixed decks
  - `cards.ts`: ~8–12 original Basic creatures (original names/types), including at least one EX and clear weakness relationships. Two predefined 20-card decks (player, AI).
  - _Requirements: R1, R5, R7_

- [ ] 4. Implement setup (`createBattle`)
  - `setup.ts`: shuffle, draw 5, mulligan-to-Basic, auto-place active, pick starter, begin turn 1 with the no-energy/no-draw exception.
  - Tests: determinism from seed; hand has a Basic; starter turn-1 exception.
  - _Requirements: R1, R2.1, R2.2_

- [ ] 5. Implement turn flow
  - `turn.ts`: `beginTurn` (energy + draw with turn-1 exception, reset per-turn flags), `endTurn` (discard unattached energy, swap player, begin next turn).
  - Tests: energy generated per turn; unattached energy discarded; flags reset.
  - _Requirements: R2, R3_

- [ ] 6. Implement combat
  - `combat.ts`: energy-cost satisfaction (incl. colorless), damage with weakness +20, KO detection, point awards (1 normal / 2 EX), energy discard on KO.
  - Tests: cost checks, weakness bonus, KO, point values.
  - _Requirements: R5_

- [ ] 7. Implement legal moves + apply move (rule core)
  - `moves.ts`: `getLegalMoves` (attachEnergy, playBasic, retreat, attack, pass, promote — each gated by current rules and per-turn limits) and `applyMove` (validate against legal set, mutate a scoped draft, return new state). Attack ends turn; KO may enter `awaitPromotion`.
  - Tests: illegal moves rejected; bench cap; attach once/turn; retreat cost; attack ends turn.
  - _Requirements: R2, R3, R4, R5, R6, R8_

- [ ] 8. Implement promotion + winner
  - `winner.ts` and promotion handling in `moves.ts`/`turn.ts`: KO with bench → `awaitPromotion` (only `promote` legal); KO with empty bench → loss; reaching 3 points → win; no moves legal after a winner exists.
  - Tests: promotion flow; loss on empty bench; win at 3 points.
  - _Requirements: R6, R7_

- [ ] 9. Implement the AI opponent
  - `ai.ts`: `chooseMove(state)` heuristic (promote → attach → best attack → pass), always via `getLegalMoves`, always terminates the turn.
  - Tests: returns only legal moves; always ends the AI turn from arbitrary states.
  - _Requirements: R9_

- [ ] 10. Wire the engine public API and build
  - Finalize `index.ts` exports (`createBattle`, `getLegalMoves`, `applyMove`, `getWinner`, `chooseMove`, types, cards/decks). Ensure engine builds and full engine test suite passes.
  - _Requirements: R8, R9_

- [ ] 11. Frontend battle store
  - `battleStore.ts` (zustand): hold `BattleState`, expose `legalMoves`, `dispatch(move)`, `runAiTurn()` loop, `newGame(seed)`.
  - _Requirements: R10_

- [ ] 12. Frontend battle UI
  - Components: `Board`, `CreatureView` (HP bar, energy pips, EX badge), `Hand`, `Controls` (buttons from legal moves), `ResultBanner`. Start a battle on load; play against AI end-to-end; show result.
  - Manual verification: full game playable to a win/loss in the browser.
  - _Requirements: R10_
```
