import { NextFunction, Request, Response } from "express";
import { errorHandler } from "../../middlewares/errorHandler";
import { setLogSinkForTests } from "../../observability/logger";

function response(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("errorHandler logging", () => {
  it.each([
    ["entity.too.large", 413, "PAYLOAD_TOO_LARGE"],
    ["entity.parse.failed", 400, "INVALID_JSON"],
  ])("returns a client error for %s", (type, status, code) => {
    const res = response();
    errorHandler(Object.assign(new Error("body-parser"), { type }), {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code }));
  });

  it("does not log error messages that may contain credentials or PII", () => {
    const records: string[] = [];
    setLogSinkForTests((record) => records.push(record));
    const sensitiveValues = [
      "123456",
      "new-secret-password",
      "eyJhbGciOiJIUzI1NiJ9.sensitive.signature",
      "person@example.com",
    ];

    errorHandler(
      new Error(sensitiveValues.join(" ")),
      { requestId: "error-handler-test" } as Request,
      response(),
      jest.fn() as NextFunction,
    );

    const serializedLogs = records.join("\n");
    for (const value of sensitiveValues) expect(serializedLogs).not.toContain(value);
    expect(serializedLogs).toContain("Error");
    setLogSinkForTests();
  });
});
