import express from "express";
import cors from "cors";
import { ENGINE_VERSION, readSharedDeck } from "@card-game/engine";
import { DeckCodeStore, DECK_CODE_PATTERN } from "./deckCodes.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function createApp(store = new DeckCodeStore()) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_req, res) => { res.json({ status: "ok", engine: ENGINE_VERSION }); });
  app.post("/api/deck-codes", async (req, res) => {
    const deck = readSharedDeck(req.body);
    if (!deck) { res.status(400).json({ error: "Use a legal 20-card deck with at most two copies per card, a name, and at least one energy type." }); return; }
    try { res.json({ code: await store.create(deck) }); }
    catch (error) { console.error("Deck code save failed:", error); res.status(503).json({ error: "Couldn't save a deck code. Please try again." }); }
  });
  app.get("/api/deck-codes/:code", async (req, res) => {
    const code = req.params.code;
    if (!code || !DECK_CODE_PATTERN.test(code)) { res.status(400).json({ error: "Enter a six-character code using capital letters and numbers." }); return; }
    try {
      const saved = await store.find(code);
      if (!saved) { res.status(404).json({ error: "Deck code not found." }); return; }
      const deck = readSharedDeck(saved);
      if (!deck) { res.status(410).json({ error: "This deck no longer meets the current card or deck rules." }); return; }
      res.json({ deck });
    } catch (error) { console.error("Deck code lookup failed:", error); res.status(503).json({ error: "Couldn't load this deck. Please try again." }); }
  });
  app.use("/api", (_req, res) => { res.status(404).json({ error: "API route not found." }); });
  const frontend = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
  if (existsSync(`${frontend}/index.html`)) {
    app.use(express.static(frontend));
    app.get("*", (_req, res) => res.sendFile(`${frontend}/index.html`));
  }
  return app;
}
