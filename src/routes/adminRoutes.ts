import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminController } from "../controllers/AdminController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new AdminController();

router.use(authMiddleware);
router.use(requireRole(Role.GLOBAL_ADMIN));

router.get("/tenants", (req, res) => ctrl.listTenants(req, res));
router.get("/tenants/:tenantId", (req, res) => ctrl.getTenant(req, res));
router.get("/users", (req, res) => ctrl.listUsers(req, res));
router.get("/ministries", (req, res) => ctrl.listMinistries(req, res));

export default router;
