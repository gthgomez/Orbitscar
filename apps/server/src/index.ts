import { resolve } from "node:path";
import { createOrbitscarServer } from "./api.js";

const port = Number(process.env.ORBITSCAR_PORT ?? 4179);
const host = "127.0.0.1";
const databasePath = resolve(process.env.ORBITSCAR_DATABASE ?? "./.orbitscar/server-state.json");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("ORBITSCAR_PORT must be an integer TCP port");

const server = createOrbitscarServer({ databasePath });
server.listen(port, host, () => console.log(`Orbitscar local authority listening at http://${host}:${port}`));

function shutdown(): void { server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
