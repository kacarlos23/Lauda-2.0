import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { logger } from "../observability/logger";

/**
 * Global error handler middleware.
 * Translates Zod errors and AppErrors into standard { error, code, details } responses.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error && typeof error === "object" && "type" in error) {
    if (error.type === "entity.too.large") {
      res.status(413).json({
        success: false,
        error: "O arquivo ou os dados enviados excedem o tamanho permitido.",
        code: "PAYLOAD_TOO_LARGE",
      });
      return;
    }
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ success: false, error: "O JSON enviado não é válido.", code: "INVALID_JSON" });
      return;
    }
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
    
    res.status(400).json({
      success: false,
      error: "Erro de validação",
      code: "VALIDATION_ERROR",
      details,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code ?? error.statusCode,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
    return;
  }

  // Fallback for unhandled errors
  const message = error instanceof Error ? error.message : "Erro interno do servidor";
  const errorName = error instanceof Error ? error.name : "UnknownError";
  logger.error("unhandled_request_error", {
    category: "observability",
    errorName,
    statusCode: 500,
    outcome: "error",
    requestId: req.requestId,
  });
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Erro interno do servidor" : message,
    code: 500,
  });
}
