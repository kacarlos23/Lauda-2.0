import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

/**
 * Global error handler middleware.
 * Translates Zod errors and AppErrors into standard { error, code, details } responses.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    const details = error.issues.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    
    res.status(400).json({
      success: false,
      error: "Erro de validação",
      code: 400,
      details,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.statusCode,
    });
    return;
  }

  // Fallback for unhandled errors
  const message = error instanceof Error ? error.message : "Erro interno do servidor";
  console.error("[UnhandledError]", error);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Erro interno do servidor" : message,
    code: 500,
  });
}
