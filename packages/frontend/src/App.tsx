import { AnimatePresence, MotionConfig, motion, type Transition } from "motion/react";
import { useAppView, type AppView } from "./navigation/useAppView";
import { MainMenu } from "./screens/MainMenu";
import { CardViewer } from "./screens/CardViewer";
import { DeckBuilder } from "./screens/DeckBuilder";
import { Battle } from "./screens/Battle";
import { SCREEN_TRANSITION_MS } from "./animation/timing";
import "./styles.css";

const NAV: { id: AppView; label: string; icon: string }[] = [
  { id: "menu", label: "Home", icon: "🏠" },
  { id: "viewer", label: "Cards", icon: "🃏" },
  { id: "builder", label: "Decks", icon: "🛠️" },
  { id: "battle", label: "Battle", icon: "⚔️" },
];

const TITLES: Record<Exclude<AppView, "menu">, string> = {
  viewer: "Cards",
  builder: "Deck Builder",
  battle: "Battle",
};

// "wait" mode plays exit then enter, so each half gets about half the budget.
const half: Transition = { duration: SCREEN_TRANSITION_MS / 2 / 1000, ease: "easeOut" };
const screenMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: half },
  exit: { opacity: 0, y: -10, transition: half },
};

function Screen({ view }: { view: Exclude<AppView, "menu"> }) {
  if (view === "viewer") return <CardViewer />;
  if (view === "builder") return <DeckBuilder />;
  return <Battle />;
}

export function App() {
  const view = useAppView((s) => s.view);
  const setView = useAppView((s) => s.setView);

  return (
    // reducedMotion="user": honour the OS "reduce motion" setting everywhere.
    <MotionConfig reducedMotion="user">
      <div className="app">
        <div className="phone">
          <AnimatePresence mode="wait" initial={false}>
            {view === "menu" ? (
              // The main menu is a full-screen landing page: no top bar or tab bar.
              <motion.main key="menu" className="app__main app__main--menu" {...screenMotion}>
                <MainMenu />
              </motion.main>
            ) : (
              <motion.div key="shell" className="shell" {...screenMotion}>
                <header className="topbar">
                  <span className="topbar__title">{TITLES[view]}</span>
                </header>

                <main className="app__main">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={view} className="screen-wrap" {...screenMotion}>
                      <Screen view={view} />
                    </motion.div>
                  </AnimatePresence>
                </main>

                <nav className="tabbar">
                  {NAV.map((n) => (
                    <button
                      key={n.id}
                      className={`tab${view === n.id ? " tab--on" : ""}`}
                      onClick={() => setView(n.id)}
                    >
                      <span className="tab__icon">{n.icon}</span>
                      <span className="tab__label">{n.label}</span>
                    </button>
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
