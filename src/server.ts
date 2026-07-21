import "dotenv/config";
import app from "./app";
import { config } from "./config/unifiedConfig";
import { logger } from "./observability/logger";

app.listen(config.port, config.http.host, () => {
  logger.info("server_started", { category: "observability", component: "http-server", outcome: "ready" });
});
