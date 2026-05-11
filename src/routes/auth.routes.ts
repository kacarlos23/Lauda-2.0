import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ForbiddenError } from "../errors/AppError";
import { Request, Response, NextFunction } from "express";

const router = Router();
const authController = new AuthController();

router.post("/register", (req, res) => authController.register(req, res));
router.post("/member-register", (req, res) => authController.registerPublicMember(req, res));
router.post("/login", (req, res) => authController.login(req, res));
router.post("/refresh", (req, res) => authController.refresh(req, res));
router.post("/forgot-password", (req, res) => authController.forgotPassword(req, res));
router.post("/reset-password", (req, res) => authController.resetPassword(req, res));

function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === "TENANT_ADMIN" || role === "GLOBAL_ADMIN") return next();
  next(new ForbiddenError("Acesso negado: apenas administradores"));
}

router.get("/member-invite", authMiddleware, requireAdmin, (req, res) =>
  authController.getMemberInvite(req, res)
);
router.post("/member-invite/regenerate", authMiddleware, requireAdmin, (req, res) =>
  authController.regenerateMemberInvite(req, res)
);

export default router;
