import { createContext, useContext, useEffect, useState, type DragEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  actingPlayer,
  type CardDefinition,
  type CreatureInPlay,
  type DiscardEntry,
  type Move,
  type PlayerId,
  type PlayerState,
} from "@card-game/engine";
import { useBattleStore, HUMAN, AI } from "../store/battleStore";
import { useAppView } from "../navigation/useAppView";
import { Card, EnergyPip, Pop } from "../cards/Card";
import { useBattleEvents, type BattleEffects, type KoGhost } from "../animation/useBattleEvents";
import { BattleLog, MonDetails } from "./BattleDialogs";
import { EVENT_MS } from "../animation/timing";

// ---------------------------------------------------------------------------
// Drag & drop model
//
// Every interaction maps onto an engine move. A drag source is only enabled if
// the engine currently offers a move for it, and a drop zone only accepts a
// drag if (source, target) resolves to a legal move. No rules live here.
// ---------------------------------------------------------------------------

type DragPayload =
  | { kind: "hand"; handIndex: number }
  | { kind: "energy" };

type DropTarget =
  | { kind: "benchSlot" } // empty bench slot: play a Basic from hand
  | { kind: "creature"; uid: string }; // one of your mons: attach energy

/** Resolve a drag onto one of a zone's targets into a legal engine move. */
function resolveMove(moves: Move[], drag: DragPayload, targets: DropTarget[]): Move | undefined {
  for (const target of targets) {
    const found = moves.find((m) => {
      if (drag.kind === "hand" && target.kind === "benchSlot") {
        return m.type === "playBasic" && m.handIndex === drag.handIndex;
      }
      if (drag.kind === "energy" && target.kind === "creature") {
        return m.type === "attachEnergy" && m.targetUid === target.uid;
      }
      return false;
    });
    if (found) return found;
  }
  return undefined;
}

/** Whether a drag source has at least one legal move it could produce. */
function canDrag(moves: Move[], drag: DragPayload): boolean {
  return moves.some((m) => {
    if (drag.kind === "hand") return m.type === "playBasic" && m.handIndex === drag.handIndex;
    if (drag.kind === "energy") return m.type === "attachEnergy";
    return false;
  });
}

interface DndApi {
  drag: DragPayload | null;
  moves: Move[];
  start: (payload: DragPayload) => void;
  end: () => void;
  drop: (move: Move) => void;
}

function Draggable({
  dnd,
  payload,
  children,
  className = "",
}: {
  dnd: DndApi;
  payload: DragPayload;
  children: ReactNode;
  className?: string;
}) {
  const enabled = canDrag(dnd.moves, payload);
  return (
    <div
      className={`dnd-src${enabled ? " dnd-src--on" : ""} ${className}`}
      draggable={enabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", payload.kind); // required by Firefox
        e.dataTransfer.effectAllowed = "move";
        dnd.start(payload);
      }}
      onDragEnd={dnd.end}
    >
      {children}
    </div>
  );
}

