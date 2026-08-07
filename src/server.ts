import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { config } from "./config/unifiedConfig";
import { logger } from "./observability/logger";
import { startOutboxDispatcher, stopOutboxDispatcher } from "./events/domainEvents";
import { closeRealtimeHub, initializeRealtimeHub } from "./realtime/realtimeHub";
import { attachRealtimeServer } from "./realtime/websocketServer";

const server = createServer(app);
attachRealtimeServer(server);
void initializeRealtimeHub();
startOutboxDispatcher();

server.listen(config.port, config.http.host, () => {
  logger.info("server_started", { category: "observability", component: "http-server", outcome: "ready" });
});

async function shutdown() {
  stopOutboxDispatcher();
  await closeRealtimeHub();
  server.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
