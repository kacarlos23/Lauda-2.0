import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const authController = new AuthController();

router.post("/register", (req, res) => authController.register(req, res));
router.post("/member-register", (req, res) => authController.registerPublicMember(req, res));
router.post("/login", (req, res) => authController.login(req, res));
router.post("/refresh", (req, res) => authController.refresh(req, res));
router.get("/me", authMiddleware, (req, res) => authController.me(req, res));
router.post("/forgot-password", (req, res) => authController.forgotPassword(req, res));
router.post("/reset-password", (req, res) => authController.resetPassword(req, res));

router.get("/member-invite", authMiddleware, requirePermission("member:invite"), (req, res) =>
  authController.getMemberInvite(req, res)
);
router.post("/member-invite/regenerate", authMiddleware, requirePermission("member:invite"), (req, res) =>
  authController.regenerateMemberInvite(req, res)
);

export default router;
