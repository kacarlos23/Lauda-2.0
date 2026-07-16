import "dotenv/config";
import app from "./app";
import { config } from "./config/unifiedConfig";

app.listen(config.port, config.http.host, () => {
  console.log(`🚀 Server running on ${config.http.host}:${config.port}`);
});
