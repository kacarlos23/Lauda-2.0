import { Router } from "express";
import { ScheduleController } from "../controllers/ScheduleController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new ScheduleController();

router.use(authMiddleware);

router.get("/me", (req, res) => ctrl.listMine(req, res));
router.get("/", requirePermission("schedule:view"), (req, res) => ctrl.list(req, res));
router.get("/:id/report", requirePermission("schedule:view_reports"), (req, res) => ctrl.exportReport(req, res));
router.post("/", (req, res) => ctrl.create(req, res));
router.patch("/:id", requirePermission("schedule:edit"), (req, res) => ctrl.update(req, res));
router.delete("/:id", requirePermission("schedule:delete"), (req, res) => ctrl.delete(req, res));
router.post("/:id/assignments", requirePermission("schedule:assign_members"), (req, res) => ctrl.addAssignment(req, res));
router.patch("/:id/assignments/:assignmentId/status", requirePermission("schedule:respond"), (req, res) => ctrl.updateAssignmentStatus(req, res));
router.patch("/:id/assignments/:assignmentId/substitution/resolve", requirePermission("schedule:edit"), (req, res) => ctrl.resolveSubstitution(req, res));
router.delete("/:id/assignments/:assignmentId", requirePermission("schedule:assign_members"), (req, res) => ctrl.removeAssignment(req, res));

export default router;