function DropZone({
  dnd,
  targets,
  children,
  className = "",
}: {
  dnd: DndApi;
  targets: DropTarget[];
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const move = dnd.drag ? resolveMove(dnd.moves, dnd.drag, targets) : undefined;

  function allow(e: DragEvent) {
    if (!move) return;
    e.preventDefault(); // marks this element as a valid drop target
    e.dataTransfer.dropEffect = "move";
  }

  return (
    <div
      className={`dropzone${move ? " dropzone--valid" : ""}${move && over ? " dropzone--over" : ""} ${className}`}
      onDragEnter={(e) => {
        allow(e);
        if (move) setOver(true);
      }}
      onDragOver={allow}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (move) dnd.drop(move);
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated pieces
// ---------------------------------------------------------------------------

const SHAKE = [0, -9, 9, -7, 7, -4, 4, 0];
const TargetContext = createContext<{ active: boolean; uids: Set<string> }>({ active: false, uids: new Set() });
const s = (ms: number) => ms / 1000;

/** Which way this player's side "faces" (toward the center line). */
function towardCenter(player: PlayerId): number {
  return player === HUMAN ? -1 : 1;
}

/**
 * Floating damage number (and "Weak!" tag) over a creature being hit. A plain
 * CSS keyframe animation that runs once on mount (see .dmg-pop in styles.css);
 * its duration comes from the same timing table via a CSS variable.
 */
function DamagePop({ hit }: { hit: NonNullable<BattleEffects["hit"]> }) {
  return (
    <div
      key={hit.key}
      className="dmg-pop"
      style={{ ["--dur" as string]: `${EVENT_MS.damageDealt}ms` }}
    >
      -{hit.amount}
      {hit.weakness && <span className="dmg-pop__weak">Weak!</span>}
    </div>
  );
}

/**
 * A creature on the board. `layoutId={uid}` makes Motion animate it between
 * slots (retreat / promote); `initial` animates a newly benched creature in.
 */
function Creature({
  c,
  owner,
  fx,
  turnNumber,
  highlight = false,
  onInspect,
}: {
  c: CreatureInPlay;
  owner: PlayerId;
  fx: BattleEffects;
  turnNumber: number;
  highlight?: boolean;
  onInspect?: () => void;
}) {
  const targeting = useContext(TargetContext);
  const targetable = targeting.uids.has(c.uid);
  const dir = towardCenter(owner);
  const lunging = fx.lungeUid === c.uid;
  const hit = fx.hit?.uid === c.uid ? fx.hit : null;
  const damage = c.damage - (fx.pendingDamage[c.uid] ?? 0);
  const flying = fx.flyEnergy?.uid === c.uid;

  return (
    <motion.div
      layoutId={c.uid}
      className={`creature${targeting.active ? targetable ? " creature--targetable" : " creature--blocked" : ""}`}
      // Only a newly benched creature animates in; retreat/promote remounts
      // are handled by the shared layout animation instead.
      initial={fx.entering[c.uid] ? { opacity: 0, y: -dir * 60, scale: 0.9 } : false}
      animate={{
        opacity: 1,
        scale: 1,
        y: lunging ? [0, dir * 34, 0] : 0,
        x: hit ? SHAKE : 0,
      }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 30 },
        default: { duration: s(lunging ? EVENT_MS.attackUsed : hit ? EVENT_MS.damageDealt * 0.7 : 350) },
      }}
    >
      <Card
        card={c.card}
        size="sm"
        damage={damage}
        attached={c.attached}
        energyPlacement="tray"
        highlight={targeting.active ? targetable : highlight}
        onClick={targeting.active && !targetable ? undefined : onInspect}
        flyLayoutId={flying ? `energy-${owner}-${turnNumber}` : undefined}
      />
      {hit && <DamagePop hit={hit} />}
    </motion.div>
  );
}

/** A knocked-out creature, kept on screen for the hit, then sent to the discard. */
function Ghost({ ghost, hit }: { ghost: KoGhost; hit: BattleEffects["hit"] }) {
  const dir = towardCenter(ghost.player);
  const hitHere = hit?.uid === ghost.creature.uid ? hit : null;
  return (
    <motion.div
      className="ko-ghost"
      initial={false}
      animate={{ x: ghost.shaking ? SHAKE : 0 }}
      transition={{ duration: s(EVENT_MS.damageDealt * 0.7) }}
      exit={{
        opacity: 0,
        scale: 0.55,
        x: 220,
        y: -dir * 40,
        rotate: 14,
        transition: { duration: s(EVENT_MS.knockedOut) * 0.8, ease: "easeIn" },
      }}
    >
      <div className="creature">
        <Card card={ghost.creature.card} size="sm" damage={ghost.damage} attached={ghost.creature.attached} energyPlacement="tray" />
        {/* The finishing blow gets its damage number (and "Weak!" tag) too. */}
        {hitHere && <DamagePop hit={hitHere} />}
      </div>
    </motion.div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return <div className="slot slot--empty">{label}</div>;
}

function EnergyZone({
  player,
  fx,
  turnNumber,
  dnd,
}: {
  player: PlayerState;
  fx: BattleEffects;
  turnNumber: number;
  dnd: DndApi | null;
}) {
  const visible = player.pendingEnergy && !fx.energyHidden[player.id];
  const pulsing = fx.ringPulse?.player === player.id;
  const ring = (
    <motion.div
      className="zone__energy"
      animate={pulsing ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: s(EVENT_MS.energyGenerated) }}
      title={dnd && visible ? "Drag onto one of your creatures" : undefined}
    >
      {visible ? (
        // Shared layout id: when attached, the pip flies to the target creature.
        <motion.span
          layoutId={`energy-${player.id}-${turnNumber}`}
          style={{ display: "inline-flex" }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        >
          <EnergyPip type={player.pendingEnergy!} em={1.6} />
        </motion.span>
      ) : (
        "—"
      )}
    </motion.div>
  );
  return (
    <div className="zone">
      {dnd && visible ? (
        <Draggable dnd={dnd} payload={{ kind: "energy" }} className="zone__energy-src">
          {ring}
        </Draggable>
      ) : (
        ring
      )}
      <div className="zone__label">Energy</div>
    </div>
  );
}

function SideRail({
  player,
  fx,
  turnNumber,
  dnd,
  onInspectDiscard,
}: {
  player: PlayerState;
  fx: BattleEffects;
  turnNumber: number;
  dnd: DndApi | null;
  onInspectDiscard: () => void;
}) {
  return (
    <div className="zones">
      <div className="zone">
        <div className="zone__stack">{player.deck.length}</div>
        <div className="zone__label">Deck</div>
      </div>
      <EnergyZone player={player} fx={fx} turnNumber={turnNumber} dnd={dnd} />
      <button className="zone zone--btn" onClick={onInspectDiscard} title="Inspect discard pile">
        <Pop value={player.discard.length} className="zone__stack">
          {player.discard.length}
        </Pop>
        <div className="zone__label">Discard</div>
      </button>
    </div>
  );
}

function Points({ player, fx }: { player: PlayerState; fx: BattleEffects }) {
  const shown = player.points - (fx.pendingPoints[player.id] ?? 0);
  return (
    <Pop value={shown} className="points">
      {shown} pts
    </Pop>
  );
}

function ActiveRow({
  ghosts,
  hit,
  children,
}: {
  ghosts: KoGhost[];
  hit: BattleEffects["hit"];
  children: ReactNode;
}) {
  return (
    <div className="row row--active">
      {children}
      <AnimatePresence>
        {ghosts.map((g) => (
          <Ghost key={g.key} ghost={g} hit={hit} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function OpponentZone({
  player,
  isTurn,
  fx,
  turnNumber,
  onInspectDiscard,
  onInspect,
}: {
  player: PlayerState;
  isTurn: boolean;
  onInspect: (mon: CreatureInPlay) => void;
  fx: BattleEffects;
  turnNumber: number;
  onInspectDiscard: () => void;
}) {
  const ghosts = fx.ghosts.filter((g) => g.player === player.id);
  return (
    <section className={`pzone pzone--opponent${isTurn ? " pzone--turn" : ""}`}>
      <div className="pzone__head">
        <h3>Opponent (AI)</h3>
        <span className="hand-count" aria-label={`${player.hand.length - (fx.hiddenDraws[player.id] ?? 0)} cards in opponent's hand`}>
          Hand <strong>{player.hand.length - (fx.hiddenDraws[player.id] ?? 0)}</strong>
        </span>
        <Points player={player} fx={fx} />
      </div>
      <div className="pzone__board">
        <div className="pzone__rows">
          <div className="row row--bench">
            {player.bench.map((c) => (
              <Creature key={c.uid} c={c} owner={player.id} fx={fx} turnNumber={turnNumber} onInspect={() => onInspect(c)} />
            ))}
            {Array.from({ length: 3 - player.bench.length }).map((_, i) => (
              <EmptySlot key={i} label="bench" />
            ))}
          </div>
          <ActiveRow ghosts={ghosts} hit={fx.hit}>
            {player.active ? (
              <Creature c={player.active} owner={player.id} fx={fx} turnNumber={turnNumber} highlight onInspect={() => onInspect(player.active!)} />
            ) : (
              <EmptySlot label="active" />
            )}
          </ActiveRow>
        </div>
        <SideRail
          player={player}
          fx={fx}
          turnNumber={turnNumber}
          dnd={null}
          onInspectDiscard={onInspectDiscard}
        />
      </div>
    </section>
  );
}

function HumanZone({
  player,
  isTurn,
  fx,
  turnNumber,
  dnd,
  onInspectDiscard,
  onInspect,
}: {
  player: PlayerState;
  isTurn: boolean;
  onInspect: (mon: CreatureInPlay) => void;
  fx: BattleEffects;
  turnNumber: number;
  dnd: DndApi;
  onInspectDiscard: () => void;
}) {
  const ghosts = fx.ghosts.filter((g) => g.player === player.id);

  return (
    <section className={`pzone pzone--human${isTurn ? " pzone--turn" : ""}`}>
      <div className="pzone__head">
        <h3>You</h3>
        <Points player={player} fx={fx} />
      </div>
      <div className="pzone__board">
        <div className="pzone__rows">
          <ActiveRow ghosts={ghosts} hit={fx.hit}>
            {player.active ? (
              // Active accepts energy; attack and retreat live in the enlarged view.
              <DropZone
                dnd={dnd}
                targets={[{ kind: "creature", uid: player.active.uid }]}
              >
                <Creature
                  c={player.active}
                  owner={player.id}
                  fx={fx}
                  turnNumber={turnNumber}
                  highlight
                  onInspect={() => onInspect(player.active!)}
                />
              </DropZone>
            ) : (
              <EmptySlot label="active" />
            )}
          </ActiveRow>
          <div className="row row--bench">
            {player.bench.map((c, benchIndex) => (
              <DropZone key={c.uid} dnd={dnd} targets={[{ kind: "creature", uid: c.uid }]}>
                <Creature c={c} owner={player.id} fx={fx} turnNumber={turnNumber} onInspect={() => onInspect(c)} />
              </DropZone>
            ))}
            {Array.from({ length: 3 - player.bench.length }).map((_, i) => (
              <DropZone key={`empty-${i}`} dnd={dnd} targets={[{ kind: "benchSlot" }]}>
                <EmptySlot label="bench" />
              </DropZone>
            ))}
          </div>
        </div>
        <SideRail
          player={player}
          fx={fx}
          turnNumber={turnNumber}
          dnd={dnd}
          onInspectDiscard={onInspectDiscard}
        />
      </div>
    </section>
  );
}

/**
 * Stable keys for identical cards in hand: the nth copy of a card id. Copies
 * are indistinguishable, so this animates the right number of cards in/out.
 */
function handKeys(hand: CardDefinition[]): string[] {
  const seen = new Map<string, number>();
  return hand.map((card) => {
    const n = seen.get(card.id) ?? 0;
    seen.set(card.id, n + 1);
    return `${card.id}#${n}`;
  });
}

function Hand({ hand, hidden, dnd, onInspect }: { hand: CardDefinition[]; hidden: number; dnd: DndApi; onInspect: (card: CardDefinition, handIndex: number) => void }) {
  // Drawn cards are hidden until their draw animation is due, then slide in.
  const shown = hand.slice(0, hand.length - hidden);
  const keys = handKeys(shown);
  return (
    <div className="hand">
      <div className="slot-label">Your hand ({shown.length})</div>
      <div className="hand-row" style={{ ["--hand-count" as string]: Math.max(1, shown.length) }}>
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((card, handIndex) => (
            <motion.div
              key={keys[handIndex]}
              layout
              initial={{ opacity: 0, x: 90, y: 24, rotate: 8 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              exit={{ opacity: 0, y: -40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <Draggable dnd={dnd} payload={{ kind: "hand", handIndex }}>
                <Card card={card} size="sm" onClick={() => onInspect(card, handIndex)} />
              </Draggable>
            </motion.div>
          ))}
        </AnimatePresence>
        {shown.length === 0 && <span className="muted">empty</span>}
      </div>
    </div>
  );
}

function DiscardModal({
  title,
  entries,
  onClose,
}: {
  title: string;
  entries: DiscardEntry[];
  onClose: () => void;
}) {
  const creatures = entries.filter(
    (e): e is Extract<DiscardEntry, { kind: "creature" | "trainer" }> => e.kind === "creature" || e.kind === "trainer"
  );
  const energyCount = entries.filter((e) => e.kind === "energy").length;

  return (
    <motion.div
      className="modal-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="btn btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted small">{energyCount} energy discarded</p>
        <div className="card-grid card-grid--sm">
          {creatures.map((e, i) => (
            <Card key={i} card={e.card} size="sm" />
          ))}
          {creatures.length === 0 && <p className="muted">No discarded cards.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TurnBanner({ banner }: { banner: BattleEffects["turnBanner"] }) {
  return (
    <div className="turn-banner-layer" aria-live="polite">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.key}
            className={`turn-banner ${banner.player === HUMAN ? "turn-banner--you" : "turn-banner--opp"}`}
            initial={{ x: "-60vw", opacity: 0, skewX: -8 }}
            animate={{ x: 0, opacity: 1, skewX: 0 }}
            exit={{ x: "60vw", opacity: 0, skewX: 8 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            {banner.player === HUMAN ? "Your turn" : "Opponent's turn"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function statusHint(opts: {
  winner: boolean;
  mustPromote: boolean;
  humanActing: boolean;
}): string {
  if (opts.winner) return "Battle over.";
  if (opts.mustPromote) return "Choose your new active mon from the bench.";
  if (!opts.humanActing) return "Opponent's turn…";
  const tips = [
    "Drag Basics from your hand to the bench",
    "drag energy onto a mon",
    "click your active mon to attack or retreat",
  ];
  return tips.join(" · ") + ".";
}

export function Battle() {
  const state = useBattleStore((st) => st.state);
  const humanMoves = useBattleStore((st) => st.humanMoves);
  const busy = useBattleStore((st) => st.busy);
  const batchStart = useBattleStore((st) => st.batchStart);
  const gameId = useBattleStore((st) => st.gameId);
  const dispatch = useBattleStore((st) => st.dispatch);
  const newGame = useBattleStore((st) => st.newGame);
  const setView = useAppView((st) => st.setView);

  const fx = useBattleEvents(state.events, batchStart, busy, gameId);

  const [inspect, setInspect] = useState<null | "human" | "ai">(null);
  const [selected, setSelected] = useState<{ card: CardDefinition; uid?: string; owner?: PlayerId; handIndex?: number; gameId: number } | null>(null);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [targeting, setTargeting] = useState<{ gameId: number; label: string; moves: Move[] } | null>(null);

  const human = state.players[HUMAN];
  const ai = state.players[AI];
  const moves = humanMoves; // already empty while busy
  const mustPromote = state.phase.kind === "awaitPromotion" && state.phase.player === HUMAN;
  const targetMoves = mustPromote && !busy ? moves.filter((move) => move.type === "promote")
    : targeting?.gameId === gameId && !busy
      ? moves.filter((move) => targeting.moves.some((candidate) => JSON.stringify(candidate) === JSON.stringify(move))) : [];
  const targetingActive = targetMoves.length > 0;
  const uidForMove = (move: Move): string | undefined => {
    if (move.type === "playTrainer" || move.type === "attachEnergy") return move.targetUid;
    if (move.type === "retreat" || move.type === "promote") return human.bench[move.benchIndex]?.uid;
    return undefined;
  };
  const targetUids = new Set(targetMoves.map(uidForMove).filter((uid): uid is string => !!uid));
  useEffect(() => {
    if (!targetingActive) return;
    document.querySelector<HTMLElement>(".creature--targetable .card")?.focus();
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") setTargeting(null); };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [targetingActive]);

  const dnd: DndApi = {
    drag,
    moves: targetingActive ? [] : moves,
    // Defer the state update: re-rendering synchronously inside dragstart can
    // cancel the drag in Chromium.
    start: (payload) => setTimeout(() => setDrag(payload), 0),
    end: () => setDrag(null),
    drop: (move) => {
      setDrag(null);
      dispatch(move);
    },
  };

  const humanActing = !state.winner && actingPlayer(state) === HUMAN;
  const canPass = !targetingActive && moves.some((m) => m.type === "pass");
  const hint = statusHint({
    winner: !!state.winner,
    mustPromote,
    humanActing,
  });
  // Show the result only once the final knock-out has finished animating.
  const showResult = !!state.winner && !busy;
  const selectedPlayer = selected?.owner ? state.players[selected.owner] : undefined;
  const selectedMon = selectedPlayer ? [selectedPlayer.active, ...selectedPlayer.bench].find((mon) => mon?.uid === selected?.uid) ?? undefined : undefined;
  const selectedActive = !!selectedMon && selected?.owner === HUMAN && human.active?.uid === selectedMon.uid;
  const selectionValid = selected?.gameId === gameId && (selected.uid ? !!selectedMon : human.hand[selected.handIndex ?? -1] === selected.card);
  const selectedMoves = moves.filter((move) => {
    if (!selected || selected.owner === AI) return false;
    if (move.type === "attack" || move.type === "retreat") return selectedActive;
    if (move.type === "attachEnergy") return move.targetUid === selectedMon?.uid;
    if (move.type === "playBasic" || move.type === "playTrainer") return move.handIndex === selected.handIndex;
    return false;
  });
  function performMove(move: Move) { setSelected(null); setTargeting(null); dispatch(move); }
  function chooseTargets(candidates: Move[], label: string) {
    setSelected(null);
    setTargeting({ gameId, moves: candidates, label });
  }
  function inspectMon(mon: CreatureInPlay, owner: PlayerId) {
    if (targetingActive) {
      const move = targetMoves.find((candidate) => uidForMove(candidate) === mon.uid);
      if (move) performMove(move);
      return;
    }
    setSelected({ card: mon.card, uid: mon.uid, owner, gameId });
  }


  return (
    <TargetContext.Provider value={{ active: targetingActive, uids: targetUids }}>
    <div className={`battle${drag ? " battle--dragging" : ""}${targetingActive ? " battle--targeting" : ""}`}>
      <TurnBanner banner={fx.turnBanner} />

      {fx.coin && <div className="coin-flip" role="status" aria-live="polite">
        <div className="coin-flip__disc" key={fx.coin.key}>{fx.coin.result === "heads" ? "H" : "T"}</div>
        <strong>Flip {fx.coin.flip}: {fx.coin.result}</strong>
        <span>Blitz bonus: +{fx.coin.bonus} damage</span>
      </div>}
      {logOpen && <BattleLog key={gameId} lines={state.log} onClose={() => setLogOpen(false)} />}

      <AnimatePresence>
        {showResult && (
          <motion.div
            key="result"
            className={`banner ${state.winner === HUMAN ? "banner--win" : "banner--lose"}`}
            initial={{ opacity: 0, scale: 0.8, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          >
            {state.winner === HUMAN ? "You win! 🎉" : "You lose."}
            <div className="banner__actions">
              <button className="btn btn--new" onClick={() => newGame()}>
                Play again
              </button>
              <button className="btn" onClick={() => setView("builder")}>
                Edit deck
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OpponentZone
        player={ai}
        isTurn={state.turnPlayer === AI}
        fx={fx}
        turnNumber={state.turnNumber}
        onInspect={(mon) => inspectMon(mon, AI)}
        onInspectDiscard={() => setInspect("ai")}
      />

      <aside className="battle-controls">
        <div className="battle-controls__turn">Turn {state.turnNumber}</div>
        <button className="btn btn--sm" onClick={() => setLogOpen(true)}>Battle log</button>
        <button className="btn btn--sm" onClick={() => { setTargeting(null); newGame(); }}>New game</button>
        <p className="battle__hint" aria-live="polite">{targetingActive ? mustPromote ? "Choose a highlighted benched mon as your new active." : `${targeting?.label}: choose a highlighted mon.` : hint}
          {targetingActive && !mustPromote && <button className="btn btn--sm" onClick={() => setTargeting(null)}>Cancel</button>}
        </p>
        <div className="endturn">
          <motion.button
            className="endturn__btn"
            disabled={!canPass}
            onClick={() => dispatch({ type: "pass" })}
            whileHover={canPass ? { y: -2 } : undefined}
            whileTap={canPass ? { scale: 0.96 } : undefined}
          >
            End Turn
          </motion.button>
        </div>
      </aside>

      <HumanZone
        player={human}
        isTurn={state.turnPlayer === HUMAN}
        fx={fx}
        turnNumber={state.turnNumber}
        dnd={dnd}
        onInspect={(mon) => inspectMon(mon, HUMAN)}
        onInspectDiscard={() => setInspect("human")}
      />

      <Hand hand={human.hand} hidden={fx.hiddenDraws[HUMAN] ?? 0} dnd={dnd}
        onInspect={(card, handIndex) => { if (!targetingActive) setSelected({ card, handIndex, gameId }); }} />

      {!targetingActive && selected && selectionValid && (
        <MonDetails key={selected.uid ?? `hand-${selected.handIndex}`} card={selectedMon?.card ?? selected.card}
          mon={selectedMon} active={selectedActive} moves={selectedMoves} bench={human.bench}
          onMove={performMove} onClose={() => setSelected(null)} onChooseTargets={chooseTargets} />
      )}

      <AnimatePresence>
        {inspect && (
          <DiscardModal
            key="discard"
            title={inspect === "human" ? "Your discard pile" : "Opponent discard pile"}
            entries={(inspect === "human" ? human : ai).discard}
            onClose={() => setInspect(null)}
          />
        )}
      </AnimatePresence>
    </div>
    </TargetContext.Provider>
  );
}
