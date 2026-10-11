# Code Conventions

## General

- TypeScript strict mode. No `any` unless justified with a comment. Prefer precise types and discriminated unions.
- Prefer pure functions and immutable updates in the engine. Functions that apply a move return a new state rather than mutating in place (or mutate a draft that is clearly scoped). Never mutate shared state passed by the caller.
- Name things by domain terms (see game-glossary.md), not by implementation detail.

## Engine specifics

- The engine exposes a small, explicit API surface: create state, list legal moves, apply a move, check for a winner. UI and AI consume only this surface.
- Every rule should be reachable through "list legal moves" + "apply move". The UI should never need to know a rule the engine does not enforce. If the UI can construct an illegal action, the engine must reject it.
- No I/O, no timers, no logging side effects in engine code.
- AI compares bounded preparation sequences before choosing an attack or pass: consider knockouts/points, counterattack survival, healing value, evolution, retreat/switch targets, bench synergy, energy readiness, and multi-attack turns. Simulations use legal engine moves, isolated preview fighter IDs, and fixed RNG samples rather than the live battle seed. Never consult opposing hands or deck contents, or unknown draw outcomes. Draw/search plays are scored without simulating hidden cards. Planning must not mutate battle state, consume its RNG, or allocate real fighter IDs; verify legality and game completion alongside tactical regression tests.
- After implementing each engine feature, including changes to engine card data or rules, rebuild the compiled engine package from the repository root with `npm run build --workspace @card-game/engine`. The frontend resolves `@card-game/engine` through its compiled package output; restart an already-running frontend dev server after the rebuild so it picks up the change.

- Ali Abdelaziz is a Supporter that chooses a damaged opposing bench fighter and swaps it with their active. Require an explicit legal target, use the normal Supporter allowance, clear outgoing statuses as for other switches, and trigger the incoming fighter's ability using its owner's energy zone. Switching pays no retreat cost and does not end the turn.

## Frontend specifics

