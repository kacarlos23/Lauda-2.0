import { Router } from "express";
import { MinistryController } from "../controllers/MinistryController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new MinistryController();

// All ministry routes require authentication
router.use(authMiddleware);

router.post(
  "/assign",
  requirePermission("ministry:assign_members"),
  (req, res) => ctrl.assignMember(req, res)
);
router.patch(
  "/assignment",
  requirePermission("ministry:assign_members"),
  (req, res) => ctrl.updateAssignment(req, res)
);
router.delete(
  "/assignment/:assignmentId",
  requirePermission("ministry:assign_members"),
  (req, res) => ctrl.removeAssignment(req, res)
);

router.get("/", requirePermission("ministry:view"), (req, res) => ctrl.list(req, res));
router.get("/:id", requirePermission("ministry:view"), (req, res) => ctrl.getOne(req, res));
router.post("/:id/toggle-member", requirePermission("ministry:assign_members"), (req, res) => ctrl.toggleMember(req, res));
router.get("/:id/members", requirePermission("ministry:view"), (req, res) => ctrl.listMembers(req, res));
router.post("/", requirePermission("ministry:create"), (req, res) => ctrl.create(req, res));
router.put("/:id", requirePermission("ministry:edit"), (req, res) => ctrl.update(req, res));
router.delete("/:id", requirePermission("ministry:delete"), (req, res) => ctrl.remove(req, res));
// These two routes also allow the contextual leader of the target ministry;
// MinistryService enforces either the granular permission or that leadership.
router.post("/:id/members", (req, res) => ctrl.addMember(req, res));
router.delete("/:id/members/:userId", (req, res) => ctrl.removeMember(req, res));

export default router;
