import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { CardDefinition } from "@card-game/engine";
import { Card } from "./Card";

/**
 * Full-screen overlay that shows a single card enlarged (lg size).
 * Click the backdrop or press Escape to close.
 */
export function CardZoom({
  card,
  onClose,
}: {
  card: CardDefinition | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!card) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  return createPortal(
    <AnimatePresence>
      {card && (
        <motion.div
          className="modal-backdrop card-zoom"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${card.name} enlarged`}
        >
          <motion.div
            className="card-zoom__card"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <Card card={card} size="lg" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
