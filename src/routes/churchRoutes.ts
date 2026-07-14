import { Router } from "express";
import { ChurchController } from "../controllers/ChurchController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new ChurchController();

router.use(authMiddleware);
router.use(requirePermission("tenant:manage"));

router.get("/me", (req, res) => ctrl.getMe(req, res));
router.patch("/me", (req, res) => ctrl.updateMe(req, res));
router.get("/overview", (req, res) => ctrl.getOverview(req, res));

export default router;
