import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";
import {
  forgotPasswordRateLimit,
  inviteReadRateLimit,
  inviteRegenerateRateLimit,
  loginRateLimit,
  memberRegistrationRateLimit,
  refreshRateLimit,
  registrationRateLimit,
  resetPasswordRateLimit,
} from "../middlewares/rateLimitMiddleware";

const router = Router();
const authController = new AuthController();

router.post("/register", registrationRateLimit, (req, res) => authController.register(req, res));
router.post("/member-register", memberRegistrationRateLimit, (req, res) => authController.registerPublicMember(req, res));
router.post("/login", loginRateLimit, (req, res) => authController.login(req, res));
router.post("/refresh", refreshRateLimit, (req, res) => authController.refresh(req, res));
router.get("/me", authMiddleware, (req, res) => authController.me(req, res));
router.post("/forgot-password", forgotPasswordRateLimit, (req, res) => authController.forgotPassword(req, res));
router.post("/reset-password", resetPasswordRateLimit, (req, res) => authController.resetPassword(req, res));

router.get("/member-invite", authMiddleware, requirePermission("member:invite"), inviteReadRateLimit, (req, res) =>
  authController.getMemberInvite(req, res)
);
router.post("/member-invite/regenerate", authMiddleware, requirePermission("member:invite"), inviteRegenerateRateLimit, (req, res) =>
  authController.regenerateMemberInvite(req, res)
);

export default router;
