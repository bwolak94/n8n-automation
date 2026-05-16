import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { Plan } from "@automation-hub/shared";
import { PlanLimitError, UnauthorizedError } from "../../shared/errors/index.js";

// ── ESM mock: TenantModel ─────────────────────────────────────────────────────
const mockFindOne = jest.fn();

jest.unstable_mockModule("../../modules/tenants/Tenant.model.js", () => ({
  TenantModel: { findOne: mockFindOne },
  PLAN_LIMITS: {
    [Plan.FREE]: {
      workflows: 3,
      executionsPerMonth: 100,
      aiTokensPerMonth: 10_000,
      members: 1,
      customNodes: 0,
    },
    [Plan.PRO]: {
      workflows: 25,
      executionsPerMonth: 5_000,
      aiTokensPerMonth: 500_000,
      members: 5,
      customNodes: 10,
    },
    [Plan.ENTERPRISE]: {
      workflows: Infinity,
      executionsPerMonth: Infinity,
      aiTokensPerMonth: Infinity,
      members: Infinity,
      customNodes: Infinity,
    },
  },
}));

const { planGuard } = await import("../../shared/middleware/planGuard.js");

function makeReq(tenantId?: string): Request {
  return { tenantId } as unknown as Request;
}

const mockRes = {} as Response;

function makeTenantDoc(plan: string, usage: Record<string, number>) {
  return {
    plan,
    usageThisMonth: {
      workflows: usage["workflows"] ?? 0,
      executions: usage["executions"] ?? 0,
      aiTokens: usage["aiTokens"] ?? 0,
      members: usage["members"] ?? 0,
    },
  };
}

describe("planGuard middleware", () => {
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
    jest.clearAllMocks();
  });

  it("returns 401 when tenantId is missing", async () => {
    await planGuard("workflows")(makeReq(undefined), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("returns 401 when tenant not found in DB", async () => {
    mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  describe("workflow limits", () => {
    it("free plan: returns 402 at 3 workflows (limit reached)", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { workflows: 3 })),
      });
      await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(PlanLimitError));
    });

    it("free plan: passes at 2 workflows (under limit)", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { workflows: 2 })),
      });
      await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(/* no args */);
    });

    it("pro plan: passes at 100 workflows (under 25 limit... wait, 100 > 25 → 402)", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.PRO, { workflows: 25 })),
      });
      await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(PlanLimitError));
    });

    it("pro plan: passes at 10 workflows", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.PRO, { workflows: 10 })),
      });
      await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(/* no args */);
    });

    it("enterprise plan: always passes regardless of usage", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.ENTERPRISE, { workflows: 99999 })),
      });
      await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(/* no args */);
    });
  });

  describe("execution limits", () => {
    it("free plan: returns 402 at 100 executions (limit reached)", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { executions: 100 })),
      });
      await planGuard("executions")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(PlanLimitError));
    });

    it("pro plan: passes at 100 executions (under 5000 limit)", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.PRO, { executions: 100 })),
      });
      await planGuard("executions")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(/* no args */);
    });
  });

  describe("member limits", () => {
    it("free plan: returns 402 at 1 member (limit reached)", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { members: 1 })),
      });
      await planGuard("members")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(PlanLimitError));
    });
  });

  describe("aiToken limits", () => {
    it("free plan: returns 402 when aiTokens at limit", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { aiTokens: 10_000 })),
      });
      await planGuard("aiTokens")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(PlanLimitError));
    });

    it("free plan: passes below limit", async () => {
      mockFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { aiTokens: 5_000 })),
      });
      await planGuard("aiTokens")(makeReq("t-1"), mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(/* no args */);
    });
  });

  it("passes for unknown plan (graceful degradation)", async () => {
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(makeTenantDoc("custom_plan", { workflows: 999 })),
    });
    await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(/* no args */);
  });

  it("402 error has PLAN_LIMIT_EXCEEDED code", async () => {
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(makeTenantDoc(Plan.FREE, { workflows: 3 })),
    });
    await planGuard("workflows")(makeReq("t-1"), mockRes, mockNext);
    const err = (mockNext as jest.MockedFunction<NextFunction>).mock.calls[0]?.[0] as PlanLimitError;
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe("PLAN_LIMIT_EXCEEDED");
  });
});
