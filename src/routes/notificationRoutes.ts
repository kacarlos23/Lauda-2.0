import { Router } from "express";
import { NotificationController } from "../controllers/NotificationController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);
router.get("/", (req, res) => controller.list(req, res));
router.post("/read-all", (req, res) => controller.markAllRead(req, res));
router.patch("/:id/read", (req, res) => controller.markRead(req, res));
router.post("/devices", (req, res) => controller.registerDevice(req, res));
router.delete("/devices/:id", (req, res) => controller.removeDevice(req, res));
router.post("/realtime-ticket", (req, res) => controller.issueRealtimeTicket(req, res));

export default router;
