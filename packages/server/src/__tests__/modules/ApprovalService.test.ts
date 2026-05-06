import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ApprovalService, ApprovalExpiredError, ApprovalAlreadyDecidedError } from "../../modules/approvals/ApprovalService.js";
import type { ApprovalRepository, Approval } from "../../modules/approvals/ApprovalRepository.js";
import type { IResumableQueue } from "../../engine/WorkflowRunner.js";
import type { IApprovalNotifier } from "../../modules/approvals/ApprovalService.js";
import type { ApprovalNodeConfig } from "@automation-hub/shared";
import jwt from "jsonwebtoken";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret-super-long-string-32ch";

function makeConfig(overrides: Partial<ApprovalNodeConfig> = {}): ApprovalNodeConfig {
  return {
    reviewers:           ["alice@example.com", "bob@example.com"],
    notificationChannel: "email",
    message:             "Please review",
    timeoutHours:        24,
    timeoutAction:       "reject",
    requireAll:          false,
    ...overrides,
  };
}

function makeApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id:            "appr-1",
    executionId:   "exec-1",
    nodeId:        "node-1",
    tenantId:      "tenant-1",
    status:        "pending",
    reviewers:     ["alice@example.com", "bob@example.com"],
    decisions:     [],
    requireAll:    false,
    timeoutAction: "reject",
    tokenHash:     "hash-abc",
    expiresAt:     new Date(Date.now() + 86_400_000),
    createdAt:     new Date(),
    ...overrides,
  };
}

