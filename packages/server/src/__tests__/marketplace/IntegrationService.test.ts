import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { IntegrationService } from "../../modules/marketplace/IntegrationService.js";
import { TemplateStatus } from "../../modules/marketplace/IntegrationTemplate.model.js";
import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { IntegrationRepository, TemplateRecord, ListTemplatesQuery } from "../../modules/marketplace/IntegrationRepository.js";
import type { WorkflowRepository, ApiWorkflow } from "../../modules/workflows/WorkflowRepository.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    templateId: "tpl-1",
    name: "Slack Notifier",
    description: "Sends Slack alerts",
    category: "communication",
    tags: ["slack", "notifications"],
    author: "Alice",
    authorId: "user-1",
    isOfficial: true,
    status: TemplateStatus.APPROVED,
    workflow: {
      nodes: [{ id: "n1", type: "slack", label: "Notify", position: { x: 0, y: 0 }, config: {} }],
      edges: [],
      variables: {},
    },
    requiredNodeTypes: ["slack"],
    installCount: 10,
    rating: 4.5,
    ratingCount: 2,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeApiWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: "wf-cloned",
    tenantId: "tenant-1",
    name: "My Slack Notifier",
    description: "Sends Slack alerts",
    nodes: [{ id: "n1", type: "slack", label: "Notify", position: { x: 0, y: 0 }, config: {} }],
    edges: [],
    variables: {},
    tags: ["from-template"],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as ApiWorkflow;
}

function makeIntegrationRepo(): jest.Mocked<IntegrationRepository> {
  return {
    listTemplates:    jest.fn(),
    findById:         jest.fn(),
    createTemplate:   jest.fn(),
    upsertTemplate:   jest.fn(),
    updateStatus:     jest.fn(),
    incrementInstalls: jest.fn(),
  } as unknown as jest.Mocked<IntegrationRepository>;
}

