import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import ministryRoutes from "./routes/ministryRoutes";
import memberRoutes from "./routes/memberRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";

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

export default app;
