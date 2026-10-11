import { randomInt } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type SharedDeck } from "@card-game/engine";

export const DECK_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const defaultPath = fileURLToPath(new URL("../data/deck-codes.json", import.meta.url));
function fingerprint(deck: SharedDeck) {
  return JSON.stringify([deck.name, Object.entries(deck.selection).sort(([a], [b]) => a.localeCompare(b)), [...deck.energyTypes].sort()]);
}

/** Immutable snapshots: codes never change meaning, and writes survive restarts. */
export class DeckCodeStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private path = defaultPath, private generate = () => randomInt(36 ** 6).toString(36).toUpperCase().padStart(6, "0")) {}

  private async read(): Promise<Record<string, SharedDeck>> {
    let raw: string;
    try { raw = await readFile(this.path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data) || !Object.keys(data).every(code => DECK_CODE_PATTERN.test(code))) {
      throw new Error("Invalid deck-code registry.");
    }
    return data as Record<string, SharedDeck>;
  }

  create(deck: SharedDeck): Promise<string> {
    // Capture before waiting: later caller edits must not change this code's deck.
    const snapshot = structuredClone(deck);
    const operation = this.queue.then(async () => {
      const registry = await this.read();
      const key = fingerprint(snapshot);
      for (const [code, saved] of Object.entries(registry)) if (fingerprint(saved) === key) return code;
      let code = "";
      for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = this.generate();
        if (DECK_CODE_PATTERN.test(candidate) && !Object.hasOwn(registry, candidate)) { code = candidate; break; }
      }
      if (!code) throw new Error("Couldn't allocate a unique deck code.");
      registry[code] = snapshot;
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(`${this.path}.tmp`, JSON.stringify(registry), "utf8");
      await rename(`${this.path}.tmp`, this.path);
      return code;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async find(code: string): Promise<SharedDeck | null> {
    await this.queue;
    if (!DECK_CODE_PATTERN.test(code)) return null;
    return (await this.read())[code] ?? null;
  }
}
