import { Router } from "express";
import { ScheduleController } from "../controllers/ScheduleController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new ScheduleController();

router.use(authMiddleware);

router.get("/me", (req, res) => ctrl.listMine(req, res));
router.get("/", (req, res) => ctrl.list(req, res));
router.post("/", (req, res) => ctrl.create(req, res));
router.post("/:id/assignments", (req, res) => ctrl.addAssignment(req, res));
router.patch("/:id/assignments/:assignmentId/status", (req, res) => ctrl.updateAssignmentStatus(req, res));
router.delete("/:id/assignments/:assignmentId", (req, res) => ctrl.removeAssignment(req, res));

export default router;
