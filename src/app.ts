import express from "express";
import authRoutes from "./routes/authRoutes";
import ministryRoutes from "./routes/ministryRoutes";
import memberRoutes from "./routes/memberRoutes";

const app = express();

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/ministries", ministryRoutes);
app.use("/api/members", memberRoutes);

export default app;
