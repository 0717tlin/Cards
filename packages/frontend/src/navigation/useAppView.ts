// In-memory navigation state for the app's screens.

import { create } from "zustand";

export type AppView = "menu" | "viewer" | "builder" | "battle";

interface AppViewStore {
  view: AppView;
  setView: (view: AppView) => void;
}

export const useAppView = create<AppViewStore>((set) => ({
  // The app opens on the main menu.
  view: "menu",
  setView: (view) => set({ view }),
}));
