// Local online photo placeholders; missing assets fall back to type artwork.

import type { EnergyType } from "@card-game/engine";
import { FIGHTER_PHOTOS } from "./fighterPhotos";
import { TRAINER_PHOTOS } from "./trainerPhotos";

export const ENERGY_COLOR: Record<EnergyType, string> = {
  fire: "#f4623a",
  water: "#3e9bf0",
  grass: "#3fb56b",
  lightning: "#f2c31c",
  psychic: "#b061e6",
  fighting: "#d0783a",
  colorless: "#b6bccb",
};

/** A lighter tint per type, used for gradient tops and header bands. */
export const ENERGY_TINT: Record<EnergyType, string> = {
  fire: "#ffb199",
  water: "#a7d4f7",
  grass: "#a4e2b8",
  lightning: "#ffe583",
  psychic: "#e0b6f7",
  fighting: "#f0c49a",
  colorless: "#e3e7ef",
};

/** Short symbol shown in energy pips / type badges. */
export const ENERGY_SYMBOL: Record<EnergyType, string> = {
  fire: "🔥",
  water: "💧",
  grass: "🌿",
  lightning: "⚡",
  psychic: "🔮",
  fighting: "✊",
  colorless: "✦",
};

const ART_ASSETS = { ...FIGHTER_PHOTOS, ...TRAINER_PHOTOS };

export interface ArtResult {
  /** A real image URL when available, else null (caller renders a placeholder). */
  url: string | null;
  /** Background used for the placeholder box, derived from the card type. */
  placeholderBackground: string;
}

export function resolveArt(artKey: string | undefined, type: EnergyType): ArtResult {
  const url = artKey ? (ART_ASSETS[artKey] ?? null) : null;
  const base = ENERGY_COLOR[type];
  const tint = ENERGY_TINT[type];
  return {
    url,
    // Bright, clean type-colored placeholder (no muddy dark navy).
    placeholderBackground: `radial-gradient(circle at 50% 30%, ${tint}, ${base} 85%)`,
  };
}
