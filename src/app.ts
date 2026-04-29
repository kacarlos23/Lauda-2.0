import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import ministryRoutes from "./routes/ministryRoutes";
import memberRoutes from "./routes/memberRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";
import swaggerUi from "swagger-ui-express";
import { generateOpenApiDocument } from "./docs/openapi";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/ministries", ministryRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/schedules", scheduleRoutes);

if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(generateOpenApiDocument()));
}

app.use(errorHandler);

export default app;
