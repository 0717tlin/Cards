import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getRetreatCost, isCreatureCard, type CardDefinition, type CreatureInPlay, type Move, type TrainerCard } from "@card-game/engine";
import { Card } from "../cards/Card";
import { useBattleStore, HUMAN } from "../store/battleStore";

function Dialog({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
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
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'));
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
      <div ref={ref} className="modal mon-dialog" role="dialog" aria-modal="true" aria-label={title}
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
  bench: CreatureInPlay[]; moves: Move[]; onMove: (move: Move) => void; onClose?: () => void; retreat?: boolean;
}) {
  return <Dialog title={retreat ? "Choose a mon to switch in" : "Choose your new active mon"} onClose={onClose}>
    <p className="muted small">{retreat ? "Select a benched mon. Your active will pay its retreat cost." : "Your active was knocked out. Choose a mon from your bench to continue."}</p>
    <div className="mon-choices">
      {bench.map((mon, benchIndex) => {
        const move = moves.find((candidate) => candidate.type === (retreat ? "retreat" : "promote") && candidate.benchIndex === benchIndex);
        return <div key={mon.uid} className="mon-choice">
          <Card card={mon.card} size="md" damage={mon.damage} attached={mon.attached} onClick={move ? () => onMove(move) : undefined} />
          <button className="btn btn--promote" disabled={!move} onClick={() => move && onMove(move)}>Choose {mon.card.name}</button>
        </div>;
      })}
    </div>
  </Dialog>;
}

export function MonDetails({ card, mon, active, moves, bench, onMove, onClose, onChooseTargets }: {
  card: CardDefinition; mon?: CreatureInPlay; active: boolean; moves: Move[]; bench: CreatureInPlay[];
  onMove: (move: Move) => void; onClose: () => void;
  onChooseTargets: (moves: Move[], label: string) => void;
}) {
  const player = useBattleStore((store) => store.state.players[HUMAN]);
  if (!isCreatureCard(card)) return <TrainerDetails card={card} moves={moves} onMove={onMove} onClose={onClose} onChooseTargets={onChooseTargets} />;
  const attacks = active ? moves.filter((move) => move.type === "attack") : [];
  return <Dialog title={card.name} onClose={onClose}>
    <div className="mon-details">
      <div className={mon ? "mon-details__card mon-details__card--energy" : "mon-details__card"}>
        <Card card={card} size="lg" damage={mon?.damage} attached={mon?.attached} energyPlacement={mon ? "tray" : "art"} />
      </div>
      <div className="mon-actions">
        {active && <>
          <h4>Active mon actions</h4>
          {card.attacks.map((attack) => {
            const move = attacks.find((candidate) => candidate.type === "attack" && candidate.attackId === attack.id);
            return <button key={attack.id} className="btn btn--attack" disabled={!move} onClick={() => move && onMove(move)}>
              {attack.name}{attack.damage > 0 ? ` · ${attack.damage}${attack.effects?.length ? "+" : ""} damage` : ""}
            </button>;
          })}
          <button className="btn" disabled={!moves.some((move) => move.type === "retreat")} onClick={() => onChooseTargets(moves.filter((move) => move.type === "retreat"), "Retreat")}>Retreat · {getRetreatCost(player)} energy</button>
          <p className="muted small">Available actions depend on your turn and attached energy.</p>
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
    : card.effect.kind === "heal" ? "There is no damaged mon this card can heal."
    : card.effect.kind === "draw" ? "Your deck is empty."
    : "Your active mon's Retreat Cost is already zero.";
  return <Dialog title={card.name} onClose={onClose}>
    <div className="mon-details"><div className="mon-details__card"><Card card={card} size="lg" /></div>
      <div className="mon-actions">
        <h4>{card.kind === "item" ? "Play Item" : "Play Supporter"}</h4>
        <button className="btn btn--new" disabled={plays.length === 0} onClick={() => {
          if (!plays[0]) return;
          if (plays.some((move) => move.targetUid)) onChooseTargets(plays, card.name);
          else onMove(plays[0]);
        }}>Use</button>
        {plays.length === 0 && <p className="muted small">{state.turnPlayer !== HUMAN ? "Wait for your turn to play this card." : unavailable}</p>}
      </div>
    </div>
  </Dialog>;
}
