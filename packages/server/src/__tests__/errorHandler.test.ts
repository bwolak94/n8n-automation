import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import {
  AppError,
  NotFoundError,
  PlanLimitError,
  UnauthorizedError,
  ValidationError,
} from "../shared/errors/index.js";
import { errorHandler } from "../shared/middleware/errorHandler.js";

describe("errorHandler middleware", () => {
  const mockReq = {} as Request;
  const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

  let mockRes: { status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  it.each([
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ValidationError(), 400, "VALIDATION_ERROR"],
    [new PlanLimitError(), 402, "PLAN_LIMIT_EXCEEDED"],
  ] as const)(
    "maps %s to HTTP %i with code %s",
    (error, expectedStatus, expectedCode) => {
      errorHandler(error, mockReq, mockRes as unknown as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(expectedStatus);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: { code: expectedCode, message: expect.any(String) },
      });
    }
  );

  it("maps a generic AppError with a custom status code", () => {
    const error = new AppError("Conflict", 409, "CONFLICT");
    errorHandler(error, mockReq, mockRes as unknown as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: { code: "CONFLICT", message: "Conflict" },
    });
  });

  it("returns 500 INTERNAL_SERVER_ERROR for unknown errors", () => {
    errorHandler(
      new Error("Something exploded"),
      mockReq,
      mockRes as unknown as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });

  it("returns 500 for non-Error thrown values (strings, objects)", () => {
    errorHandler(
      "plain string error",
      mockReq,
      mockRes as unknown as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
