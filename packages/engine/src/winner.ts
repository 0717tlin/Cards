// Winner query.

import type { BattleState, PlayerId } from "./types.js";

export function getWinner(state: BattleState): PlayerId | null {
  return state.winner;
}
