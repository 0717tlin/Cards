# UI Expansion — Implementation Plan

- [ ] 1. Extend card definition format (data-driven, stages + ability slot)
  - `types.ts`: add `Stage`, `AbilityDef`, optional `ability`, `evolvesFrom`, `art`, optional attack `text`. Keep rule-relevant fields intact.
  - Migrate `cards.ts` to the richer format (add `art` keys; keep all current fighters Basic; optionally add one Stage1/Stage2 + one ability example for the viewer).
  - _Requirements: R2_

- [ ] 2. Add the discard pile to the engine
  - `types.ts`: add `DiscardEntry` and `PlayerState.discard`.
  - `setup.ts`: initialize `discard: []`.
  - `turn.ts`: clone `discard`; end-of-turn unattached energy -> discard.
  - `moves.ts`: retreat cost energy -> discard; KO'd fighter + its energy -> discard.
  - Tests: discard after end-of-turn, retreat, and KO; existing suite still green.
  - _Requirements: R6_

- [ ] 3. Card art placeholder resolver
  - `cards/cardArt.ts`: map `EnergyType` -> color/gradient; deterministic placeholder; hook for future real assets keyed by `card.art`.
  - _Requirements: R3.2_

- [ ] 4. Framed Card component
  - `cards/Card.tsx` (+ styles): reference-style layout with size variants and optional battle overlays (HP remaining, attached energy pips, badges). Renders ability block and attack energy-cost pips.
  - _Requirements: R3_

- [ ] 5. App navigation shell
  - `navigation/useAppView.ts` (zustand) + rework `App.tsx` into nav + active screen.
  - _Requirements: R1_

- [ ] 6. Card Viewer screen
  - `screens/CardViewer.tsx`: grid of all definitions via `Card`; optional type filter.
  - _Requirements: R4_

- [ ] 7. Deck Builder (first version)
  - `deck/useDeckBuilder.ts` (selection + validation: 20 cards, copy limit 2, >=1 Basic) and `screens/DeckBuilder.tsx` (add/remove, counter, warnings, start battle).
  - _Requirements: R5_

- [ ] 8. Battle screen rebuild (PTCGP layout)
  - Extend `battleStore.newGame` to accept `{ humanDeck? }` (fallback to default).
  - `screens/Battle.tsx`: active + 3 bench + hand + deck count + energy zone + discard pile, using `Card`; reuse existing controls/log/legal-move flow.
  - _Requirements: R7_

- [ ] 9. Verify end-to-end
  - `npm run build` (all packages) and `npm run test` green; dev server: all three screens render; deck built in the builder starts and completes a battle vs AI.
  - _Requirements: R1–R7_
```
