import { useState, type DragEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  actingPlayer,
  getLegalMoves,
  type CreatureCard,
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
  | { kind: "energy" }
  | { kind: "bench"; benchIndex: number };

type DropTarget =
  | { kind: "benchSlot" } // empty bench slot: play a Basic from hand
  | { kind: "creature"; uid: string } // any of your creatures: attach energy
  | { kind: "active" }; // your active spot: retreat or promote a benched creature

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
      if (drag.kind === "bench" && target.kind === "active") {
        return (m.type === "retreat" || m.type === "promote") && m.benchIndex === drag.benchIndex;
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
    return (m.type === "retreat" || m.type === "promote") && m.benchIndex === drag.benchIndex;
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
  usableAttackIds,
  onAttack,
}: {
  c: CreatureInPlay;
  owner: PlayerId;
  fx: BattleEffects;
  turnNumber: number;
  highlight?: boolean;
  usableAttackIds?: string[];
  onAttack?: (attackId: string) => void;
}) {
  const dir = towardCenter(owner);
  const lunging = fx.lungeUid === c.uid;
  const hit = fx.hit?.uid === c.uid ? fx.hit : null;
  const damage = c.damage - (fx.pendingDamage[c.uid] ?? 0);
  const flying = fx.flyEnergy?.uid === c.uid;

  return (
    <motion.div
      layoutId={c.uid}
      className="creature"
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
        highlight={highlight}
        usableAttackIds={usableAttackIds}
        onAttack={onAttack}
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
        <Card card={ghost.creature.card} size="sm" damage={ghost.damage} attached={ghost.creature.attached} />
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
}: {
  player: PlayerState;
  isTurn: boolean;
  fx: BattleEffects;
  turnNumber: number;
  onInspectDiscard: () => void;
}) {
  const ghosts = fx.ghosts.filter((g) => g.player === player.id);
  return (
    <section className={`pzone${isTurn ? " pzone--turn" : ""}`}>
      <div className="pzone__head">
        <h3>Opponent (AI)</h3>
        <Points player={player} fx={fx} />
      </div>
      <div className="pzone__board">
        <div className="pzone__rows">
          <div className="row row--bench">
            {player.bench.map((c) => (
              <Creature key={c.uid} c={c} owner={player.id} fx={fx} turnNumber={turnNumber} />
            ))}
            {Array.from({ length: 3 - player.bench.length }).map((_, i) => (
              <EmptySlot key={i} label="bench" />
            ))}
          </div>
          <ActiveRow ghosts={ghosts} hit={fx.hit}>
            {player.active ? (
              <Creature c={player.active} owner={player.id} fx={fx} turnNumber={turnNumber} highlight />
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
  onAttack,
  onInspectDiscard,
}: {
  player: PlayerState;
  isTurn: boolean;
  fx: BattleEffects;
  turnNumber: number;
  dnd: DndApi;
  onAttack: (attackId: string) => void;
  onInspectDiscard: () => void;
}) {
  const usableAttackIds = dnd.moves
    .filter((m): m is Extract<Move, { type: "attack" }> => m.type === "attack")
    .map((m) => m.attackId);
  const ghosts = fx.ghosts.filter((g) => g.player === player.id);

  return (
    <section className={`pzone${isTurn ? " pzone--turn" : ""}`}>
      <div className="pzone__head">
        <h3>You</h3>
        <Points player={player} fx={fx} />
      </div>
      <div className="pzone__board">
        <div className="pzone__rows">
          <ActiveRow ghosts={ghosts} hit={fx.hit}>
            {player.active ? (
              // Active accepts energy (attach) and a benched creature (retreat).
              <DropZone
                dnd={dnd}
                targets={[{ kind: "creature", uid: player.active.uid }, { kind: "active" }]}
              >
                <Creature
                  c={player.active}
                  owner={player.id}
                  fx={fx}
                  turnNumber={turnNumber}
                  highlight
                  usableAttackIds={usableAttackIds}
                  onAttack={onAttack}
                />
              </DropZone>
            ) : (
              // Empty active (after a KO): accepts a benched creature (promote).
              <DropZone dnd={dnd} targets={[{ kind: "active" }]}>
                <EmptySlot label="active" />
              </DropZone>
            )}
          </ActiveRow>
          <div className="row row--bench">
            {player.bench.map((c, benchIndex) => (
              <DropZone key={c.uid} dnd={dnd} targets={[{ kind: "creature", uid: c.uid }]}>
                <Draggable dnd={dnd} payload={{ kind: "bench", benchIndex }}>
                  <Creature c={c} owner={player.id} fx={fx} turnNumber={turnNumber} />
                </Draggable>
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
function handKeys(hand: CreatureCard[]): string[] {
  const seen = new Map<string, number>();
  return hand.map((card) => {
    const n = seen.get(card.id) ?? 0;
    seen.set(card.id, n + 1);
    return `${card.id}#${n}`;
  });
}

function Hand({ hand, hidden, dnd }: { hand: CreatureCard[]; hidden: number; dnd: DndApi }) {
  // Drawn cards are hidden until their draw animation is due, then slide in.
  const shown = hand.slice(0, hand.length - hidden);
  const keys = handKeys(shown);
  return (
    <div className="hand">
      <div className="slot-label">Your hand ({shown.length})</div>
      <div className="hand-row">
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
                <Card card={card} size="sm" />
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
    (e): e is Extract<DiscardEntry, { kind: "creature" }> => e.kind === "creature"
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
          {creatures.length === 0 && <p className="muted">No knocked-out creatures.</p>}
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
  canRetreat: boolean;
}): string {
  if (opts.winner) return "Battle over.";
  if (opts.mustPromote) return "Your active was knocked out. Drag a benched creature onto the active spot.";
  if (!opts.humanActing) return "Opponent's turn…";
  const tips = [
    "Drag Basics from your hand to the bench",
    "drag energy onto a creature",
    "click an attack on your active to use it",
  ];
  if (opts.canRetreat) tips.push("drag a benched creature onto your active to retreat");
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
  const [drag, setDrag] = useState<DragPayload | null>(null);

  const human = state.players[HUMAN];
  const ai = state.players[AI];
  const recentLog = state.log.slice(-6).reverse();
  const moves = humanMoves; // already empty while busy

  const dnd: DndApi = {
    drag,
    moves,
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
  const canPass = moves.some((m) => m.type === "pass");
  const mustPromote = state.phase.kind === "awaitPromotion" && state.phase.player === HUMAN;
  const hint = statusHint({
    winner: !!state.winner,
    mustPromote,
    humanActing,
    canRetreat: humanActing && getLegalMoves(state).some((m) => m.type === "retreat"),
  });
  // Show the result only once the final knock-out has finished animating.
  const showResult = !!state.winner && !busy;

  return (
    <div className={`battle${drag ? " battle--dragging" : ""}`}>
      <TurnBanner banner={fx.turnBanner} />

      <div className="battle__bar">
        <span className="muted small">Turn {state.turnNumber}</span>
        <button className="btn btn--sm" onClick={() => newGame()}>
          New game
        </button>
      </div>

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
        onInspectDiscard={() => setInspect("ai")}
      />

      <div className="battle__middle">
        <p className="battle__hint">{hint}</p>
        <aside className="log">
          <div className="slot-label">Battle log</div>
          <ul>
            {recentLog.map((line, i) => (
              <li key={state.log.length - i} className="small">
                {line}
              </li>
            ))}
          </ul>
        </aside>
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
      </div>

      <HumanZone
        player={human}
        isTurn={state.turnPlayer === HUMAN}
        fx={fx}
        turnNumber={state.turnNumber}
        dnd={dnd}
        onAttack={(attackId) => dispatch({ type: "attack", attackId })}
        onInspectDiscard={() => setInspect("human")}
      />

      <Hand hand={human.hand} hidden={fx.hiddenDraws[HUMAN] ?? 0} dnd={dnd} />

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
  );
}
