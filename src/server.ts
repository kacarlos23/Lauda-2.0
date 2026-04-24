import "dotenv/config";
import app from "./app";
import { config } from "./config/unifiedConfig";

app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
});
