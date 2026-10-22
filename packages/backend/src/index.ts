import { createApp } from "./app.js";
import { createServer } from "node:http";
import { RoomServer } from "./rooms.js";

const app = createApp();

const PORT = process.env.PORT ?? 3001;
const server = createServer(app);
const rooms = new RoomServer(server);
server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
function shutdown() { rooms.close(); server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
