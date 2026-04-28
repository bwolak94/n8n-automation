import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../shared/middleware/authenticate.js";
import { UnauthorizedError } from "../shared/errors/index.js";

// JWT_SECRET comes from setup.env.ts — same value used to sign test tokens
const TEST_SECRET = process.env["JWT_SECRET"]!;

describe("authenticate middleware", () => {
  const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  const mockRes = {} as Response;

  const makeReq = (authorization?: string): Request =>
    ({ headers: authorization ? { authorization } : {} } as Request);

  beforeEach(() => jest.clearAllMocks());

  it("calls next with UnauthorizedError when Authorization header is absent", () => {
    authenticate(makeReq(), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next with UnauthorizedError when header is not Bearer format", () => {
    authenticate(makeReq("Basic dXNlcjpwYXNz"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("attaches req.user and calls next() for a valid token", () => {
    const token = jwt.sign(
      { userId: "user-1", email: "alice@example.com" },
      TEST_SECRET
    );
    const req = makeReq(`Bearer ${token}`);

    authenticate(req, mockRes, mockNext);

    expect(req.user).toEqual({ userId: "user-1", email: "alice@example.com" });
    expect(mockNext).toHaveBeenCalledWith(/* no args */);
  });

  it("calls next with UnauthorizedError for an expired token", () => {
    const token = jwt.sign(
      { userId: "user-1", email: "alice@example.com" },
      TEST_SECRET,
      { expiresIn: -1 }
    );
    authenticate(makeReq(`Bearer ${token}`), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next with UnauthorizedError for a malformed token", () => {
    authenticate(makeReq("Bearer not.a.valid.jwt"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("calls next with UnauthorizedError when payload is missing required fields", () => {
    const token = jwt.sign({ sub: "user-1" }, TEST_SECRET);
    authenticate(makeReq(`Bearer ${token}`), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("sets status 401 and code UNAUTHORIZED on the error", () => {
    authenticate(makeReq(), mockRes, mockNext);
    const error = (mockNext as jest.Mock).mock.calls[0][0] as UnauthorizedError;
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
  });
});
