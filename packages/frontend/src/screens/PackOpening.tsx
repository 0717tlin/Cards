import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ALL_CARD_POOL, type CardDefinition, type CardRarity } from "@card-game/engine";
import { Card } from "../cards/Card";
import { CardZoom } from "../cards/CardZoom";

const POOL = Object.values(ALL_CARD_POOL);
function drawFrom(rarity: CardRarity): CardDefinition {
  const tier = POOL.filter((card) => (card.rarity ?? "common") === rarity);
  return tier[Math.floor(Math.random() * tier.length)]!;
}
function drawPack(): CardDefinition[] {
  const firstFour = Array.from({ length: 4 }, () => drawFrom(Math.random() < 0.7 ? "common" : "uncommon"));
  const finalRarity: CardRarity = Math.random() < 0.2 ? "epic" : "rare";
  return [...firstFour, drawFrom(finalRarity)];
}

export function PackOpening() {
  const [stage, setStage] = useState<"sealed" | "opening" | "reveal" | "summary">("sealed");
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState<CardDefinition | null>(null);
  const reduced = useReducedMotion();
  function open() {
    if (stage !== "sealed") return;
    setCards(drawPack());
    setIndex(0);
    setStage("opening");
  }
  function next() {
    if (index === 4) setStage("summary");
    else setIndex(index + 1);
  }
  return <div className="pack-screen">
    <header className="pack-screen__heading">
      <h2>{stage === "summary" ? "Your pack" : "Fight Night Pack"}</h2>
      <p>{stage === "sealed" ? "Five cards. Just for fun." : stage === "opening" ? "Opening your pack…" : stage === "summary" ? "All cards are already available to play. Tap a card for a closer look." : `Card ${index + 1} of 5 · Tap or swipe to reveal the next card`}</p>
      <p className="pack-screen__odds">Cards 1–4: Common 70% · Uncommon 30% · Final card: Rare 80% · Epic 20%</p>
    </header>
    <div className="pack-screen__stage">
      {(stage === "sealed" || stage === "opening") && <motion.div className="booster" animate={stage === "opening" ? { scale: [1, 1.06, .94], opacity: [1, 1, 0], y: [0, -12, 90] } : { scale: 1, opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .85 }} onAnimationComplete={() => { if (stage === "opening") setStage("reveal"); }}>
        <motion.div className="booster__seal" drag={stage === "sealed" ? "x" : false} dragConstraints={{left:0,right:0}} dragElastic={.65} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 60) open(); }} animate={stage === "opening" ? { x: 170, y: -60, rotate: 18, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}>
          {stage === "sealed" ? "← SWIPE TO OPEN →" : "OPENED"}
        </motion.div>
        <div className="booster__brand">CARD BATTLE</div>
        <div className="booster__emblem">★</div>
        <strong className="booster__title">FIGHT<br/>NIGHT</strong>
        <span className="booster__subtitle">FIGHTERS · ITEMS · SUPPORTERS</span>
        <span className="booster__count">5 CARDS</span>
      </motion.div>}
      {stage === "reveal" && <div className="pack-reveal">
        {index < 4 && <div className="pack-reveal__back" aria-hidden="true">★</div>}
        <AnimatePresence mode="wait" initial={false}>
          <motion.button key={index} className={`pack-reveal__card${index === 4 ? " pack-reveal__card--final" : ""}${index === 4 && cards[index]!.rarity === "epic" ? " pack-reveal__card--epic" : ""}`} onClick={next} aria-label={`${cards[index]!.name}, card ${index + 1} of 5${index === 4 ? `, ${cards[index]!.rarity} final card` : ""}. ${index === 4 ? "View all cards" : "Next card"}`} drag="x" dragConstraints={{left:0,right:0}} dragElastic={.2} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 60) next(); }} initial={reduced ? { opacity: 0 } : index === 4 && cards[index]!.rarity === "epic" ? { opacity: 0, scale: .55, y: 140, rotate: -12, rotateY: 75, filter: "brightness(2.2) saturate(1.8)" } : index === 4 ? { opacity: 0, scale: .78, y: 90, rotateY: 65 } : { rotateY: 80, opacity: 0, scale: .96 }} animate={reduced ? { opacity: 1 } : index === 4 && cards[index]!.rarity === "epic" ? { opacity: 1, scale: [1.08, .98, 1], y: [0, -14, 0], rotate: [4, -2, 0], rotateY: 0, filter: "brightness(1) saturate(1)" } : index === 4 ? { rotateY: 0, opacity: 1, scale: [1.04, 1], y: [0, -5, 0] } : { rotateY: 0, opacity: 1, scale: 1 }} exit={{ x: reduced ? 0 : -120, opacity: 0, rotate: reduced ? 0 : -8 }} transition={{duration:reduced ? 0 : index === 4 ? .8 : .24, ease: "easeOut"}}>
            {index === 4 && <span className="pack-reveal__aura" aria-hidden="true" />}
            <Card card={cards[index]!} size="lg" />
          </motion.button>
        </AnimatePresence>
      </div>}
      {stage === "summary" && <motion.div className="pack-summary" initial={{opacity:0}} animate={{opacity:1}}>
        {cards.map((card, i) => <motion.div key={i} initial={{opacity:0,y:reduced ? 0 : 20}} animate={{opacity:1,y:0}} transition={{delay:reduced ? 0 : i * .07}}><Card card={card} size="md" onClick={() => setZoomed(card)} /></motion.div>)}
      </motion.div>}
    </div>
    <footer className="pack-screen__actions">
      {stage === "sealed" && <button className="btn btn--new" onClick={open}>Open pack</button>}
      {stage === "reveal" && <><div className="pack-progress" aria-label={`Card ${index + 1} of 5`}>{cards.map((_, i) => <span key={i} className={i <= index ? "pack-progress__on" : ""} />)}</div><button className="btn btn--new" onClick={next}>{index === 4 ? "View all five" : "Next card"}</button><button className="btn" onClick={() => setStage("summary")}>Reveal all</button></>}
      {stage === "summary" && <button className="btn btn--new" onClick={() => setStage("sealed")}>Open another pack</button>}
    </footer>
    <CardZoom card={zoomed} onClose={() => setZoomed(null)} />
  </div>;
}