function makeWorkflowRepo(): jest.Mocked<WorkflowRepository> {
  return {
    findByIdApi: jest.fn(),
    create:      jest.fn(),
  } as unknown as jest.Mocked<WorkflowRepository>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("IntegrationService", () => {
  let integrationRepo: jest.Mocked<IntegrationRepository>;
  let workflowRepo: jest.Mocked<WorkflowRepository>;
  let service: IntegrationService;

  beforeEach(() => {
    integrationRepo = makeIntegrationRepo();
    workflowRepo    = makeWorkflowRepo();
    service = new IntegrationService(integrationRepo, workflowRepo);
  });

  // ── listTemplates ──────────────────────────────────────────────────────────

  it("listTemplates delegates to repo", async () => {
    const result = { items: [makeTemplate()], total: 1 };
    integrationRepo.listTemplates.mockResolvedValue(result);

    const query: ListTemplatesQuery = { category: "communication" };
    const out = await service.listTemplates(query);

    expect(integrationRepo.listTemplates).toHaveBeenCalledWith(query);
    expect(out).toBe(result);
  });

  it("listTemplates defaults to empty query", async () => {
    integrationRepo.listTemplates.mockResolvedValue({ items: [], total: 0 });

    await service.listTemplates();

    expect(integrationRepo.listTemplates).toHaveBeenCalledWith({});
  });

  // ── getTemplate ───────────────────────────────────────────────────────────

  it("getTemplate returns approved template", async () => {
    const tpl = makeTemplate();
    integrationRepo.findById.mockResolvedValue(tpl);

    const out = await service.getTemplate("tpl-1");

    expect(out).toBe(tpl);
  });

  it("getTemplate throws NotFoundError when template does not exist", async () => {
    integrationRepo.findById.mockResolvedValue(null);

    await expect(service.getTemplate("missing-id")).rejects.toThrow(NotFoundError);
  });

  it("getTemplate throws NotFoundError when template is not approved", async () => {
    integrationRepo.findById.mockResolvedValue(
      makeTemplate({ status: TemplateStatus.PENDING_REVIEW })
    );

    await expect(service.getTemplate("tpl-1")).rejects.toThrow(NotFoundError);
  });

  // ── installTemplate ───────────────────────────────────────────────────────

  it("installTemplate clones workflow and increments install count", async () => {
    const tpl     = makeTemplate();
    const cloned  = makeApiWorkflow();
    integrationRepo.findById.mockResolvedValue(tpl);
    workflowRepo.create.mockResolvedValue(cloned);
    integrationRepo.incrementInstalls.mockResolvedValue(undefined);

    const result = await service.installTemplate("tenant-1", "tpl-1", { workflowName: "My Copy" });

    expect(workflowRepo.create).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        name:   "My Copy",
        status: "draft",
        tags:   expect.arrayContaining(["from-template"]),
      })
    );
    expect(integrationRepo.incrementInstalls).toHaveBeenCalledWith("tpl-1");
    expect(result).toBe(cloned);
  });

  it("installTemplate uses template name when workflowName not provided", async () => {
    integrationRepo.findById.mockResolvedValue(makeTemplate());
    workflowRepo.create.mockResolvedValue(makeApiWorkflow());
    integrationRepo.incrementInstalls.mockResolvedValue(undefined);

    await service.installTemplate("tenant-1", "tpl-1");

    expect(workflowRepo.create).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ name: "Slack Notifier" })
    );
  });

  it("installTemplate throws NotFoundError when template not found", async () => {
    integrationRepo.findById.mockResolvedValue(null);

    await expect(
      service.installTemplate("tenant-1", "missing", {})
    ).rejects.toThrow(NotFoundError);
  });

  it("installTemplate throws ValidationError when template not approved", async () => {
    integrationRepo.findById.mockResolvedValue(
      makeTemplate({ status: TemplateStatus.PENDING_REVIEW })
    );

    await expect(
      service.installTemplate("tenant-1", "tpl-1", {})
    ).rejects.toThrow(ValidationError);
  });

  // ── publishTemplate ───────────────────────────────────────────────────────

  it("publishTemplate creates a pending_review template from an existing workflow", async () => {
    const workflow = makeApiWorkflow({
      nodes: [
        { id: "n1", type: "http", label: "Fetch", position: { x: 0, y: 0 }, config: {} } as never,
        { id: "n2", type: "slack", label: "Notify", position: { x: 0, y: 0 }, config: {} } as never,
      ],
    });
    workflowRepo.findByIdApi.mockResolvedValue(workflow);
    const created = makeTemplate({ status: TemplateStatus.PENDING_REVIEW });
    integrationRepo.createTemplate.mockResolvedValue(created);

    const result = await service.publishTemplate({
      name: "HTTP→Slack",
      description: "Fetch then notify",
      category: "integrations",
      tags: ["http", "slack"],
      workflowId: "wf-src",
      tenantId: "tenant-1",
      userId: "user-1",
      userDisplayName: "Alice",
    });

    expect(integrationRepo.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name:              "HTTP→Slack",
        status:            TemplateStatus.PENDING_REVIEW,
        isOfficial:        false,
        requiredNodeTypes: expect.arrayContaining(["http", "slack"]),
      })
    );
    expect(result).toBe(created);
  });

  it("publishTemplate throws NotFoundError when source workflow not found", async () => {
    workflowRepo.findByIdApi.mockResolvedValue(null);

    await expect(
      service.publishTemplate({
        name: "My Template",
        category: "integrations",
        workflowId: "bad-id",
        tenantId: "tenant-1",
        userId: "user-1",
        userDisplayName: "Alice",
      })
    ).rejects.toThrow(NotFoundError);
  });

  // ── approveTemplate / rejectTemplate ──────────────────────────────────────

  it("approveTemplate calls updateStatus with APPROVED", async () => {
    integrationRepo.updateStatus.mockResolvedValue(true);

    await service.approveTemplate("tpl-1");

    expect(integrationRepo.updateStatus).toHaveBeenCalledWith("tpl-1", TemplateStatus.APPROVED);
  });

  it("approveTemplate throws NotFoundError when template missing", async () => {
    integrationRepo.updateStatus.mockResolvedValue(false);

    await expect(service.approveTemplate("bad-id")).rejects.toThrow(NotFoundError);
  });

  it("rejectTemplate calls updateStatus with REJECTED", async () => {
    integrationRepo.updateStatus.mockResolvedValue(true);

    await service.rejectTemplate("tpl-1");

    expect(integrationRepo.updateStatus).toHaveBeenCalledWith("tpl-1", TemplateStatus.REJECTED);
  });

  it("rejectTemplate throws NotFoundError when template missing", async () => {
    integrationRepo.updateStatus.mockResolvedValue(false);

    await expect(service.rejectTemplate("bad-id")).rejects.toThrow(NotFoundError);
  });
});
