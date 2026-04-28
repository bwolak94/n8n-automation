import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { validateRequest } from "../shared/middleware/validateRequest.js";
import { ValidationError } from "../shared/errors/index.js";

describe("validateRequest middleware", () => {
  const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  const mockRes = {} as Response;

  beforeEach(() => jest.clearAllMocks());

  const bodySchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it("calls next() without error for valid body", () => {
    const req = { body: { name: "Alice", age: 30 } } as Request;
    validateRequest(bodySchema)(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(/* no args */);
    expect(req.body).toEqual({ name: "Alice", age: 30 });
  });

  it("calls next with ValidationError for invalid body", () => {
    const req = { body: { name: "", age: -5 } } as Request;
    validateRequest(bodySchema)(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    const error = (mockNext as jest.Mock).mock.calls[0][0] as ValidationError;
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(error.errors)).toBe(true);
    expect(error.errors!.length).toBeGreaterThan(0);
  });

  it("includes field paths in the validation error", () => {
    const req = { body: { age: "not-a-number" } } as Request;
    validateRequest(bodySchema)(req, mockRes, mockNext);

    const error = (mockNext as jest.Mock).mock.calls[0][0] as ValidationError;
    const paths = error.errors!.map((e) => e.path[0]);
    expect(paths).toContain("name");
  });

  it("validates query params when target is 'query'", () => {
    const querySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
    });
    const req = { query: { page: "3" } } as unknown as Request;
    validateRequest(querySchema, "query")(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(/* no args */);
  });

  it("calls next with ValidationError for invalid route params", () => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const req = { params: { id: "not-a-uuid" } } as unknown as Request;
    validateRequest(paramsSchema, "params")(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("replaces req[target] with the parsed (coerced) data", () => {
    const schema = z.object({ active: z.coerce.boolean() });
    const req = { body: { active: "true" } } as Request;
    validateRequest(schema)(req, mockRes, mockNext);

    expect(req.body).toEqual({ active: true });
  });
});