function signToken(approvalId: string, decision: "approved" | "rejected", reviewer: string): string {
  return jwt.sign(
    { approvalId, decision, reviewer, type: "approval" },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

function makeRepo(overrides: Partial<ApprovalRepository> = {}): ApprovalRepository {
  return {
    create:                     jest.fn<ApprovalRepository["create"]>().mockResolvedValue(makeApproval()),
    findById:                   jest.fn<ApprovalRepository["findById"]>().mockResolvedValue(makeApproval()),
    findByExecutionId:          jest.fn<ApprovalRepository["findByExecutionId"]>().mockResolvedValue([]),
    update:                     jest.fn<ApprovalRepository["update"]>().mockResolvedValue(undefined),
    patchSuspendedNodeOutput:   jest.fn<ApprovalRepository["patchSuspendedNodeOutput"]>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeQueue(): IResumableQueue {
  return { enqueueResume: jest.fn<IResumableQueue["enqueueResume"]>().mockResolvedValue("job-1") };
}

function makeNotifier(): IApprovalNotifier {
  return { notify: jest.fn<IApprovalNotifier["notify"]>().mockResolvedValue(undefined) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ApprovalService", () => {
  let repo: ApprovalRepository;
  let queue: IResumableQueue;
  let notifier: IApprovalNotifier;
  let service: ApprovalService;

  beforeEach(() => {
    repo     = makeRepo();
    queue    = makeQueue();
    notifier = makeNotifier();
    service  = new ApprovalService(repo, queue, notifier);
  });

  // ── createApproval ─────────────────────────────────────────────────────────

  describe("createApproval()", () => {
    it("creates an approval record in the DB", async () => {
      const config = makeConfig({ reviewers: ["alice@example.com"] });
      await service.createApproval({ executionId: "exec-1", nodeId: "node-1", tenantId: "t-1", config });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: "exec-1",
          nodeId:      "node-1",
          tenantId:    "t-1",
          reviewers:   ["alice@example.com"],
          requireAll:  false,
          timeoutAction: "reject",
        })
      );
    });

    it("returns the approval id", async () => {
      (repo.create as jest.Mock).mockResolvedValue(makeApproval({ id: "appr-xyz" }));
      const result = await service.createApproval({
        executionId: "e1", nodeId: "n1", tenantId: "t1",
        config: makeConfig({ reviewers: ["reviewer@example.com"] }),
      });
      expect(result.id).toBe("appr-xyz");
    });

    it("sends notifications to all reviewers", async () => {
      const config = makeConfig({ reviewers: ["alice@example.com", "bob@example.com"] });
      await service.createApproval({ executionId: "e1", nodeId: "n1", tenantId: "t1", config });

      expect(notifier.notify).toHaveBeenCalledTimes(2);
      const calls = (notifier.notify as jest.Mock).mock.calls;
      const tos   = calls.map((c) => (c[0] as { to: string }).to);
      expect(tos).toContain("alice@example.com");
      expect(tos).toContain("bob@example.com");
    });

    it("notification includes approveUrl and rejectUrl", async () => {
      const config = makeConfig({ reviewers: ["alice@example.com"] });
      await service.createApproval({ executionId: "e1", nodeId: "n1", tenantId: "t1", config });

      const [call] = (notifier.notify as jest.Mock).mock.calls as [{ approveUrl: string; rejectUrl: string }][];
      expect(call[0].approveUrl).toContain("/approval/");
      expect(call[0].rejectUrl).toContain("/approval/");
    });

    it("does not throw if notifier is not configured", async () => {
      const serviceNoNotifier = new ApprovalService(repo, queue);
      await expect(
        serviceNoNotifier.createApproval({ executionId: "e1", nodeId: "n1", tenantId: "t1", config: makeConfig() })
      ).resolves.toBeDefined();
    });
  });

  // ── decide() ───────────────────────────────────────────────────────────────

  describe("decide()", () => {
    it("approve: updates status to approved (OR mode — first decision wins)", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval({ requireAll: false }));

      const result = await service.decide("appr-1", token);

      expect(result.finalDecision).toBe("approved");
      expect(repo.update).toHaveBeenCalledWith(
        "appr-1",
        expect.objectContaining({ status: "approved" })
      );
    });

    it("reject: updates status to rejected (any rejection = final)", async () => {
      const token = signToken("appr-1", "rejected", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval());

      const result = await service.decide("appr-1", token);

      expect(result.finalDecision).toBe("rejected");
      expect(repo.update).toHaveBeenCalledWith(
        "appr-1",
        expect.objectContaining({ status: "rejected" })
      );
    });

    it("on final decision: patches suspended node output with _branch", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval({ requireAll: false }));

      await service.decide("appr-1", token);

      expect(repo.patchSuspendedNodeOutput).toHaveBeenCalledWith(
        "exec-1",
        "node-1",
        expect.objectContaining({ data: expect.objectContaining({ _branch: 0, approved: true }) })
      );
    });

    it("on final decision: enqueues resume job", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval({ requireAll: false }));

      await service.decide("appr-1", token);

      expect(queue.enqueueResume).toHaveBeenCalledWith("exec-1", "tenant-1", 0);
    });

    it("throws ApprovalExpiredError when approval.expiresAt is in the past", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({ expiresAt: new Date(Date.now() - 1000) })
      );

      await expect(service.decide("appr-1", token)).rejects.toBeInstanceOf(ApprovalExpiredError);
    });

    it("throws ApprovalExpiredError for expired JWT", async () => {
      const expired = jwt.sign(
        { approvalId: "appr-1", decision: "approved", reviewer: "a@b.com", type: "approval" },
        JWT_SECRET,
        { expiresIn: "-1s" }
      );
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval());

      await expect(service.decide("appr-1", expired)).rejects.toBeInstanceOf(ApprovalExpiredError);
    });

    it("throws ApprovalAlreadyDecidedError when status is not pending", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval({ status: "approved" }));

      await expect(service.decide("appr-1", token)).rejects.toBeInstanceOf(ApprovalAlreadyDecidedError);
    });

    it("AND mode: 1/2 approved → returns pending, does NOT call patchSuspendedNodeOutput", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({ requireAll: true, reviewers: ["alice@example.com", "bob@example.com"] })
      );

      const result = await service.decide("appr-1", token);

      expect(result.finalDecision).toBe("pending");
      expect(repo.patchSuspendedNodeOutput).not.toHaveBeenCalled();
      expect(queue.enqueueResume).not.toHaveBeenCalled();
    });

    it("AND mode: 2/2 approved → returns approved", async () => {
      const token = signToken("appr-1", "approved", "bob@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({
          requireAll: true,
          reviewers: ["alice@example.com", "bob@example.com"],
          decisions: [
            { reviewer: "alice@example.com", decision: "approved", decidedAt: new Date().toISOString() },
          ],
        })
      );

      const result = await service.decide("appr-1", token);

      expect(result.finalDecision).toBe("approved");
      expect(repo.patchSuspendedNodeOutput).toHaveBeenCalled();
    });

    it("AND mode: any rejection → immediately rejected", async () => {
      const token = signToken("appr-1", "rejected", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({ requireAll: true, reviewers: ["alice@example.com", "bob@example.com"] })
      );

      const result = await service.decide("appr-1", token);

      expect(result.finalDecision).toBe("rejected");
      expect(repo.patchSuspendedNodeOutput).toHaveBeenCalledWith(
        "exec-1",
        "node-1",
        expect.objectContaining({ data: expect.objectContaining({ _branch: 1, approved: false }) })
      );
    });

    it("AND mode: same reviewer cannot vote twice", async () => {
      const token = signToken("appr-1", "approved", "alice@example.com");
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({
          requireAll: true,
          reviewers: ["alice@example.com", "bob@example.com"],
          decisions: [
            { reviewer: "alice@example.com", decision: "approved", decidedAt: new Date().toISOString() },
          ],
        })
      );

      await expect(service.decide("appr-1", token)).rejects.toBeInstanceOf(ApprovalAlreadyDecidedError);
    });
  });

  // ── expireApproval() ───────────────────────────────────────────────────────

  describe("expireApproval()", () => {
    it("sets status to expired and enqueues resume with rejection branch", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({ status: "pending", timeoutAction: "reject" })
      );

      await service.expireApproval("appr-1");

      expect(repo.update).toHaveBeenCalledWith(
        "appr-1",
        expect.objectContaining({ status: "expired" })
      );
      expect(repo.patchSuspendedNodeOutput).toHaveBeenCalledWith(
        "exec-1",
        "node-1",
        expect.objectContaining({ data: expect.objectContaining({ _branch: 1 }) })
      );
      expect(queue.enqueueResume).toHaveBeenCalledWith("exec-1", "tenant-1", 0);
    });

    it("timeoutAction=approve: patches with approved branch", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(
        makeApproval({ status: "pending", timeoutAction: "approve" })
      );

      await service.expireApproval("appr-1");

      expect(repo.patchSuspendedNodeOutput).toHaveBeenCalledWith(
        "exec-1",
        "node-1",
        expect.objectContaining({ data: expect.objectContaining({ _branch: 0, approved: true }) })
      );
    });

    it("is a no-op when approval is already decided", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(makeApproval({ status: "approved" }));

      await service.expireApproval("appr-1");

      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
