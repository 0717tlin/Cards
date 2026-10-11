import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";
import { DECK_PLAYER, type SharedDeck, type DeckSelection } from "@card-game/engine";
import { DeckCodeStore, DECK_CODE_PATTERN } from "./deckCodes.js";
import { createApp } from "./app.js";

const deck: SharedDeck = { name: "Shared Starter", selection: DECK_PLAYER.reduce<DeckSelection>((s, card) => ({ ...s, [card.id]: (s[card.id] ?? 0) + 1 }), {}), energyTypes: ["fire", "water"] };
let directory: string;
let path: string;
let server: Server | undefined;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "ufc-deck-codes-")); path = join(directory, "codes.json"); });
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); server = undefined; }
  await rm(directory, { recursive: true, force: true });
});

describe("deck codes", () => {
  it("round-trips all deck fields after a restart and reuses the same snapshot's code", async () => {
    const store = new DeckCodeStore(path);
    const code = await store.create(deck);
    expect(code).toMatch(DECK_CODE_PATTERN);
    const restarted = new DeckCodeStore(path);
    expect(await restarted.find(code)).toEqual(deck);
    expect(await restarted.create({ ...deck, selection: Object.fromEntries(Object.entries(deck.selection).reverse()) })).toBe(code);
    const changed = { ...deck, energyTypes: ["water"] as SharedDeck["energyTypes"] };
    expect(await restarted.create(changed)).not.toBe(code);
    expect(await restarted.find(code)).toEqual(deck);
  });
  it("avoids collisions and serializes simultaneous writes", async () => {
    const codes = ["AAAAAA", "AAAAAA", "BBBBBB", "CCCCCC"];
    const store = new DeckCodeStore(path, () => codes.shift()!);
    const results = await Promise.all([store.create(deck), store.create({ ...deck, name: "Other" }), store.create({ ...deck, name: "Third" })]);
    expect(results).toEqual(["AAAAAA", "BBBBBB", "CCCCCC"]);
    expect(await store.find("AAAAAA")).toEqual(deck);
    expect(await store.find("BBBBBB")).toMatchObject({ name: "Other" });
    expect(await store.find("CCCCCC")).toMatchObject({ name: "Third" });
    expect(await store.find("ZZZZZZ")).toBeNull();
    expect(await store.find("../bad")).toBeNull();
  });
  it("does not overwrite a corrupted registry", async () => {
    await writeFile(path, "broken", "utf8");
    await expect(new DeckCodeStore(path).create(deck)).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("broken");
  });
  it("serves round trips and rejects illegal decks, missing codes, and obsolete cards", async () => {
    server = createApp(new DeckCodeStore(path)).listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    const base = `http://127.0.0.1:${address.port}/api/deck-codes`;
    const post = (value: unknown) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    const response = await post(deck);
    expect(response.status).toBe(200);
    const { code } = await response.json() as { code: string };
    expect(await (await fetch(`${base}/${code}`)).json()).toEqual({ deck });
    const illegal = structuredClone(deck); illegal.selection["ilia-topuria"]!++; illegal.selection.merab!--;
    expect((await post(illegal)).status).toBe(400);
    expect((await fetch(`${base}/invalid`)).status).toBe(400);
    expect((await fetch(`${base}/ZZZZZZ`)).status).toBe(404);
    await writeFile(path, JSON.stringify({ ABC123: { ...deck, selection: { "retired-card": 20 } } }), "utf8");
    expect((await fetch(`${base}/ABC123`)).status).toBe(410);
  });
});
