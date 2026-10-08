import { motion, type Variants } from "motion/react";
import { CARD_POOL, ALL_CARD_POOL, type FighterCard } from "@card-game/engine";
import { Card } from "../cards/Card";
import { useAppView } from "../navigation/useAppView";

/** Decorative fan of cards shown behind the title. */
const FAN: FighterCard[] = [CARD_POOL["islam-makhachev-ex"]!, CARD_POOL["do-bronx"]!, CARD_POOL["ilia-topuria"]!];
const CARD_COUNT = Object.keys(ALL_CARD_POOL).length;

// Staggered entrance: fan cards deal in, then title, then the buttons.
const container: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};
const deal: Variants = {
  hidden: { opacity: 0, y: 40, rotate: 0 },
  shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } },
};

export function MainMenu() {
  const setView = useAppView((s) => s.setView);

  function startNewGame() {
    setView("deckSelection");
  }

  const hover = { y: -2 };
  const tap = { y: 0, scale: 0.98 };

  return (
    <motion.div className="menu" variants={container} initial="hidden" animate="shown">
      <div className="menu__hero">
        <motion.div className="menu__fan" aria-hidden="true" variants={container}>
          {FAN.map((card, i) => (
            // Outer div holds the static fan transform; the motion child animates.
            <div key={card.id} className={`menu__fan-card menu__fan-card--${i}`}>
              <motion.div variants={deal}>
                <Card card={card} size="md" />
              </motion.div>
            </div>
          ))}
        </motion.div>
        <motion.h1 className="menu__title" variants={rise}>
          Card Battle
        </motion.h1>
        <motion.p className="menu__tagline" variants={rise}>
          Build a deck. Battle the AI.
        </motion.p>
      </div>

      <div className="menu__actions">
        <motion.button className="menu__btn" onClick={() => setView("packs")} variants={rise} whileHover={hover} whileTap={tap}>
          <span className="menu__btn-icon">🎁</span>
          <span className="menu__btn-text"><strong>Open a Pack</strong><small>Reveal five random cards</small></span>
        </motion.button>
        <motion.button
          className="menu__btn menu__btn--primary"
          onClick={startNewGame}
          variants={rise}
          whileHover={hover}
          whileTap={tap}
        >
          <span className="menu__btn-icon">⚔️</span>
          <span className="menu__btn-text">
            <strong>New Game</strong>
            <small>Choose a saved deck</small>
          </span>
        </motion.button>
        <motion.button
          className="menu__btn"
          onClick={() => setView("builder")}
          variants={rise}
          whileHover={hover}
          whileTap={tap}
        >
          <span className="menu__btn-icon">🛠️</span>
          <span className="menu__btn-text">
            <strong>Deck Builder</strong>
            <small>Build a 20-card deck</small>
          </span>
        </motion.button>
        <motion.button
          className="menu__btn"
          onClick={() => setView("viewer")}
          variants={rise}
          whileHover={hover}
          whileTap={tap}
        >
          <span className="menu__btn-icon">🃏</span>
          <span className="menu__btn-text">
            <strong>View Cards</strong>
            <small>Browse all {CARD_COUNT} cards</small>
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}
