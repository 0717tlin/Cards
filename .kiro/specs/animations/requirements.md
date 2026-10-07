# Animations & Screen Transitions — Requirements

## Introduction

Level B, scoped down: add screen transitions and in-battle animations so the game feels alive, like the reference game. There is **no** world map / journey screen and **no** pack-art home screen.

Two structural changes are needed to make animations possible:
1. The engine emits **structured battle events** (not only text log lines), so the UI knows exactly what happened in each move.
2. The AI's turn is **paced step by step** instead of resolving instantly, so each AI action can be seen.

Game rules do not change. The engine stays pure and deterministic; animations are presentation only.

## Scope

**In scope**
- Transitions between screens (menu, cards, deck builder, battle).
- Battle animations: turn-start banner, draw, energy generation, energy attach, benching, retreat/promote, attack, damage, knock-out, win/lose.
- A paced AI turn with input locked while it plays.
- Light polish on the other screens (card grid entry, deck-list add/remove).
- Respecting the OS "reduce motion" setting.

**Out of scope**
- World map / journey screen, pack art, pack opening.
- Sound, particles/confetti, speed settings or a "skip animations" button.
- Hand → bench shared-element fly (hand cards have no stable instance id; see design).
- Touch drag-and-drop.

## Requirements

### R1 — Structured battle events (engine)
**User story:** As the UI, I need a machine-readable record of what each move did, so I can animate it precisely.

1. The engine SHALL append structured events to `BattleState.events` for every state change that a player can see: battle start, turn start, energy generated, card drawn, energy attached, creature benched, retreat, promotion, attack used, damage dealt, knock-out, unattached energy discarded, and game won.
2. Events SHALL carry enough data to animate without diffing states (e.g. creature uid, player, amount, whether weakness applied, and a snapshot of a knocked-out creature).
3. Events SHALL be deterministic: the same seed and moves produce the same events.
4. The existing `log` (text) SHALL remain unchanged, and all existing engine tests SHALL pass.

### R2 — Paced AI turn
**User story:** As a player, I want to watch the opponent's turn happen action by action.

1. WHEN the AI is acting THEN the app SHALL apply one AI move at a time, with a short pause before each action and time for its animations to finish.
2. WHILE the AI is acting or animations are playing THEN the human SHALL NOT be able to drag, attack, or end the turn.
3. WHEN a new game is started during the AI's turn or during animations THEN any pending AI steps and animations SHALL be cancelled cleanly.
4. The AI's opening turn (when it goes first) SHALL also be paced.

### R3 — Screen transitions
1. WHEN the view changes THEN the outgoing screen SHALL animate out and the incoming screen SHALL animate in (short fade/slide, about 250 ms).
2. The main menu SHALL animate in on load (title and card fan staggered).

### R4 — Battle animations
1. **Turn start:** a "Your turn" / "Opponent's turn" banner SHALL slide in and out.
2. **Draw:** a newly drawn card SHALL slide into the hand from the deck side.
3. **Energy generated:** the energy-zone ring SHALL pulse when energy appears.
4. **Energy attached:** the energy SHALL visibly move from the energy zone onto the target creature (or pop in, if the move animation is not possible).
5. **Bench:** a creature placed on the bench SHALL animate into its slot.
6. **Retreat / promote:** creatures SHALL move smoothly between the bench and active spots.
7. **Attack:** the attacker SHALL lunge toward the opponent. The defender SHALL shake and show a floating damage number, with a "Weak!" tag when weakness applied. The HP shown SHALL update after the hit.
8. **Knock-out:** the knocked-out creature SHALL remain visible long enough to show the hit, then animate out toward the discard pile. The points badge SHALL pulse when points are scored.
9. **Win / lose:** the result banner SHALL animate in.
10. Animations SHALL play in event order. Each move's animations SHALL finish before the next AI action starts.

### R5 — Other screens
1. Card grids (viewer, deck builder pool) SHALL animate in with a light stagger, including when the viewer filter changes.
2. Deck-list rows SHALL animate on add/remove, and the per-card count badge SHALL pop when it changes.

### R6 — Accessibility & performance
1. WHEN the user's OS has "reduce motion" enabled THEN movement animations SHALL be replaced by instant changes or simple fades, and pacing delays SHALL be minimal while the AI's actions stay readable.
2. Animations SHALL use transforms/opacity (GPU-friendly) and SHALL NOT change game state or rules.
3. Drag-and-drop, clickable attacks, and End Turn SHALL keep working exactly as before.

## Decisions (resolved in design)
- **D1** Animation library: Motion for React (`motion`, pinned 13.4.6), compatible with React 18.3.1.
- **D2** Animation timing is a fixed duration table per event type; the UI does not wait on callbacks from components.
- **D3** Hand → bench uses an enter animation, not a shared-element fly, because hand cards have no instance id yet.
