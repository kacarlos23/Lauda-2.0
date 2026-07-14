import { Router } from "express";
import { MemberController } from "../controllers/MemberController";
import { MinistryController } from "../controllers/MinistryController";
import { authMiddleware, requirePermission, requireSelfOrPermission } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new MemberController();
const ministryCtrl = new MinistryController();

router.use(authMiddleware);

router.get("/me/ministries", (req, res) => ministryCtrl.getMyAssignments(req, res));
router.get("/me", (req, res) => ctrl.getMe(req, res));
router.patch("/me/profile", (req, res) => ctrl.updateMyProfile(req, res));
router.patch("/me/instruments", (req, res) => ctrl.updateMyInstruments(req, res));
router.get("/", requirePermission("member:view"), (req, res) => ctrl.list(req, res));
router.get("/:id", requirePermission("member:view"), (req, res) => ctrl.getOne(req, res));
router.patch("/:id", requirePermission("member:edit"), (req, res) => ctrl.update(req, res));
router.delete("/:id", requirePermission("member:delete"), (req, res) => ctrl.remove(req, res));
router.patch("/:id/instruments", requireSelfOrPermission("member:edit"), (req, res) => ctrl.updateInstruments(req, res));
router.patch("/:id/permissions", requirePermission("member:manage_access"), (req, res) => ctrl.updatePermissions(req, res));
router.post("/", requirePermission("member:create"), (req, res) => ctrl.create(req, res));
router.post("/:id/ministries", requirePermission("member:assign_ministry"), (req, res) => ctrl.addMinistry(req, res));

export default router;
