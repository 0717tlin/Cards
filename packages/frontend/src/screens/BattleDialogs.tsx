import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ALL_CARD_POOL, computeDamage, getAvailableAttacks, getFighterStageLabel, getRetreatCost, isFighterCard, type CardDefinition, type FighterInPlay, type Move, type TrainerCard } from "@card-game/engine";
import { Card } from "../cards/Card";
import { useBattleStore, HUMAN, AI } from "../store/battleStore";

export function Dialog({ title, onClose, children, className = "fighter-dialog" }: { title: string; onClose?: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current?.();
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}
        tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <h3>{title}</h3>
          {onClose && <button className="btn btn--sm" onClick={onClose}>Close</button>}
        </div>
        {children}
      </div>
    </div>, document.body
  );
}

export function BattleLog({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  return <Dialog title="Battle log" onClose={onClose}>
    <ol className="battle-log-history">{lines.map((line, index) => <li key={index}>{line}</li>)}</ol>
  </Dialog>;
}

export function ChooseActive({ bench, moves, onMove, onClose, retreat = false }: {
  bench: FighterInPlay[]; moves: Move[]; onMove: (move: Move) => void; onClose?: () => void; retreat?: boolean;
}) {
  return <Dialog title={retreat ? "Choose a fighter to switch in" : "Choose your new active fighter"} onClose={onClose}>
    <p className="muted small">{retreat ? "Select a benched fighter. Your active will pay its retreat cost." : "Your active was knocked out. Choose a fighter from your bench to continue."}</p>
    <div className="fighter-choices">
      {bench.map((fighter, benchIndex) => {
        const move = moves.find((candidate) => candidate.type === (retreat ? "retreat" : "promote") && candidate.benchIndex === benchIndex);
        return <div key={fighter.uid} className="fighter-choice">
          <Card card={fighter.card} size="md" damage={fighter.damage} paralyzed={fighter.paralyzed} burned={fighter.burned} bleeding={fighter.bleeding} retreatCostIncrease={fighter.retreatCostIncrease} attached={fighter.attached} onClick={move ? () => onMove(move) : undefined} />
          <button className="btn btn--promote" disabled={!move} onClick={() => move && onMove(move)}>Choose {fighter.card.name}</button>
        </div>;
      })}
    </div>
  </Dialog>;
}

export function FighterDetails({ card, fighter, active, moves, bench, onMove, onClose, onChooseTargets }: {
  card: CardDefinition; fighter?: FighterInPlay; active: boolean; moves: Move[]; bench: FighterInPlay[];
  onMove: (move: Move) => void; onClose: () => void;
  onChooseTargets: (moves: Move[], label: string) => void;
}) {
  const player = useBattleStore((store) => store.state.players[HUMAN]);
  const defender = useBattleStore((store) => store.state.players[AI].active);
  const opponentPoints = useBattleStore((store) => store.state.players[AI].points);
  if (!isFighterCard(card)) return <TrainerDetails card={card} moves={moves} onMove={onMove} onClose={onClose} onChooseTargets={onChooseTargets} />;
  const attacks = active ? moves.filter((move) => move.type === "attack") : [];
  const retreatCost = getRetreatCost(player);
  return <Dialog title={card.name} onClose={onClose}>
    <div className="fighter-details">
      <div className={fighter ? "fighter-details__card fighter-details__card--energy" : "fighter-details__card"}>
        <Card card={card} size="lg" damage={fighter?.damage} paralyzed={fighter?.paralyzed} burned={fighter?.burned} bleeding={fighter?.bleeding} retreatCostIncrease={fighter?.retreatCostIncrease} attached={fighter?.attached} energyPlacement={fighter ? "tray" : "art"} />
      </div>
      <div className="fighter-actions">
        {fighter && card.ability?.effect?.kind === "peekOpponentDeck" && <button className="btn" disabled={!moves.some(move => move.type === "useAbility")} onClick={() => { const move = moves.find(move => move.type === "useAbility"); if (move) onMove(move); }}>Download · View opponent's top card</button>}
        {fighter && card.ability?.effect?.kind === "searchDeckToTop" && <>
          <h4>{card.ability.name}</h4>
          <p className="muted small">Choose a fighter to put on top of your deck. Once per turn.</p>
          {card.ability.effect.cardIds.map(cardId => {
            const move = moves.find(candidate => candidate.type === "useAbility" && candidate.cardId === cardId);
            return <button key={cardId} className="btn" disabled={!move} onClick={() => { if (move) onMove(move); }}>Choose {ALL_CARD_POOL[cardId]?.name ?? cardId}</button>;
          })}
        </>}
        {fighter && card.ability?.effect?.kind === "discardEnergyToHeal" && <>
          <button className="btn" disabled={!moves.some((move) => move.type === "useAbility")} onClick={() => {
            const move = moves.find((candidate) => candidate.type === "useAbility");
            if (move) onMove(move);
          }}>{card.ability.name} · Heal 20 HP</button>
          <p className="muted small">Discard one attached Fire Energy. Once per turn; requires damage to heal.</p>
        </>}
        {card.stage !== "basic" && !fighter && <>
          <button className="btn" disabled={!moves.some((move) => move.type === "evolve")} onClick={() => onChooseTargets(moves.filter((move) => move.type === "evolve"), "Evolve")}>Evolve</button>
          <p className="muted small">Choose a matching fighter already in play. Fighters cannot evolve on your first turn or the turn they entered play.</p>
        </>}
        {active && <>
          <h4>Active Fighter Actions</h4>
          {(fighter ? getAvailableAttacks(fighter, bench) : card.attacks).map((attack) => {
            const attackMoves = attacks.filter((candidate) => candidate.type === "attack" && candidate.attackId === attack.id);
            const move = attackMoves[0];
            const benchDamage = attack.effects?.find(effect => effect.kind === "benchDamage");
            const targetedDamage = attack.effects?.find(effect => effect.kind === "damageAnyFighter");
            const damage = fighter && defender ? computeDamage(fighter, defender, attack, 0, bench, player.attackDamageBonus ?? 0, opponentPoints > player.points) : attack.damage;
            const coinDamage = attack.effects?.find(effect => effect.kind === "coinDamagePerHeads");
            const random = attack.effects?.some((effect) => effect.kind === "flipUntilTails" || effect.kind === "coinDamageBonus");
            return <button key={attack.id} className="btn btn--attack" disabled={!move} onClick={() => {
              if (!move) return;
              if (move.type === "attack" && move.targetUid) onChooseTargets(attackMoves, `${attack.name}: ${attack.effects?.some(effect => effect.kind === "switchWithBench") ? "choose your new active fighter" : targetedDamage ? "choose an opponent's fighter" : "choose an opponent's benched fighter"}`);
              else onMove(move);
            }}>
              {attack.name}{targetedDamage?.kind === "damageAnyFighter" && <> · {targetedDamage.amount} damage · Choose target</>}{coinDamage?.kind === "coinDamagePerHeads" && <> · {coinDamage.amount}× damage</>}{benchDamage?.kind === "benchDamage" && <> · {benchDamage.amount} bench damage</>}{attack.damage > 0 && <> · <span className={damage !== attack.damage ? "attack-preview--modified" : undefined}>{damage}{random ? "+" : ""}</span> damage</>}
            </button>;
          })}
          <button className="btn" disabled={!moves.some((move) => move.type === "retreat")} onClick={() => onChooseTargets(moves.filter((move) => move.type === "retreat"), "Retreat")}>Retreat · <span className={retreatCost !== card.retreatCost ? "retreat-preview--modified" : undefined}>{retreatCost === 0 ? "Free" : `${retreatCost} energy`}</span></button>
        </>}
        {moves.filter((move) => move.type === "attachEnergy" || move.type === "playBasic").map((move) =>
          <button key={move.type} className="btn" onClick={() => onMove(move)}>{move.type === "attachEnergy" ? "Attach energy" : "Play to bench"}</button>
        )}
      </div>
    </div>
  </Dialog>;
}

function TrainerDetails({ card, moves, onMove, onClose, onChooseTargets }: {
  card: TrainerCard; moves: Move[]; onMove: (move: Move) => void; onClose: () => void;
  onChooseTargets: (moves: Move[], label: string) => void;
}) {
  const state = useBattleStore((store) => store.state);
  const plays = moves.filter((move) => move.type === "playTrainer");
  const unavailable = state.players[HUMAN].hasPlayedSupporter && card.kind === "supporter"
    ? "You already played a Supporter this turn."
    : card.effect.kind === "heal" ? "There is no damaged fighter this card can heal."
    : card.effect.kind === "searchNamedFighterToTop" ? "There are no matching non-ex fighters left in your deck."
    : card.effect.kind === "switchDamagedOpponentBench" ? "Your opponent has no damaged benched fighter to switch into the active spot."
    : card.effect.kind === "draw" ? "Your deck is empty."
    : card.effect.kind === "searchRandomBasic" ? "There are no Basic or Prospect fighters left in your deck."
    : card.effect.kind === "boostActiveAttackDamage" ? "You need an active fighter to use this card."
    : "Your active fighter's Retreat Cost is already zero.";
  return <Dialog title={card.name} onClose={onClose}>
    <div className="fighter-details"><div className="fighter-details__card"><Card card={card} size="lg" /></div>
      <div className="fighter-actions">
        <h4>{card.kind === "item" ? "Play Item" : "Play Supporter"}</h4>
        {card.effect.kind === "searchNamedFighterToTop" && plays.map(move => {
          if (move.type !== "playTrainer" || !move.cardId) return null;
          const target = ALL_CARD_POOL[move.cardId];
          return <button key={move.cardId} className="btn" onClick={() => onMove(move)}>Choose {target?.name} {target && isFighterCard(target) ? `(${getFighterStageLabel(target)})` : ""}</button>;
        })}
        {card.effect.kind !== "searchNamedFighterToTop" &&
        <button className="btn btn--new" disabled={plays.length === 0} onClick={() => {
          if (!plays[0]) return;
          if (plays.some((move) => move.targetUid)) onChooseTargets(plays, card.name);
          else onMove(plays[0]);
        }}>Use</button>}
        {plays.length === 0 && <p className="muted small">{state.turnPlayer !== HUMAN ? "Wait for your turn to play this card." : unavailable}</p>}
      </div>
    </div>
  </Dialog>;
}
