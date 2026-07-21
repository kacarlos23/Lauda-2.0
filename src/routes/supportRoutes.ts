import { Router } from "express";
import { PrivilegedAccessController } from "../controllers/PrivilegedAccessController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireSupportAccess } from "../middlewares/supportAccessMiddleware";

const router = Router();
const controller = new PrivilegedAccessController();

router.use(authMiddleware);
router.get("/:resource", requireSupportAccess("read"), (req, res) => controller.listSupportResource(req, res));
router.get("/:resource/:id", requireSupportAccess("read"), (req, res) => controller.getSupportResource(req, res));

export default router;