- Components are function components with hooks.
- Card Viewer and the Deck Builder card pool share dropdown filters for fighter type/card kind and rarity, plus type/HP/rarity sorting in either direction. Default to type ascending. When sorting by HP, trainers remain after fighters in both directions. Filtering the builder pool never changes the selected deck.
- Game state lives in a Zustand store that wraps the engine; components read from the store and dispatch engine moves.
- Keep rendering dumb: the store holds the authoritative engine state, components render it.
- Use "fighter" / "fighters" in player-facing copy. Clicking a battle card opens an enlarged view; attack and retreat actions are offered there using engine legal moves.
- When the human must promote after a knockout, prompt them to choose a new active fighter from the bench after animations finish.
- Keep the battle within the viewport. Active slots are larger than bench slots and visually separated from them.
- Battle tips, turn count, battle log, and End Turn belong in the side controls. Show Cancel beside the current optional target prompt; omit the Supporter availability hint.
- In the deck editor, click a card to add it, right-click to remove a copy, and hold for half a second to enlarge it. Moving off the card cancels the hold.
- New Game opens saved-deck selection before starting a battle. Edit loads that saved deck into the editor; Save updates its id, while Create deck starts a new named deck. Store card ids and counts in versioned browser local storage without accounts. Decks contain 20 cards, at least one Basic fighter, and at most two copies per card. Both built-in decks follow the same limits. Existing over-limit saved decks stay editable but cannot be played, saved, or shared until corrected.
- Saved decks also store selected energy types. Require at least one type. Each eligible turn generates one energy uniformly from the selected types using seeded battle RNG; one type requires no RNG roll. Older saved decks migrate to their previous dominant fighter energy (Fire for colourless decks).
- Card artwork and rules sections keep identical proportions at all sizes, including hand and enlarged views.
- Card frame thickness follows the measured layout width via `--card-width`, so enlarging or resizing a card preserves the border-to-card ratio. Rare frames use shiny silver; ex frames use gold foil.
- Card Viewer, Deck Builder, and Deck Selection use a viewport-height shell: scroll only the main content, and keep the title bar and Home/Cards/Decks/Battle navigation visible without moving.
- Menu pack opening is a presentation-only feature: five independent uniformly random cards from `ALL_CARD_POOL`, allowing duplicates, with no rarities or inventory changes. Support swipe/button opening, individual reveals, a five-card summary, inspection, replay, and reduced motion.
- Attack effects are structured data on `AttackDef.effects` and resolve in engine combat; rules text only describes them. Damage bonuses are applied before weakness, and AI evaluates resolved damage.
- `ignoreWeakness` attacks omit the weakness bonus in damage resolution, AI evaluation, and previews, and emit damage events without a weakness marker. Other bonuses and damage reduction still apply.
- Hatake (`useNonExBenchAttacks`) exposes the attacks printed on non-ex fighters on the owner's bench. Use `getAvailableAttacks` for legal moves, attack resolution, action buttons, and AI evaluation. Pay costs with the active fighter's energy; apply its type, abilities, and attack modifiers. Copy attack effects, not source abilities, and do not recursively borrow attacks. Duplicate attack IDs appear once. The Last Stylebender evolves from Israel Adesanya and has no printed attacks.
- Sean Strickland evolves from Prospect (basic) to Contender (stage1) to Champion (stage2); `stageLabel` supplies these display names without changing other evolution labels. Underdog (`damageBonusWhenBehindOnPoints`) adds 20 to damaging active-target attacks only when the opponent has strictly more knockout points. Pass the current points comparison into `computeDamage` for resolution, previews, and AI. Do not copy source abilities through Hatake.
- `discardSelfEnergy.unlessBenchCardId` skips the energy discard only when the attacker's bench contains the specified card. Soto Gari costs one Water and one Colorless, deals 50, and discards one energy without a benched Khabib. Umar's Calf Kick costs one Water and deals 20 plus 20 with a benched Khabib.
- `switchWithBench` attacks select your own benched fighter through legal moves, deal damage, then swap without paying retreat energy or using the once-per-turn retreat. An empty bench does not prevent damage. Switching clears the outgoing fighter's statuses and emits `switched`. `attachZoneEnergyOnBecomingActive` resolves after retreat, promotion, or an attack switch: consume the incoming fighter owner's available zone energy and attach it, emitting ability and energy events. An empty zone gives no energy; initial placement and evolution do not trigger this ability.
- Coin flips consume the battle's seeded RNG. `flipUntilTails` adds its damage bonus for each heads, emits a `coinFlipped` event for every result, and animates before the attack lands. AI evaluates the expected bonus without consuming RNG.
- `coinAttackFailsOnTails` flips once before any attack effects. Tails consumes the attack and ends its turn normally, without damage events or other attack effects; turn checkup still runs. Heads resolves normal damage and effects. Rolling Thunder uses this effect with 180 damage for two Fighting and one Colorless. AI forecasts both outcomes and halves fully modified damage for its expected-damage heuristic.
- Evolution is an engine move from hand onto a matching active or benched fighter. It preserves identity, damage, and energy; disallows evolution on the player's first turn, the turn the fighter entered play, or twice in a turn. Discard all stages on knockout. Click Evolve and choose a highlighted target, or drag onto it.
- `coinDamageBonus` flips once for bonus damage on heads. `reduceIncomingDamage` protects the attacker through the opponent's next turn, reduces damage after weakness with a zero floor, and expires at the owner's next turn or on retreat/evolution.
- Decks and hands contain `CardDefinition` (fighters, Items, Supporters). `ALL_CARD_POOL` includes every card; `CARD_POOL` retains fighter definitions and `TRAINER_POOL` holds Items/Supporters. Use `isFighterCard` before accessing fighter-only fields.
- Trainer moves, healing targets, the one-Supporter-per-turn limit, and temporary retreat reductions are enforced by engine legal moves. Played trainers go to the discard pile. Healing is capped at full HP; no-effect healing/draw/reduction plays are not offered.
- Herb Dean's `boostActiveAttackDamage` adds 10 to damaging attacks against the opposing active for the current turn. Store the bonus on the player so it survives retreat/switching; apply it before incoming damage reduction and clear it at turn boundaries. Bench damage, Burn checkup, and status-only attacks receive no bonus. AI damage evaluation and the attack preview use the same bonus.
- Activated abilities use structured `AbilityDef.effect` and engine `useAbility` moves. Fattening Up works on active or benched Paddy: once per fighter per own turn, discard one attached Fire Energy to heal up to 20 damage without ending the turn. Healthy fighters and fighters without Fire Energy cannot activate it. Retreat does not reset usage.
- Fathers Plan is a `searchDeckToTop` ability usable by active or benched Khabib once per own turn per fighter. Its legal moves specify a `cardId` for regular Islam or Umar present in the deck; move exactly one copy to the top without drawing, shuffling, or consuming RNG. Fight Contract uses `searchRandomBasic`: uniformly select a Basic fighter copy, put it in hand, then Fisher–Yates shuffle the remaining deck with seeded RNG. No eligible Basic means no legal play. The `deckShuffled` event drives the deck-pile animation and input lock; reduced motion skips it.
- Targeted cards use "Use", then highlight eligible fighters on the board. Only a legal target click resolves the action; cancellation spends nothing. Retreat and required promotion also select highlighted benched fighters on the board. The full battle log opens from a side button.

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

