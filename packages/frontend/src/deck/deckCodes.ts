import { readSharedDeck, type SharedDeck } from "@card-game/engine";

export const DECK_CODE_PATTERN = /^[A-Z0-9]{6}$/;
async function request(path: string, options?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetch(path, options); }
  catch { throw new Error("Deck sharing is unavailable. Start the backend with npm run dev:backend."); }
  let result: Record<string, unknown>;
  try { result = await response.json(); }
  catch { throw new Error("Deck sharing is unavailable. Start the backend with npm run dev:backend."); }
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Couldn't access deck codes. Check that the backend is running.");
  return result;
}

export async function createDeckCode(value: SharedDeck): Promise<string> {
  const deck = readSharedDeck(value);
  if (!deck) throw new Error("Only legal, named decks with an energy type can be copied.");
  const result = await request("/api/deck-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deck) });
  if (typeof result.code !== "string" || !DECK_CODE_PATTERN.test(result.code)) throw new Error("The server returned an invalid deck code.");
  return result.code;
}

export async function importDeckCode(input: string): Promise<SharedDeck> {
  const code = input.trim().toUpperCase();
  if (!DECK_CODE_PATTERN.test(code)) throw new Error("Enter a six-character code using capital letters and numbers.");
  const result = await request(`/api/deck-codes/${code}`);
  const deck = readSharedDeck(result.deck);
  if (!deck) throw new Error("This code contains a deck that no longer meets the current rules.");
  return deck;
}
