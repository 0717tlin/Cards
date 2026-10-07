// @card-game/engine — public API. UI and AI consume only these exports.

export const ENGINE_VERSION = "0.3.0";

export * from "./types.js";
export { createBattle } from "./setup.js";
export { getLegalMoves, applyMove, actingPlayer, getRetreatCost } from "./moves.js";
export { getWinner } from "./winner.js";
export { chooseMove } from "./ai.js";
export {
  CARD_POOL,
  ALL_CARD_POOL,
  TRAINER_POOL,
  DECK_PLAYER,
  DECK_AI,
  PLAYER_ENERGY,
  AI_ENERGY,
} from "./cards.js";
export {
  canPayCost,
  computeDamage,
  isWeakTo,
  isKnockedOut,
  pointsForKo,
} from "./combat.js";