- Bleeding deals 10 damage to each affected active at every turn boundary, stacks with Burn, consumes no RNG, and clears only on moving to the bench (not evolution). Checkup damage ignores weakness, reduction, and attack bonuses.
- Relentless Pressure permits at most two attacks per player turn. The first attack keeps the turn open and skips checkup; if it knocks out the opponent, resolve their promotion before continuing the attacking turn. Energy costs must still be satisfied for each attack.
- Download is once per fighter per own turn, active only, with a nonempty opposing deck. Emit deckPeeked for the acting player without changing the deck or RNG; show a dismissible top-card dialog only for the human actor.

## Deck codes

- Deck validation lives in the engine and is shared by the editor and backend: exactly 20 cards, at most two copies of any fighter or trainer, and at least one Basic or Prospect. Plain Common fighters with damage-only attacks have one attack.
- Copy code is available only for legal named decks with energy types. Codes are exactly six uppercase letters/digits. The backend stores immutable deck snapshots (name, card counts, energy types) in `packages/backend/data/deck-codes.json`; never reuse a code for different contents. Repeated copies of the same snapshot reuse its code. Serialize writes, avoid collisions, and persist before returning a code.
- Import code validates current card/deck rules, saves a new browser deck, and opens it in the builder. Reject missing/invalid/obsolete codes without changing any saved deck.
- Short codes require the same running backend for both sender and recipient. Run `npm run dev:backend` alongside `npm run dev:frontend`; Vite proxies `/api` to port 3001. Keep the registry file out of Git, but retain it across server restarts. Production hosting must forward `/api` to the backend and preserve its data directory.

## Targeted attacks and Feint

- Connor McGregor's Capoeira Kick uses `damageAnyFighter` with `discardAllSelfEnergy`. Require two Grass energy and an explicit opposing active/bench target through legal moves. Discard every attached energy before dealing damage, including surplus and other types. Active targets use normal attack modifiers; bench targets take fixed damage without weakness or active-only modifiers. Handle bench and active knockouts, ex points, promotion, and wins through normal battle events.
- Sean O'Malley is a Grass Prospect and evolves into Suga, a Grass Identity. Suga's Switch Kick reuses `switchWithBench`, including damage with an empty bench.
- Feint's `increaseIncomingDamage` applies a 20-damage vulnerability to the defending fighter through the attacker's next turn (`expiresAfterTurn = current turn + 2`). Add the bonus only to positive attack damage, before damage reduction; exclude checkup and bench damage. Clear it on retreat, attack switching, evolution, or at the end of its expiry turn. Emit `damageVulnerabilityApplied`, include it in damage previews and AI evaluation, and never mutate shared battle state.

- `FighterCard.isProspect` permits a requested Prospect label before its Identity is released (Israel Adesanya). It does not alter the internal Basic stage or opening-hand, deck-validation, and search rules. Other Prospect labels remain derived from evolution links. Paulo Costa evolves into Secret Juice; Adesanya reuses the existing Feint mechanic.

## Card photo placeholders

- Card photos are local WebP assets under `frontend/public/images/fighters` and `images/trainers`; resolve them with `fighterPhotos.ts` / `trainerPhotos.ts`. Identity and ex aliases reuse the base fighter photo. Full-card layout and proportional borders do not change.
- Source/profile URLs are recorded in each image directory's `sources.json`; preserve photo attribution and license credits in `public/images/credits.html`, linked from the card viewer. Official UFC portraits can be refreshed with `scripts/fetch-fighter-photos.py` (Python + Pillow).
- Portraits use an upper-body crop over the energy-type gradient, lazy loading, and async decoding. Images are non-draggable so they do not interfere with card interactions. Missing or failed photos fall back to the existing glyph/name artwork.
