import { Response } from "express";

export abstract class BaseController {
  protected handleSuccess<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json({ success: true, data });
  }

  protected handleError(error: unknown, res: Response, context: string): void {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error(`[${context}] Error:`, message);
    res.status(500).json({ success: false, error: message });
  }

  protected handleNotFound(res: Response, message = "Recurso não encontrado"): void {
    res.status(404).json({ success: false, error: message });
  }

  protected handleUnauthorized(res: Response, message = "Não autorizado"): void {
    res.status(401).json({ success: false, error: message });
  }

  protected handleForbidden(res: Response, message = "Acesso proibido"): void {
    res.status(403).json({ success: false, error: message });
  }

  protected handleBadRequest(res: Response, message: string): void {
    res.status(400).json({ success: false, error: message });
  }
}
