import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { TemplateService } from "../../modules/templates/TemplateService.js";
import { NotFoundError, AppError } from "../../shared/errors/index.js";
import type { TemplateRepository, TemplateDoc, TemplateSummary } from "../../modules/templates/TemplateRepository.js";
import type { WorkflowService } from "../../modules/workflows/WorkflowService.js";
import type { ApiWorkflow } from "../../modules/workflows/WorkflowRepository.js";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<TemplateDoc> = {}): TemplateDoc {
  return {
    id:          "tmpl-1",
    name:        "GitHub Push Notification",
    description: "Notify on push",
    category:    "DevOps",
    nodes:       [],
    edges:       [],
    author:      "platform",
    tags:        ["devops", "github"],
    usageCount:  10,
    rating:      4.5,
    isPublic:    true,
    tenantId:    null,
    createdAt:   new Date("2024-01-01"),
    updatedAt:   new Date("2024-01-01"),
    ...overrides,
  };
}

function makeSummary(overrides: Partial<TemplateSummary> = {}): TemplateSummary {
  const { nodes: _n, edges: _e, ...rest } = makeTemplate(overrides);
  return rest;
}

function makeWorkflow(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id:          "wf-new",
    tenantId:    "tenant-1",
    name:        "GitHub Push Notification (copy)",
    description: "Notify on push",
    status:      "draft",
    nodes:       [],
    edges:       [],
    variables:   {},
    tags:        ["devops", "github"],
    createdAt:   new Date("2024-01-01"),
    updatedAt:   new Date("2024-01-01"),
    ...overrides,
  };
}

