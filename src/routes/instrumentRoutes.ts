import { Router } from "express";
import { InstrumentController } from "../controllers/InstrumentController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new InstrumentController();

router.use(authMiddleware);

router.get("/", requirePermission("instrument:view"), (req, res) => ctrl.list(req, res));
router.post("/", requirePermission("instrument:create"), (req, res) => ctrl.create(req, res));
router.patch("/:id", requirePermission("instrument:edit"), (req, res) => ctrl.update(req, res));
router.delete("/:id", requirePermission("instrument:delete"), (req, res) => ctrl.delete(req, res));

export default router;
