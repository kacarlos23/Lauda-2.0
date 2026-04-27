import { Router } from "express";
import { ScheduleController } from "../controllers/ScheduleController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new ScheduleController();

router.use(authMiddleware);

router.post("/", (req, res) => ctrl.create(req, res));

export default router;
