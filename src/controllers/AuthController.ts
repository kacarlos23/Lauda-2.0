import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { AuthService } from "../services/authService";
import { registerSchema, loginSchema } from "../validators/auth.schema";

const authService = new AuthService();

export class AuthController extends BaseController {
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

  async login(req: Request, res: Response): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);
      this.handleSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        this.handleBadRequest(res, error.message);
      } else {
        this.handleError(error, res, "AuthController.login");
      }
    }
  }
}
