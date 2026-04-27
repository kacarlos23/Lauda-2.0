import { NextFunction, Request, Response } from "express";

/**
 * Converts uncaught route errors into a normalized API response.
 *
 * @param error Error thrown by previous middleware or route handlers.
 * @param _req Express request.
 * @param res Express response.
 * @param _next Next callback required by Express error middleware signature.
 * @returns Nothing; sends a JSON error response.
 */
export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = error instanceof Error ? error.message : "Erro interno do servidor";
  console.error("[UnhandledError]", message);
  res.status(500).json({ success: false, error: message });
}
