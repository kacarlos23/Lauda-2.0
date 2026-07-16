import { NextFunction, Request, Response } from "express";
import { errorHandler } from "../../middlewares/errorHandler";

function response(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("errorHandler logging", () => {
  it("does not log error messages that may contain credentials or PII", () => {
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const sensitiveValues = [
      "123456",
      "new-secret-password",
      "eyJhbGciOiJIUzI1NiJ9.sensitive.signature",
      "person@example.com",
    ];

    errorHandler(
      new Error(sensitiveValues.join(" ")),
      {} as Request,
      response(),
      jest.fn() as NextFunction,
    );

    const serializedLogs = JSON.stringify(logSpy.mock.calls);
    for (const value of sensitiveValues) expect(serializedLogs).not.toContain(value);
    expect(serializedLogs).toContain("Error");
    logSpy.mockRestore();
  });
});
