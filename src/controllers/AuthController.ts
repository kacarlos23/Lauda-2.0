import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { AuthService } from "../services/authService";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
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
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      this.handleSuccess(res, result, 201);
    } catch (error) {
      if (error instanceof Error) {
        this.handleBadRequest(res, error.message);
      } else {
        this.handleError(error, res, "AuthController.register");
      }
    }
  }

  /**
   * Authenticates a user and returns access and refresh tokens.
   *
   * @param req Express request with login credentials.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);
      this.handleSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        this.handleUnauthorized(res, error.message);
      } else {
        this.handleError(error, res, "AuthController.login");
      }
    }
  }

  /**
   * Exchanges a refresh token for a new token pair.
   *
   * @param req Express request with refresh token payload.
   * @param res Express response.
   * @returns A promise that resolves after the response is sent.
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const input = refreshTokenSchema.parse(req.body);
      const result = await authService.refresh(input);
      this.handleSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        this.handleUnauthorized(res, error.message);
      } else {
        this.handleError(error, res, "AuthController.refresh");
      }
    }
  }
}