function makeTemplateRepo(
  overrides: Partial<TemplateRepository> = {}
): TemplateRepository {
  return {
    list:           jest.fn<TemplateRepository["list"]>(),
    getById:        jest.fn<TemplateRepository["getById"]>(),
    create:         jest.fn<TemplateRepository["create"]>(),
    incrementUsage: jest.fn<TemplateRepository["incrementUsage"]>().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as TemplateRepository;
}

function makeWorkflowService(
  overrides: Partial<WorkflowService> = {}
): WorkflowService {
  return {
    findById: jest.fn<WorkflowService["findById"]>(),
    findAll:  jest.fn<WorkflowService["findAll"]>(),
    create:   jest.fn<WorkflowService["create"]>(),
    update:   jest.fn<WorkflowService["update"]>(),
    softDelete: jest.fn<WorkflowService["softDelete"]>(),
    execute:  jest.fn<WorkflowService["execute"]>(),
    ...overrides,
  } as unknown as WorkflowService;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TemplateService", () => {
  let templateRepo: TemplateRepository;
  let workflowService: WorkflowService;
  let service: TemplateService;

  beforeEach(() => {
    templateRepo    = makeTemplateRepo();
    workflowService = makeWorkflowService();
    service         = new TemplateService(templateRepo, workflowService);
  });

  // ── listTemplates ──────────────────────────────────────────────────────────

  describe("listTemplates", () => {
    it("delegates to repo.list and wraps pagination", async () => {
      const summaries = [makeSummary()];
      (templateRepo.list as jest.Mock).mockResolvedValue({ items: summaries, total: 1 });

      const result = await service.listTemplates(
        { category: "DevOps" },
        "tenant-1",
        { limit: 20, offset: 0 }
      );

      expect(result.items).toEqual(summaries);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(templateRepo.list).toHaveBeenCalledWith(
        { category: "DevOps" },
        "tenant-1",
        { limit: 20, offset: 0 }
      );
    });

    it("passes search filter to repo", async () => {
      (templateRepo.list as jest.Mock).mockResolvedValue({ items: [], total: 0 });
      await service.listTemplates({ search: "github" }, "t-1", { limit: 20, offset: 0 });
      expect(templateRepo.list).toHaveBeenCalledWith(
        { search: "github" },
        "t-1",
        expect.any(Object)
      );
    });
  });

  // ── getTemplate ────────────────────────────────────────────────────────────

  describe("getTemplate", () => {
    it("returns template when found", async () => {
      const tmpl = makeTemplate();
      (templateRepo.getById as jest.Mock).mockResolvedValue(tmpl);
      const result = await service.getTemplate("tmpl-1");
      expect(result).toEqual(tmpl);
    });

    it("throws NotFoundError when not found", async () => {
      (templateRepo.getById as jest.Mock).mockResolvedValue(null);
      await expect(service.getTemplate("missing")).rejects.toThrow(NotFoundError);
    });
  });

  // ── cloneTemplate ──────────────────────────────────────────────────────────

  describe("cloneTemplate", () => {
    it("creates workflow from template nodes/edges", async () => {
      const tmpl = makeTemplate({
        nodes: [
          {
            id: "n1", type: "webhookTrigger", category: "triggers", label: "Trigger",
            position: { x: 0, y: 0 }, config: {},
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      });
      const wf = makeWorkflow();

      (templateRepo.getById as jest.Mock).mockResolvedValue(tmpl);
      (workflowService.create as jest.Mock).mockResolvedValue(wf);

      const result = await service.cloneTemplate("tmpl-1", "tenant-1", "user-1");

      expect(result.workflowId).toBe("wf-new");
      expect(result.name).toBe("GitHub Push Notification (copy)");
      expect(workflowService.create).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({ name: "GitHub Push Notification (copy)" })
      );
    });

    it("clears credential references from node configs", async () => {
      const tmpl = makeTemplate({
        nodes: [
          {
            id: "n1", type: "email", category: "communication", label: "Email",
            position: { x: 0, y: 0 },
            config: { apiKey: "$credentials.SENDGRID_KEY", subject: "Hello" },
          },
        ],
        edges: [],
      });
      const wf = makeWorkflow();

      (templateRepo.getById as jest.Mock).mockResolvedValue(tmpl);
      (workflowService.create as jest.Mock).mockResolvedValue(wf);

      await service.cloneTemplate("tmpl-1", "tenant-1", "user-1");

      const createCall = (workflowService.create as jest.Mock).mock.calls[0] as [string, { nodes: { config: Record<string, unknown> }[] }];
      const nodes = createCall[1].nodes;
      expect(nodes[0]!.config["apiKey"]).toBe("");
      expect(nodes[0]!.config["subject"]).toBe("Hello");
    });

    it("increments usage count after clone", async () => {
      const tmpl = makeTemplate();
      const wf   = makeWorkflow();
      (templateRepo.getById as jest.Mock).mockResolvedValue(tmpl);
      (workflowService.create as jest.Mock).mockResolvedValue(wf);
      (templateRepo.incrementUsage as jest.Mock).mockResolvedValue(undefined);

      await service.cloneTemplate("tmpl-1", "tenant-1", "user-1");

      // Allow fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 10));
      expect(templateRepo.incrementUsage).toHaveBeenCalledWith("tmpl-1");
    });

    it("throws NotFoundError when template does not exist", async () => {
      (templateRepo.getById as jest.Mock).mockResolvedValue(null);
      await expect(service.cloneTemplate("missing", "tenant-1", "u-1"))
        .rejects.toThrow(NotFoundError);
    });

    it("throws AppError when trying to clone another tenant's private template", async () => {
      const tmpl = makeTemplate({ isPublic: false, tenantId: "other-tenant" });
      (templateRepo.getById as jest.Mock).mockResolvedValue(tmpl);

      await expect(service.cloneTemplate("tmpl-1", "tenant-1", "u-1"))
        .rejects.toThrow(AppError);
    });

    it("allows cloning own private template", async () => {
      const tmpl = makeTemplate({ isPublic: false, tenantId: "tenant-1" });
      const wf   = makeWorkflow();
      (templateRepo.getById as jest.Mock).mockResolvedValue(tmpl);
      (workflowService.create as jest.Mock).mockResolvedValue(wf);

      const result = await service.cloneTemplate("tmpl-1", "tenant-1", "u-1");
      expect(result.workflowId).toBe("wf-new");
    });
  });

  // ── publishWorkflowAsTemplate ──────────────────────────────────────────────

  describe("publishWorkflowAsTemplate", () => {
    it("creates template from workflow data", async () => {
      const wf   = makeWorkflow({ name: "My Workflow", nodes: [], edges: [] });
      const tmpl = makeTemplate({ tenantId: "tenant-1", isPublic: false });

      (workflowService.findById as jest.Mock).mockResolvedValue(wf);
      (templateRepo.create as jest.Mock).mockResolvedValue(tmpl);

      const result = await service.publishWorkflowAsTemplate(
        "wf-1",
        "tenant-1",
        "user-1",
        { category: "DevOps", tags: ["test"], isPublic: false }
      );

      expect(result.tenantId).toBe("tenant-1");
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "DevOps",
          tenantId: "tenant-1",
          isPublic: false,
          author:   "user-1",
        })
      );
    });

    it("clears credential refs when publishing", async () => {
      const wf = makeWorkflow({
        nodes: [
          {
            id: "n1", type: "database", category: "actions", label: "DB",
            position: { x: 0, y: 0 },
            config: { credentialId: "$credentials.DB_CRED", dialect: "postgres" },
          },
        ],
        edges: [],
      });
      const tmpl = makeTemplate();

      (workflowService.findById as jest.Mock).mockResolvedValue(wf);
      (templateRepo.create as jest.Mock).mockResolvedValue(tmpl);

      await service.publishWorkflowAsTemplate("wf-1", "tenant-1", "user-1", { category: "Data Processing" });

      const createCall = (templateRepo.create as jest.Mock).mock.calls[0] as [{ nodes: { config: Record<string, unknown> }[] }];
      expect(createCall[0].nodes[0]!.config["credentialId"]).toBe("");
    });
  });
});
