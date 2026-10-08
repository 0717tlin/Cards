# Tech Stack

This project is an all-TypeScript monorepo managed with **npm workspaces**.

## Packages

- `packages/engine` (`@card-game/engine`) — the battle engine. Pure, framework-free TypeScript. No React, no Express, no I/O. Deterministic logic only. This is the heart of the game and is shared by every other package.
- `packages/backend` (`@card-game/backend`) — Node + Express API server. Depends on the engine. Will become the authoritative server when multiplayer is added.
- `packages/frontend` (`@card-game/frontend`) — React 18 + Vite 5 UI. Uses Zustand for state and **Motion** (`motion@13.4.6`, imported from `motion/react`) for animations. Depends on the engine.

## Toolchain

- Node >= 20 (dev machine runs v24).
- TypeScript ^5.6, `strict` mode, `noUncheckedIndexedAccess` on. All config extends `tsconfig.base.json`.
- ES modules everywhere (`"type": "module"`).
- Tests: **Vitest** (engine, and frontend store logic with fake timers — no DOM tests).
- Dependencies are pinned to exact versions when added.
- Backend dev runs via `tsx watch`; frontend via `vite`.

## Commands

- Install everything: `npm install` (from repo root).
- Build all: `npm run build` (root).
- Rebuild the engine after every engine feature or engine card/rule/data change: `npm run build --workspace @card-game/engine` (from repo root). The frontend imports the engine package's compiled `dist` output, so restart the frontend dev server after rebuilding when it is already running.
- Test all: `npm run test` (root).
- Frontend dev server: `npm run dev:frontend`.
- Backend dev server: `npm run dev:backend`.

## Rules

- The engine must never import from backend or frontend. Dependencies flow one way: engine <- backend, engine <- frontend.
- Keep the engine deterministic. Any randomness (coin flips, shuffles, initial draw) must be injected via a seeded RNG passed into the engine, never `Math.random()` inline. This keeps games reproducible and testable, and makes an authoritative multiplayer server possible later.
