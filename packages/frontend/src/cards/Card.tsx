import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import type { CreatureCard, EnergyType, Stage } from "@card-game/engine";
import { ENERGY_COLOR, ENERGY_SYMBOL, resolveArt } from "./cardArt";

const STAGE_LABEL: Record<Stage, string> = {
  basic: "Basic",
  stage1: "Stage 1",
  stage2: "Stage 2",
};

/**
 * Fit a card name into its allotted width by shrinking the font when it would
 * overflow (mirrors how printed trading cards size long names). Returns a ref
 * for the name element and the scale (1 = full size, down to a floor).
 */
function useFitText(text: string): {
  ref: React.RefObject<HTMLSpanElement>;
  scale: number;
} {
  const ref = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    // Measure at full size (1em) without disturbing React's applied style,
    // then compute the largest scale that fits the available column width.
    const prev = el.style.fontSize;
    el.style.fontSize = "1em";
    const available = parent.clientWidth;
    const needed = el.scrollWidth;
    el.style.fontSize = prev;
    const next = needed > available && available > 0 ? Math.max(0.6, available / needed) : 1;
    setScale(next);
  }, [text]);

  return { ref, scale };
}

/**
 * A single energy pip. Size is expressed in em so pips scale with the card's
 * font size (which varies by card size), preventing overflow on small cards.
 */
export function EnergyPip({ type, em = 1.2 }: { type: EnergyType; em?: number }) {
  return (
    <span
      className="pip"
      title={type}
      style={{ background: ENERGY_COLOR[type], width: `${em}em`, height: `${em}em` }}
    >
      {ENERGY_SYMBOL[type]}
    </span>
  );
}

/**
 * Renders `children` and plays a short "pop" whenever `value` changes (not on
 * first mount). Used for HP and points so changes draw the eye.
 */
export function Pop({
  value,
  className,
  children,
}: {
  value: number;
  className?: string;
  children: ReactNode;
}) {
  const prev = useRef(value);
  const changed = prev.current !== value;
  useEffect(() => {
    prev.current = value;
  });
  return (
    <motion.span
      key={value}
      className={className}
      style={{ display: "inline-block" }}
      initial={changed ? { scale: 1.5 } : false}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 14 }}
    >
      {children}
    </motion.span>
  );
}

export interface CardProps {
  card: CreatureCard;
  size?: "sm" | "md" | "lg";
  /** Battle overlays. */
  damage?: number;
  attached?: EnergyType[];
  /** Highlight the frame (e.g. the active creature). */
  highlight?: boolean;
  onClick?: () => void;
  /** Attack ids that are currently legal to use; those rows become clickable. */
  usableAttackIds?: string[];
  onAttack?: (attackId: string) => void;
  /**
   * Shared-layout id for the most recently attached energy pip. When it
   * matches the energy-zone pip's id, Motion flies the pip onto this card.
   */
  flyLayoutId?: string;
}

export function Card({
  card,
  size = "md",
  damage,
  attached,
  highlight = false,
  onClick,
  usableAttackIds,
  onAttack,
  flyLayoutId,
}: CardProps) {
  const art = resolveArt(card.art, card.type);
  const remaining = damage != null ? Math.max(0, card.hp - damage) : null;
  const clickable = !!onClick;
  const accent = ENERGY_COLOR[card.type];
  const nameFit = useFitText(card.name);

  return (
    <div
      className={`card card--${size}${highlight ? " card--highlight" : ""}${clickable ? " card--clickable" : ""}`}
      style={{ ["--accent-type" as string]: accent }}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="card__header">
        <span className="card__stage">{STAGE_LABEL[card.stage]}</span>
        <span
          ref={nameFit.ref}
          className="card__name"
          title={card.name}
          style={{ fontSize: `${nameFit.scale}em` }}
        >
          {card.name}
          {card.isEx && <span className="card__ex">ex</span>}
        </span>
        <span className="card__hp">
          {remaining != null ? (
            <Pop value={remaining} className="card__hp-num">
              {remaining}
            </Pop>
          ) : (
            <span className="card__hp-num">{card.hp}</span>
          )}
          <span className="card__hp-max">{remaining != null ? `/${card.hp}` : ""}</span>
          <span className="card__hp-lbl">HP</span>
        </span>
      </div>

      <div
        className="card__art"
        style={art.url ? { backgroundImage: `url(${art.url})` } : { background: art.placeholderBackground }}
      >
        {!art.url && (
          <>
            <span className="card__art-glyph">{ENERGY_SYMBOL[card.type]}</span>
            <span className="card__art-name">{card.name}</span>
          </>
        )}
        {attached && attached.length > 0 && (
          <div className="card__attached">
            {attached.map((e, i) =>
              flyLayoutId && i === attached.length - 1 ? (
                <motion.span key={i} layoutId={flyLayoutId} style={{ display: "inline-flex" }}>
                  <EnergyPip type={e} em={1.3} />
                </motion.span>
              ) : (
                <EnergyPip key={i} type={e} em={1.3} />
              )
            )}
          </div>
        )}
      </div>

      {card.ability && (
        <div className="card__ability">
          <span className="card__ability-label">Ability</span>
          <span className="card__ability-name">{card.ability.name}</span>
          <p className="card__ability-text">{card.ability.text}</p>
        </div>
      )}

      <div className="card__attacks">
        {card.attacks.map((atk) => {
          const usable = !!onAttack && !!usableAttackIds?.includes(atk.id);
          return (
          <div
            className={`attack${usable ? " attack--usable" : ""}`}
            key={atk.id}
            role={usable ? "button" : undefined}
            tabIndex={usable ? 0 : undefined}
            title={usable ? `Use ${atk.name}` : undefined}
            onClick={
              usable
                ? (e) => {
                    e.stopPropagation();
                    onAttack!(atk.id);
                  }
                : undefined
            }
            onKeyDown={
              usable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAttack!(atk.id);
                    }
                  }
                : undefined
            }
          >
            <span className="attack__cost">
              {atk.cost.map((c, i) => (
                <EnergyPip key={i} type={c} em={1.25} />
              ))}
            </span>
            <span className="attack__name">{atk.name}</span>
            <span className="attack__dmg">{atk.damage > 0 ? atk.damage : ""}</span>
            {atk.text && <p className="attack__text">{atk.text}</p>}
          </div>
          );
        })}
      </div>

      <div className="card__footer">
        <span className="stat">
          <span className="stat__label">Weakness</span>
          <span className="stat__val">
            {card.weakness ? (
              <>
                <EnergyPip type={card.weakness} em={1.1} />
                <span className="stat__plus">+20</span>
              </>
            ) : (
              <span className="stat__dash">—</span>
            )}
          </span>
        </span>
        <span className="stat stat--right">
          <span className="stat__label">Retreat</span>
          <span className="stat__val">
            {card.retreatCost > 0 ? (
              Array.from({ length: card.retreatCost }).map((_, i) => (
                <EnergyPip key={i} type="colorless" em={1.1} />
              ))
            ) : (
              <span className="stat__dash">—</span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
