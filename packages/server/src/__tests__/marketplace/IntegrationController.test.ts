import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { IntegrationController } from "../../modules/marketplace/IntegrationController.js";
import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { TemplateStatus } from "../../modules/marketplace/IntegrationTemplate.model.js";
import type { IntegrationService } from "../../modules/marketplace/IntegrationService.js";
import type { TemplateRecord } from "../../modules/marketplace/IntegrationRepository.js";
import type { ApiWorkflow } from "../../modules/workflows/WorkflowRepository.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    templateId: "tpl-1",
    name: "Slack Notifier",
    description: "Sends Slack alerts",
    category: "communication",
    tags: [],
    author: "Alice",
    authorId: "user-1",
    isOfficial: true,
    status: TemplateStatus.APPROVED,
    workflow: { nodes: [], edges: [], variables: {} },
    requiredNodeTypes: ["slack"],
    installCount: 5,
    rating: 4.0,
    ratingCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeApiWorkflow(): ApiWorkflow {
  return {
    id: "wf-1", tenantId: "tenant-1", name: "My Workflow", description: "",
    nodes: [], edges: [], variables: {}, tags: [], status: "draft",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as unknown as ApiWorkflow;
}

function makeService(): jest.Mocked<IntegrationService> {
  return {
    listTemplates:    jest.fn(),
    getTemplate:      jest.fn(),
    installTemplate:  jest.fn(),
    publishTemplate:  jest.fn(),
    approveTemplate:  jest.fn(),
    rejectTemplate:   jest.fn(),
  } as unknown as jest.Mocked<IntegrationService>;
}

function makeRes(): jest.Mocked<Response> {
  const res = { json: jest.fn(), status: jest.fn() } as unknown as jest.Mocked<Response>;
  (res.status as jest.MockedFunction<typeof res.status>).mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    query:    {},
    params:   {},
    body:     {},
    tenantId: "tenant-1",
    user:     { userId: "user-1", email: "alice@example.com" },
    ...overrides,
  } as unknown as Request;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("IntegrationController", () => {
  let service: jest.Mocked<IntegrationService>;
  let controller: IntegrationController;
  let res: jest.Mocked<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    service    = makeService();
    controller = new IntegrationController(service);
    res        = makeRes();
    next       = jest.fn() as jest.MockedFunction<NextFunction>;
  });

  // ── listTemplates ────────────────────────────────────────────────────────

  it("listTemplates returns result as JSON", async () => {
    const result = { items: [makeTemplate()], total: 1 };
    service.listTemplates.mockResolvedValue(result);

    await controller.listTemplates(makeReq(), res, next);

    expect(res.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it("listTemplates passes query params to service", async () => {
    service.listTemplates.mockResolvedValue({ items: [], total: 0 });

    await controller.listTemplates(
      makeReq({ query: { category: "communication", sort: "rating" } }),
      res,
      next
    );

    expect(service.listTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ category: "communication", sort: "rating" })
    );
  });

  it("listTemplates forwards service errors to next", async () => {
    const err = new NotFoundError("boom");
    service.listTemplates.mockRejectedValue(err);

    await controller.listTemplates(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("listTemplates converts ZodError to ValidationError", async () => {
    service.listTemplates.mockRejectedValue(
      new z.ZodError([{ code: "invalid_type", expected: "string", received: "number", path: ["sort"], message: "bad sort" }])
    );

    await controller.listTemplates(makeReq({ query: { sort: "bad" } }), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("listTemplates uses fallback message when ZodError has no message", async () => {
    service.listTemplates.mockRejectedValue(
      new z.ZodError([{ code: "custom", path: ["sort"], message: "" }])
    );

    await controller.listTemplates(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  // ── getTemplate ──────────────────────────────────────────────────────────

  it("getTemplate returns template as JSON", async () => {
    const tpl = makeTemplate();
    service.getTemplate.mockResolvedValue(tpl);

    await controller.getTemplate(makeReq({ params: { id: "tpl-1" } }), res, next);

    expect(service.getTemplate).toHaveBeenCalledWith("tpl-1");
    expect(res.json).toHaveBeenCalledWith(tpl);
  });

  it("getTemplate forwards errors to next", async () => {
    const err = new NotFoundError("tpl not found");
    service.getTemplate.mockRejectedValue(err);

    await controller.getTemplate(makeReq({ params: { id: "bad" } }), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  // ── installTemplate ──────────────────────────────────────────────────────

  it("installTemplate returns 201 with cloned workflow", async () => {
    const workflow = makeApiWorkflow();
    service.installTemplate.mockResolvedValue(workflow);

    await controller.installTemplate(
      makeReq({ params: { id: "tpl-1" }, body: { workflowName: "My Copy" } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(workflow);
  });

  it("installTemplate calls next(ValidationError) when tenantId is missing", async () => {
    await controller.installTemplate(
      makeReq({ tenantId: undefined as unknown as string, params: { id: "tpl-1" } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("installTemplate converts ZodError to ValidationError on invalid body", async () => {
    // workflowName: "" fails min(1) validation
    await controller.installTemplate(
      makeReq({ params: { id: "tpl-1" }, body: { workflowName: "" } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("installTemplate forwards service errors", async () => {
    service.installTemplate.mockRejectedValue(new NotFoundError("template gone"));

    await controller.installTemplate(
      makeReq({ params: { id: "bad" }, body: {} }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  // ── publishTemplate ──────────────────────────────────────────────────────

  it("publishTemplate returns 201 with created template", async () => {
    const tpl = makeTemplate({ status: TemplateStatus.PENDING_REVIEW });
    service.publishTemplate.mockResolvedValue(tpl);

    await controller.publishTemplate(
      makeReq({
        body: {
          name: "HTTP→Slack",
          workflowId: "wf-1",
          category: "integrations",
        },
      }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(tpl);
  });

  it("publishTemplate uses userId as displayName when email is absent", async () => {
    const tpl = makeTemplate({ status: TemplateStatus.PENDING_REVIEW });
    service.publishTemplate.mockResolvedValue(tpl);

    await controller.publishTemplate(
      makeReq({
        user: { userId: "user-1" } as never, // no email
        body: { name: "My Template", workflowId: "wf-1", category: "integrations" },
      }),
      res,
      next
    );

    expect(service.publishTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ userDisplayName: "user-1" })
    );
  });

  it("publishTemplate calls next(ValidationError) when tenantId is missing", async () => {
    await controller.publishTemplate(
      makeReq({ tenantId: undefined as unknown as string, body: { name: "T", workflowId: "w", category: "c" } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("publishTemplate calls next(ValidationError) when userId is missing", async () => {
    await controller.publishTemplate(
      makeReq({
        user: { userId: undefined as unknown as string, email: "alice@example.com" } as never,
        body: { name: "T", workflowId: "w", category: "c" },
      }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("publishTemplate converts ZodError to ValidationError on invalid body", async () => {
    // name: "" fails min(1) validation
    await controller.publishTemplate(
      makeReq({ body: { name: "", workflowId: "wf-1", category: "integrations" } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("publishTemplate forwards service errors", async () => {
    service.publishTemplate.mockRejectedValue(new NotFoundError("wf not found"));

    await controller.publishTemplate(
      makeReq({ body: { name: "T", workflowId: "missing", category: "integrations" } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
