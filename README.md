# Carcassonne (web)

[Українська версія](README.ua.md)

A small Carcassonne-style web game built with Next.js + React Three Fiber.

## What’s included

- **Solo** mode
- **Multiplayer Offline** (hotseat, 1–5 players, turn-by-turn)
- **Multiplayer Online (LAN)** rooms (Socket.IO, simplest host-authoritative model)
- **Browser saves** (separate save buckets for solo vs multiplayer)
- **Rules**: in-app “Site rules” + external PDF “Game rules” link

## Controls

- **Place a tile**: click a highlighted empty cell
- **Rotate tile**: `R` (or the Rotate button)
- **Skip meeple placement**: `Esc` (or `Next` in multiplayer)

## Requirements

- Node.js 22.18+

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

Named saves live in your browser's localStorage, with separate Solo and Multiplayer lists. Other browsers/devices do not see them, even when connected to the same server. No account is required. People sharing the same browser profile share its saves.

Saves survive application/container restarts, but clearing site data removes them. A different host or port has separate storage. Old server JSON saves are no longer exposed or automatically imported; existing local copies remain untouched and are excluded from Git and Docker.

## Docker

```bash
docker build -t carcassonne:local .
docker run --rm -p 4000:4000 --name carcassonne carcassonne:local
```

Open http://localhost:4000 (or http://<HOST_LAN_IP>:4000 on your LAN). Next.js and Socket.IO share this port. No save volume is required. Online rooms are in memory and end when the server restarts.

## Checks

```bash
npm test
npx tsc --noEmit
npm run build
```

## Project map (high level)

- `app/` — Next.js App Router pages (menu, solo, online, API routes)
- `src/game/store/useGameStore.ts` — Zustand store (game logic + persistence)
- `src/scene/components/` — board / tile / meeple rendering (React Three Fiber)

