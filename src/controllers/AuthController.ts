import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { AuthService } from "../services/authService";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  publicMemberRegisterSchema,
  memberInviteBodySchema,
  memberInviteQuerySchema,
  changePasswordSchema,
  mfaCodeSchema,
  mfaSetupSchema,
  stepUpSchema,
} from "../validators/auth.schema";

const authService = new AuthService();

export class AuthController extends BaseController {
  /**
   * Registers a tenant and its first administrator.
   *
   * @param req Express request with registration payload.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async register(req: Request, res: Response): Promise<void> {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input, this.sessionMetadata(req));
    this.handleSuccess(res, result, 201);
  }

  async registerPublicMember(req: Request, res: Response): Promise<void> {
    const input = publicMemberRegisterSchema.parse(req.body);
    const result = await authService.registerPublicMember(input, this.sessionMetadata(req));
    this.handleSuccess(res, result, 201);
  }

  /**
   * Authenticates a user and returns access and refresh tokens.
   *
   * @param req Express request with login credentials.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async login(req: Request, res: Response): Promise<void> {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, this.sessionMetadata(req));
    this.handleSuccess(res, result);
  }

  /**
   * Exchanges a refresh token for a new token pair.
   *
   * @param req Express request with refresh token payload.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const input = refreshTokenSchema.parse(req.body);
    const result = await authService.refresh(input);
    this.handleSuccess(res, result);
  }

  async me(req: Request, res: Response): Promise<void> {
    const result = await authService.me(req.user!.id);
    this.handleSuccess(res, result);
  }

  async logout(req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await authService.logout(req.user!.id, req.user!.sessionId));
  }

  async logoutAll(req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await authService.logoutAll(req.user!.id));
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const input = changePasswordSchema.parse(req.body);
    this.handleSuccess(res, await authService.changePassword(req.user!.id, input));
  }

  async setupMfa(req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await authService.setupMfa(req.user!.id, mfaSetupSchema.parse(req.body)));
  }

  async confirmMfa(req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await authService.confirmMfa(req.user!.id, req.user!.sessionId, mfaCodeSchema.parse(req.body)));
  }

  async stepUp(req: Request, res: Response): Promise<void> {
    this.handleSuccess(res, await authService.stepUp(req.user!.id, req.user!.sessionId, stepUpSchema.parse(req.body)));
  }

  /**
   * Requests a password reset PIN.
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    const input = forgotPasswordSchema.parse(req.body);
    const result = await authService.requestPasswordReset(input);
    this.handleSuccess(res, result);
  }

  /**
   * Resets the user's password with the PIN.
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    const input = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(input);
    this.handleSuccess(res, result);
  }

  async getMemberInvite(req: Request, res: Response): Promise<void> {
    const input = memberInviteQuerySchema.parse(req.query);
    const result = await authService.getMemberInvite(req.user!.tenantId, input.ministryId);
    this.handleSuccess(res, result);
  }

  async regenerateMemberInvite(req: Request, res: Response): Promise<void> {
    const input = memberInviteBodySchema.parse(req.body ?? {});
    const result = await authService.regenerateMemberInvite(req.user!.tenantId, input.ministryId);
    this.handleSuccess(res, result, 201);
  }

  private sessionMetadata(req: Request) {
    return { userAgent: req.get("user-agent") ?? null, ipAddress: req.ip ?? null };
  }
}
