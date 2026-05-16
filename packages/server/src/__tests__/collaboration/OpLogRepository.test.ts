import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ─── Mongoose model mocks ─────────────────────────────────────────────────────

const mockFindOneAndUpdate = jest.fn();
const mockCreate = jest.fn();
const mockFind = jest.fn();
const mockFindOne = jest.fn();

jest.unstable_mockModule(
  "../../modules/collaboration/OpLog.model.js",
  () => ({
    CanvasOpModel: { create: mockCreate, find: mockFind },
    OpVersionModel: {
      findOneAndUpdate: mockFindOneAndUpdate,
      findOne: mockFindOne,
    },
  })
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MockFn = ReturnType<typeof jest.fn>;

function leanMock(value: unknown): { lean: MockFn } {
  return { lean: jest.fn().mockResolvedValue(value) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OpLogRepository", () => {
  let repo: Awaited<
    ReturnType<typeof import("../../modules/collaboration/OpLogRepository.js")>
  >["OpLogRepository"]["prototype"];

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import(
      "../../modules/collaboration/OpLogRepository.js"
    );
    repo = new mod.OpLogRepository();
  });

  describe("append", () => {
    it("calls $inc on OpVersionModel and creates a CanvasOp record", async () => {
      mockFindOneAndUpdate.mockReturnValue(leanMock({ version: 1 }));
      mockCreate.mockResolvedValue(undefined);

      const op = {
        type: "move_node" as const,
        nodeId: "n1",
        position: { x: 0, y: 0 },
      };

      const version = await repo.append("wf1", "t1", "u1", op);

      expect(version).toBe(1);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { workflowId: "wf1" },
        { $inc: { version: 1 } },
        { upsert: true, new: true }
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: "wf1", tenantId: "t1", userId: "u1", version: 1, op })
      );
    });

    it("returns monotonically incremented versions on successive calls", async () => {
      mockFindOneAndUpdate
        .mockReturnValueOnce(leanMock({ version: 1 }))
        .mockReturnValueOnce(leanMock({ version: 2 }));
      mockCreate.mockResolvedValue(undefined);

      const op = { type: "move_node" as const, nodeId: "n1", position: { x: 0, y: 0 } };

      const v1 = await repo.append("wf1", "t1", "u1", op);
      const v2 = await repo.append("wf1", "t1", "u2", op);

      expect(v1).toBe(1);
      expect(v2).toBe(2);
    });
  });

  describe("getState", () => {
    it("returns version 0 and empty ops when no data exists", async () => {
      mockFindOne.mockReturnValue(leanMock(null));
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const state = await repo.getState("wf1");

      expect(state.version).toBe(0);
      expect(state.ops).toHaveLength(0);
    });

    it("returns current version and last 50 ops", async () => {
      mockFindOne.mockReturnValue(leanMock({ version: 5 }));

      const rows = Array.from({ length: 3 }, (_, i) => ({
        version: i + 3,
        op: { type: "move_node", nodeId: `n${i}`, position: { x: i, y: 0 } },
      }));

      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(rows),
      });

      const state = await repo.getState("wf1");

      expect(state.version).toBe(5);
      expect(state.ops).toHaveLength(3);
      expect(state.ops[0]?.version).toBe(3);
    });

    it("passes correct sort and limit parameters", async () => {
      mockFindOne.mockReturnValue(leanMock({ version: 10 }));

      const sort = jest.fn().mockReturnThis();
      const limit = jest.fn().mockReturnThis();
      const lean = jest.fn().mockResolvedValue([]);
      mockFind.mockReturnValue({ sort, limit, lean });

      await repo.getState("wf-test");

      expect(mockFind).toHaveBeenCalledWith({ workflowId: "wf-test" });
      expect(sort).toHaveBeenCalledWith({ version: -1 });
      expect(limit).toHaveBeenCalledWith(50);
    });
  });
});
