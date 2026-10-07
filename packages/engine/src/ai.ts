// Basic AI opponent. Chooses only from the engine's legal moves and always
// terminates its turn (ends with an attack or a pass).

import type { BattleState, Move } from "./types.js";
import { getLegalMoves } from "./moves.js";
import { computeDamage } from "./combat.js";
import { opponentOf } from "./types.js";

/** Pick a single move for the acting player using a simple heuristic. */
export function chooseMove(state: BattleState): Move {
  const legal = getLegalMoves(state);
  if (legal.length === 0) {
    throw new Error("chooseMove called with no legal moves.");
  }

  // 1. If a promotion is required, promote the highest-HP benched creature.
  const promotes = legal.filter((m) => m.type === "promote");
  if (promotes.length > 0) {
    return bestPromote(state, promotes);
  }

  const trainers = legal.filter((move) => move.type === "playTrainer");
  if (trainers.length > 0) return trainers[0]!;

  // 2. Fill the bench: playing Basics gives a creature to promote after a KO,
  //    which avoids losing the instant the active is knocked out.
  const plays = legal.filter((m) => m.type === "playBasic");
  if (plays.length > 0) {
    return plays[0]!;
  }

  // 3. Attach the turn's energy to the active creature if possible.
  const attaches = legal.filter((m) => m.type === "attachEnergy");
  if (attaches.length > 0) {
    const active = state.players[state.turnPlayer].active;
    const toActive = active
      ? attaches.find((m) => m.type === "attachEnergy" && m.targetUid === active.uid)
      : undefined;
    return toActive ?? attaches[0]!;
  }

  // 4. Attack with the highest-damage legal attack (ends the turn).
  const attacks = legal.filter((m) => m.type === "attack");
  if (attacks.length > 0) {
    return bestAttack(state, attacks);
  }

  // 5. Otherwise pass.
  return { type: "pass" };
}

function bestPromote(state: BattleState, promotes: Move[]): Move {
  const player = state.phase.kind === "awaitPromotion"
    ? state.players[state.phase.player]
    : state.players[state.turnPlayer];
  let best = promotes[0]!;
  let bestHp = -1;
  for (const m of promotes) {
    if (m.type !== "promote") continue;
    const creature = player.bench[m.benchIndex];
    const hp = creature ? creature.card.hp - creature.damage : -1;
    if (hp > bestHp) {
      bestHp = hp;
      best = m;
    }
  }
  return best;
}

function bestAttack(state: BattleState, attacks: Move[]): Move {
  const active = state.players[state.turnPlayer].active;
  if (!active) return attacks[0]!;
  let best = attacks[0]!;
  let bestDamage = -1;
  for (const m of attacks) {
    if (m.type !== "attack") continue;
    const def = active.card.attacks.find((a) => a.id === m.attackId);
    const defender = state.players[opponentOf(state.turnPlayer)].active;
    const dmg = def && defender ? computeDamage(active, defender, def) : -1;
    if (dmg > bestDamage) {
      bestDamage = dmg;
      best = m;
    }
  }
  return best;
}
