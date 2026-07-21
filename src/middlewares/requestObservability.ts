import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { logger } from "../observability/logger";
import { runWithRequestContext } from "../observability/requestContext";

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function resolveRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function requestObservability(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req.headers["x-request-id"]);
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  runWithRequestContext({ requestId }, () => {
    res.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const routePath = req.route?.path;
      const route = routePath ? `${req.baseUrl || ""}${String(routePath)}` : "unmatched";
      logger.info("http_request_completed", {
        category: "access",
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        outcome: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "rejected" : "success",
      });
    });
    next();
  });
}
