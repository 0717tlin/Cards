import express from "express";
import cors from "cors";
import { ENGINE_VERSION } from "@card-game/engine";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", engine: ENGINE_VERSION });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
