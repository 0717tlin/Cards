# Card Battle

A UFC card battler with local AI matches and private online rooms.

## Run locally

Install Node.js 20 or newer, then run from the repository root:

```powershell
npm install
npm run build
npm run dev:backend
```

Leave that terminal open. In a second terminal in the same folder:

```powershell
npm run dev:frontend
```

Open http://localhost:5173. Rebuild the engine after changes to cards or rules; restart the frontend dev server after rebuilding.

## Play with a friend

1. Open **Play Online** from Home (or **Online** in the navigation).
2. Enter a guest name and create a private room. Share its six-character code.
3. Your friend opens the **same hosted game**, enters a guest name and joins with that code.
4. Each player chooses a saved, legal 20-card deck and clicks **Ready to battle**.
5. Both players see their own fighters at the bottom. The server validates every move and handles shuffles and coin flips.

For a two-player test on one computer, use two different browser profiles or a normal and private/incognito window. Each browser stores its own reconnect credential. Two tabs sharing browser storage represent the same guest; reconnecting takes over that guest's seat.

Refreshing or briefly losing a connection keeps your seat. The client retries automatically, and the match pauses until both guests reconnect. **Leave room** during a match concedes it. Completed rooms can be left to create another match.

## Run one server for other devices

After `npm run build`, this serves both the built game and its API/WebSocket connection on port 3001:

```powershell
npm run start --workspace @card-game/backend
```

On the same network, use the host computer's network address, for example `http://192.168.1.20:3001`. Both guests must use the same server; separate localhost servers do not share rooms. A friend outside your network needs a publicly reachable deployment. Use HTTPS with WebSocket upgrade support in its reverse proxy; the browser automatically uses WSS on HTTPS pages.

The development frontend also listens on the local network and proxies `/api` including WebSockets to port 3001. If a production reverse proxy changes the request's Host header, set `MULTIPLAYER_ORIGINS` to a comma-separated list of allowed frontend origins, such as `https://your-game.example`. With no override, browser WebSocket connections must be same-origin.

## Saved rooms and reconnects

- One backend process owns all rooms. Guest tokens are random secrets; only their hashes are saved on the server. Never share the browser's reconnect token—share the room code instead.
- Matches, readiness, and accepted move IDs are atomically saved in `packages/backend/data/rooms.json` before acknowledgment. Keep that directory on persistent storage when hosting. It is ignored by Git.
- Reconnecting after a backend restart restores the board without replaying old animations. Retrying a previously accepted move does not execute it twice.
- Inactive disconnected rooms expire after 24 hours. Rooms from a different card/rules version are not resumed. Corrupted room files are not silently overwritten.
- The server sends each guest only their own hand, public board, and hidden-card counts. Both deck orders and the random seed remain private. Download reveals a top card only to the guest who used it; private search/draw log messages are not broadcast.
- This first version supports guest private rooms on a single backend. Accounts, public matchmaking, spectators, and multiple backend instances are outside this version.

## Verify

```powershell
npm run build
npm test
```
