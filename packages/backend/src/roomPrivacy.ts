import { actingPlayer, getLegalMoves, opponentOf, type BattleEvent, type BattleState, type FighterCard, type PlayerId, type RoomView, type GuestView } from "@card-game/engine";

const HIDDEN_CARD: FighterCard = { id: "hidden", name: "Hidden card", hp: 0, type: "colorless", stage: "basic", attacks: [], retreatCost: 0, weakness: null, isEx: false };

/** Never serialize the authoritative state directly. Private logs are rebuilt from visible events. */
export function privateBattleView(state: BattleState, viewer: PlayerId): NonNullable<RoomView["battle"]> {
  const map = (id: PlayerId): PlayerId => id === viewer ? "P1" : "P2";
  const events = structuredClone(state.events).flatMap<BattleEvent>(event => {
    if (event.kind === "deckPeeked" && event.player !== viewer) return [];
    if (event.kind === "battleStarted") return [{ ...event, firstPlayer: map(event.firstPlayer) }];
    return [{ ...event, player: map(event.player) }];
  });
  const player = (id: PlayerId) => ({
    ...structuredClone(state.players[id]), id: map(id),
    deck: state.players[id].deck.map(() => HIDDEN_CARD),
    hand: id === viewer ? structuredClone(state.players[id].hand) : state.players[id].hand.map(() => HIDDEN_CARD),
  });
  return {
    players: { P1: player(viewer), P2: player(opponentOf(viewer)) },
    turnPlayer: map(state.turnPlayer), turnNumber: state.turnNumber,
    phase: state.phase.kind === "main" ? { kind: "main" } : { ...state.phase, player: map(state.phase.player) },
    winner: state.winner ? map(state.winner) : null,
    events,
    log: events.map(event => {
      const who = "player" in event ? event.player === "P1" ? "You" : "Opponent" : "";
      switch (event.kind) {
        case "battleStarted": return "Battle started.";
        case "turnStarted": return `${who}: turn ${event.turnNumber}.`;
        case "trainerPlayed": return `${who} played ${event.card.name}.`;
        case "abilityUsed": return `${who} used ${event.name}.`;
        case "cardDrawn": return `${who} drew a card.`;
        case "deckPeeked": return `You viewed ${event.card.name} on top of the opponent's deck.`;
        case "damageDealt": return `${who} took ${event.amount} damage.`;
        case "coinFlipped": return `${who} flipped ${event.result}.`;
        case "knockedOut": return `${event.fighter.card.name} was knocked out (${event.pointsAwarded} points).`;
        case "gameWon": return `${who} won the battle.`;
        default: return "";
      }
    }).filter(Boolean),
  };
}

export function roomView(code: string, seat: PlayerId, revision: number, players: Record<PlayerId, GuestView | null>, state: BattleState | null): RoomView {
  return {
    code, seat, revision, players,
    status: state ? state.winner ? "finished" : "playing" : "waiting",
    battle: state ? privateBattleView(state, seat) : null,
    legalMoves: state && !state.winner && actingPlayer(state) === seat ? getLegalMoves(state) : [],
  };
}
