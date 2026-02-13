# Carcassonne (web)

[Українська версія](README.ua.md)

A small Carcassonne-style web game built with Next.js + React Three Fiber.

## What’s included

- **Solo** mode
- **Multiplayer Offline** (hotseat, 1–5 players, turn-by-turn)
- **Multiplayer Online (LAN)** rooms (Socket.IO, simplest host-authoritative model)
- **File saves** (separate save buckets for solo vs multiplayer)
- **Rules**: in-app “Site rules” + external PDF “Game rules” link

## Controls

- **Place a tile**: click a highlighted empty cell
- **Rotate tile**: `R` (or the Rotate button)
- **Skip meeple placement**: `Esc` (or `Next` in multiplayer)

## Requirements

- Node.js 18+ (recommended)

## Run locally

From the `my-app/` folder:

```bash
npm install
npm run dev
```

Open http://localhost:3000

Note: `npm run dev` runs `server.mjs`, which starts Next.js **and** Socket.IO on the same port.

## Play Online on LAN

1. Run the app on the host machine: `npm run dev`
2. Make sure the host firewall allows incoming TCP connections on port `3000`
3. On other devices in the same network, open:

```
http://<HOST_LAN_IP>:3000
```

Then use **Multiplayer → Online** (or open `/online`) to create/join a room.

## Saves

File saves are written as JSON files under:

- `src/game/store/save/saves/solo/`
- `src/game/store/save/saves/multi/`

These are dev-friendly local files (they are not meant for serverless deployments where the filesystem is ephemeral).

## Project map (high level)

- `app/` — Next.js App Router pages (menu, solo, online, API routes)
- `src/game/store/useGameStore.ts` — Zustand store (game logic + persistence)
- `src/scene/components/` — board / tile / meeple rendering (React Three Fiber)

