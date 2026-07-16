import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/adminRoutes";
import churchRoutes from "./routes/churchRoutes";
import ministryRoutes from "./routes/ministryRoutes";
import memberRoutes from "./routes/memberRoutes";
import instrumentRoutes from "./routes/instrumentRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";
import artistRoutes from "./routes/artistRoutes";
import songRoutes from "./routes/songRoutes";
import swaggerUi from "swagger-ui-express";
import { generateOpenApiDocument } from "./docs/openapi";
import { errorHandler } from "./middlewares/errorHandler";
import { config } from "./config/unifiedConfig";

const app = express();

app.set("trust proxy", config.http.trustProxyHops);
app.use(cors());
app.use(express.json({ limit: "4mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/church", churchRoutes);
app.use("/api/ministries", ministryRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/instruments", instrumentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/songs", songRoutes);

if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(generateOpenApiDocument()));
}

app.use(errorHandler);

export default app;
