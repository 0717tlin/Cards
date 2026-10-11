import { afterEach, describe, expect, it, vi } from "vitest";
import { DECK_PLAYER, type SharedDeck, type DeckSelection } from "@card-game/engine";
import { createDeckCode, importDeckCode } from "./deckCodes";

const deck: SharedDeck = { name: "Shared Deck", selection: DECK_PLAYER.reduce<DeckSelection>((s, card) => ({ ...s, [card.id]: (s[card.id] ?? 0) + 1 }), {}), energyTypes: ["water", "fire"] };
afterEach(() => vi.unstubAllGlobals());
describe("deck code client", () => {
  it("posts the full legal deck and restores it from a pasted code", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ code: "ABC123" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ deck }) });
    vi.stubGlobal("fetch", fetcher);
    expect(await createDeckCode(deck)).toBe("ABC123");
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(deck);
    expect(await importDeckCode(" abc123 ")).toEqual(deck);
    expect(fetcher.mock.calls[1]![0]).toBe("/api/deck-codes/ABC123");
  });
  it("rejects invalid inputs before sending a request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(importDeckCode("A/B123")).rejects.toThrow("six-character");
    await expect(createDeckCode({ ...deck, selection: { merab: 20 } })).rejects.toThrow("legal");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports unavailable backends and missing codes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
    await expect(importDeckCode("ABC123")).rejects.toThrow("dev:backend");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Deck code not found." }) }));
    await expect(importDeckCode("ABC123")).rejects.toThrow("not found");
  });
  it("rejects invalid server codes and obsolete deck contents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "too-long" }) }));
    await expect(createDeckCode(deck)).rejects.toThrow("invalid deck code");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deck: { ...deck, selection: { retired: 20 } } }) }));
    await expect(importDeckCode("ABC123")).rejects.toThrow("current rules");
  });
});
