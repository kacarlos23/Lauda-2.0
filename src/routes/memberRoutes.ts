import { Router, Request, Response, NextFunction } from "express";
import { MemberController } from "../controllers/MemberController";
import { MinistryController } from "../controllers/MinistryController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ForbiddenError } from "../errors/AppError";

const router = Router();
const ctrl = new MemberController();
const ministryCtrl = new MinistryController();

// All member routes require authentication
router.use(authMiddleware);

// Admins and ministry leaders can view the member directory.
function requireDirectoryAccess(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === "TENANT_ADMIN" || role === "GLOBAL_ADMIN" || role === "MINISTRY_LEADER") return next();
  next(new ForbiddenError("Acesso negado: apenas líderes e administradores"));
}

// Only admins can create and manage members.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === "TENANT_ADMIN" || role === "GLOBAL_ADMIN") return next();
  next(new ForbiddenError("Acesso negado: apenas administradores"));
}

router.get("/me/ministries", (req, res) => ministryCtrl.getMyAssignments(req, res));
router.get("/me", (req, res) => ctrl.getMe(req, res));
router.patch("/me/profile", (req, res) => ctrl.updateMyProfile(req, res));
router.patch("/me/instruments", (req, res) => ctrl.updateMyInstruments(req, res));
router.get("/", requireDirectoryAccess, (req, res) => ctrl.list(req, res));
router.get("/:id", requireDirectoryAccess, (req, res) => ctrl.getOne(req, res));
router.patch("/:id/instruments", (req, res) => ctrl.updateInstruments(req, res));
router.patch("/:id/permissions", requireAdmin, (req, res) => ctrl.updatePermissions(req, res));
router.post("/", requireAdmin, (req, res) => ctrl.create(req, res));
router.post("/:id/ministries", requireAdmin, (req, res) => ctrl.addMinistry(req, res));

export default router;
