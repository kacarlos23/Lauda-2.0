import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { AuthService } from "../services/authService";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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
    const result = await authService.register(input);
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
    const result = await authService.login(input);
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
}
