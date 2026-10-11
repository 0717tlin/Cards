import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("crypto", { randomUUID: () => "imported" });
});
afterEach(() => vi.unstubAllGlobals());

describe("two-copy decks", () => {
  it("prevents adding a third fighter or trainer and permits removal/replacement", async () => {
    const { useDeckBuilder } = await import("./useDeckBuilder");
    const builder = useDeckBuilder.getState();
    for (const id of ["dan-ige", "herb-dean"]) {
      builder.add(id); builder.add(id); builder.add(id);
      expect(useDeckBuilder.getState().selection[id]).toBe(2);
      builder.remove(id); builder.add(id);
      expect(useDeckBuilder.getState().selection[id]).toBe(2);
    }
  });
  it("preserves over-limit saved decks for editing but rejects playing and saving them", async () => {
    const { useSavedDecks, buildDeck } = await import("./useSavedDecks");
    const starter = useSavedDecks.getState().decks[0]!;
    const selection = { ...starter.selection, "ilia-topuria": 3, merab: 1 };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify([{ ...starter, selection }]), setItem: vi.fn() });
    vi.resetModules();
    const saved = await import("./useSavedDecks");
    expect(saved.useSavedDecks.getState().decks[0]!.selection).toEqual(selection);
    expect(buildDeck(selection)).toBeNull();
    expect(saved.useSavedDecks.getState().save(starter.id, starter.name, selection)).toBeNull();
  });
  it("saves imported decks separately and loads all card counts and energy types", async () => {
    const { useSavedDecks } = await import("./useSavedDecks");
    const { useDeckBuilder } = await import("./useDeckBuilder");
    const starter = useSavedDecks.getState().decks[0]!;
    const energyTypes = ["water", "fire"] as const;
    const id = useSavedDecks.getState().save(null, "Imported deck", starter.selection, [...energyTypes]);
    const imported = useSavedDecks.getState().decks.find(deck => deck.id === id)!;
    useDeckBuilder.getState().load(imported);
    expect(useSavedDecks.getState().decks).toHaveLength(2);
    expect(useDeckBuilder.getState()).toMatchObject({ editingId: id, name: "Imported deck", selection: starter.selection, energyTypes: [...energyTypes] });
  });
});
