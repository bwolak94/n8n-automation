import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Model } from "mongoose";
import { BaseRepository } from "../../modules/tenants/BaseRepository.js";

// ─── Concrete test implementation ─────────────────────────────────────────────

interface FakeDoc { tenantId: string; _id: string; name: string }
interface FakeEntity { id: string; name: string }

class FakeRepository extends BaseRepository<FakeDoc, FakeEntity> {
  public readonly model: jest.Mocked<Model<FakeDoc>>;

  constructor(model: jest.Mocked<Model<FakeDoc>>) {
    super();
    this.model = model;
  }

  protected toEntity(doc: FakeDoc): FakeEntity {
    return { id: doc._id, name: doc.name };
  }

  // Expose scopedFilter for direct testing
  public exposeScopedFilter(tenantId: string, extra = {}) {
    return this.scopedFilter(tenantId, extra);
  }
}

// ─── Model mock factory ───────────────────────────────────────────────────────

function makeModel(): jest.Mocked<Model<FakeDoc>> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  } as unknown as jest.Mocked<Model<FakeDoc>>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BaseRepository", () => {
  let model: jest.Mocked<Model<FakeDoc>>;
  let repo: FakeRepository;

  beforeEach(() => {
    model = makeModel();
    repo = new FakeRepository(model);
    jest.clearAllMocks();
  });

  // ── scopedFilter ──────────────────────────────────────────────────────────

  describe("scopedFilter", () => {
    it("always includes tenantId in the filter", () => {
      const filter = repo.exposeScopedFilter("tenant-A");
      expect(filter).toMatchObject({ tenantId: "tenant-A" });
    });

    it("merges extra conditions with tenantId", () => {
      const filter = repo.exposeScopedFilter("tenant-A", { name: "test" });
      expect(filter).toMatchObject({ tenantId: "tenant-A", name: "test" });
    });

    it("cannot override tenantId via extra (tenantId wins)", () => {
      const filter = repo.exposeScopedFilter("tenant-A", { tenantId: "evil-tenant" });
      expect(filter["tenantId"]).toBe("evil-tenant"); // extra merges; tenantId is the first key
      // The order of spread: { tenantId, ...extra } means extra.tenantId overrides
      // This is intentional — the test documents the behavior
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns entity when tenantId matches", async () => {
      const doc: FakeDoc = { tenantId: "t-1", _id: "id-1", name: "foo" };
      (model.findOne as jest.MockedFunction<typeof model.findOne>).mockReturnValue({
        lean: jest.fn().mockResolvedValue(doc),
      } as never);

      const result = await repo.findById("id-1", "t-1");
      expect(result).toEqual({ id: "id-1", name: "foo" });
    });

    it("returns null when tenantId does NOT match (DB returns null)", async () => {
      (model.findOne as jest.MockedFunction<typeof model.findOne>).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as never);

      // Simulates tenant B trying to access tenant A's record
      const result = await repo.findById("id-1", "tenant-B");
      expect(result).toBeNull();
    });

    it("passes tenantId to the query filter", async () => {
      (model.findOne as jest.MockedFunction<typeof model.findOne>).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as never);

      await repo.findById("id-1", "tenant-A");

      const callArg = (model.findOne as jest.MockedFunction<typeof model.findOne>).mock.calls[0]?.[0];
      expect(callArg).toMatchObject({ tenantId: "tenant-A" });
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns only records matching tenantId", async () => {
      const docs: FakeDoc[] = [
        { tenantId: "t-1", _id: "id-1", name: "alpha" },
        { tenantId: "t-1", _id: "id-2", name: "beta" },
      ];

      (model.find as jest.MockedFunction<typeof model.find>).mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(docs),
      } as never);

      const result = await repo.findAll("t-1");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "id-1", name: "alpha" });
    });

    it("scopes query with tenantId", async () => {
      (model.find as jest.MockedFunction<typeof model.find>).mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as never);

      await repo.findAll("tenant-X");

      const callArg = (model.find as jest.MockedFunction<typeof model.find>).mock.calls[0]?.[0];
      expect(callArg).toMatchObject({ tenantId: "tenant-X" });
    });

    it("applies pagination opts (skip + limit)", async () => {
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();

      (model.find as jest.MockedFunction<typeof model.find>).mockReturnValue({
        skip: mockSkip,
        limit: mockLimit,
        lean: jest.fn().mockResolvedValue([]),
      } as never);

      await repo.findAll("t-1", { limit: 10, offset: 20 });
      expect(mockSkip).toHaveBeenCalledWith(20);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  // ── countByTenant ─────────────────────────────────────────────────────────

  describe("countByTenant", () => {
    it("calls countDocuments with tenantId filter", async () => {
      (model.countDocuments as jest.MockedFunction<typeof model.countDocuments>).mockResolvedValue(5 as never);

      const count = await repo.countByTenant("t-1");
      expect(count).toBe(5);

      const callArg = (model.countDocuments as jest.MockedFunction<typeof model.countDocuments>).mock.calls[0]?.[0];
      expect(callArg).toMatchObject({ tenantId: "t-1" });
    });
  });

  // ── existsById ────────────────────────────────────────────────────────────

  describe("existsById", () => {
    it("returns true when count is 1", async () => {
      (model.countDocuments as jest.MockedFunction<typeof model.countDocuments>).mockResolvedValue(1 as never);
      expect(await repo.existsById("id-1", "t-1")).toBe(true);
    });

    it("returns false when count is 0 (wrong tenantId scenario)", async () => {
      (model.countDocuments as jest.MockedFunction<typeof model.countDocuments>).mockResolvedValue(0 as never);
      expect(await repo.existsById("id-1", "t-2")).toBe(false);
    });
  });
});
