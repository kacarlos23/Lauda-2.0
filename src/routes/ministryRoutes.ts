import { Router } from "express";
import { Role } from "@prisma/client";
import { MinistryController } from "../controllers/MinistryController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new MinistryController();

// All ministry routes require authentication
router.use(authMiddleware);

router.post(
  "/assign",
  requireRole(Role.GLOBAL_ADMIN, Role.TENANT_ADMIN, Role.MINISTRY_LEADER),
  (req, res) => ctrl.assignMember(req, res)
);
router.patch(
  "/assignment",
  requireRole(Role.GLOBAL_ADMIN, Role.TENANT_ADMIN, Role.MINISTRY_LEADER),
  (req, res) => ctrl.updateAssignment(req, res)
);
router.delete(
  "/assignment/:assignmentId",
  requireRole(Role.GLOBAL_ADMIN, Role.TENANT_ADMIN, Role.MINISTRY_LEADER),
  (req, res) => ctrl.removeAssignment(req, res)
);

router.get("/", (req, res) => ctrl.list(req, res));
router.get("/:id", (req, res) => ctrl.getOne(req, res));
router.get("/:id/members", (req, res) => ctrl.listMembers(req, res));
router.post("/", (req, res) => ctrl.create(req, res));
router.put("/:id", (req, res) => ctrl.update(req, res));
router.delete("/:id", (req, res) => ctrl.remove(req, res));
router.post("/:id/members", (req, res) => ctrl.addMember(req, res));
router.delete("/:id/members/:userId", (req, res) => ctrl.removeMember(req, res));

export default router;
