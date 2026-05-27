import { Router } from "express";
import { Role } from "@prisma/client";
import { ChurchController } from "../controllers/ChurchController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new ChurchController();

router.use(authMiddleware);
router.use(requireRole(Role.TENANT_ADMIN));

router.get("/me", (req, res) => ctrl.getMe(req, res));
router.patch("/me", (req, res) => ctrl.updateMe(req, res));
router.get("/overview", (req, res) => ctrl.getOverview(req, res));

export default router;
