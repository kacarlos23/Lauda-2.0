import { Router, Request, Response, NextFunction } from "express";
import { MemberController } from "../controllers/MemberController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ForbiddenError } from "../errors/AppError";

const router = Router();
const ctrl = new MemberController();

// All member routes require authentication
router.use(authMiddleware);

// Only admins can create members or view the full directory
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === "TENANT_ADMIN" || role === "GLOBAL_ADMIN") return next();
  next(new ForbiddenError("Acesso negado: apenas administradores"));
}

router.get("/", requireAdmin, (req, res) => ctrl.list(req, res));
router.get("/:id", requireAdmin, (req, res) => ctrl.getOne(req, res));
router.post("/", requireAdmin, (req, res) => ctrl.create(req, res));
router.post("/:id/ministries", requireAdmin, (req, res) => ctrl.addMinistry(req, res));

export default router;
