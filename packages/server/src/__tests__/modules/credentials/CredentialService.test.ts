import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { CredentialEncryption } from "../../../modules/credentials/CredentialEncryption.js";
import { CredentialService } from "../../../modules/credentials/CredentialService.js";
import type { CredentialRepository } from "../../../modules/credentials/CredentialRepository.js";

const MASTER_KEY = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

function makeRepo(): jest.Mocked<CredentialRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findAllByTenant: jest.fn(),
    findByName: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<CredentialRepository>;
}

const enc = new CredentialEncryption(MASTER_KEY);

function fakeRecord(overrides: Partial<{ id: string; name: string; type: string }> = {}) {
  const name = overrides.name ?? "stripe-key";
  const tenantId = "tenant-1";
  const data = { token: "sk_live_secret" };
  const encrypted = enc.encrypt(JSON.stringify(data), tenantId);
  return {
    id: overrides.id ?? "cred-1",
    tenantId,
    name,
    type: overrides.type ?? "bearer",
    encrypted,
    createdAt: new Date("2024-01-01"),
  };
}

describe("CredentialService", () => {
  let repo: jest.Mocked<CredentialRepository>;
  let service: CredentialService;

  beforeEach(() => {
    repo = makeRepo();
    service = new CredentialService(repo, enc);
    jest.clearAllMocks();
  });

  // ── createCredential ──────────────────────────────────────────────────────

  describe("createCredential", () => {
    it("encrypts data before persisting", async () => {
      const record = fakeRecord();
      (repo.create as jest.Mock).mockResolvedValue(record);

      await service.createCredential("tenant-1", {
        name: "stripe-key",
        type: "bearer",
        data: { token: "sk_live_secret" },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          name: "stripe-key",
          type: "bearer",
          encrypted: expect.objectContaining({ iv: expect.any(String) }),
        })
      );
    });

    it("returns a summary without data field", async () => {
      const record = fakeRecord();
      (repo.create as jest.Mock).mockResolvedValue(record);

      const result = await service.createCredential("tenant-1", {
        name: "stripe-key",
        type: "bearer",
        data: { token: "sk_live_secret" },
      });

      expect(result).toEqual({ id: "cred-1", name: "stripe-key", type: "bearer", createdAt: expect.any(Date) });
      expect(result).not.toHaveProperty("data");
      expect(result).not.toHaveProperty("encrypted");
    });
  });

  // ── listCredentials ───────────────────────────────────────────────────────

  describe("listCredentials", () => {
    it("returns summaries without decrypted data", async () => {
      (repo.findAllByTenant as jest.Mock).mockResolvedValue([fakeRecord(), fakeRecord({ id: "cred-2", name: "openai-key" })]);

      const items = await service.listCredentials("tenant-1");

      expect(items).toHaveLength(2);
      items.forEach((item) => {
        expect(item).not.toHaveProperty("data");
        expect(item).not.toHaveProperty("encrypted");
      });
    });
  });

  // ── getCredentialSummary ──────────────────────────────────────────────────

  describe("getCredentialSummary", () => {
    it("returns summary for valid id", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(fakeRecord());

      const result = await service.getCredentialSummary("tenant-1", "cred-1");

      expect(result.id).toBe("cred-1");
      expect(result).not.toHaveProperty("encrypted");
    });

    it("throws NotFoundError when credential does not exist", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getCredentialSummary("tenant-1", "missing")).rejects.toThrow(
        "Credential 'missing' not found"
      );
    });
  });

  // ── getCredentialData ─────────────────────────────────────────────────────

  describe("getCredentialData", () => {
    it("decrypts and returns raw data (engine use only)", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(fakeRecord());

      const data = await service.getCredentialData("tenant-1", "cred-1");

      expect(data).toEqual({ token: "sk_live_secret" });
    });

    it("throws NotFoundError when credential does not exist", async () => {
      (repo.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getCredentialData("tenant-1", "ghost")).rejects.toThrow(
        "Credential 'ghost' not found"
      );
    });
  });

  // ── updateCredential ──────────────────────────────────────────────────────

  describe("updateCredential", () => {
    it("re-encrypts when new data is provided", async () => {
      const record = fakeRecord({ name: "updated-name" });
      (repo.update as jest.Mock).mockResolvedValue(record);

      await service.updateCredential("tenant-1", "cred-1", {
        name: "updated-name",
        data: { token: "new-secret" },
      });

      const callArg = (repo.update as jest.Mock).mock.calls[0]?.[2] as Record<string, unknown>;
      expect(callArg).toHaveProperty("encrypted");
      expect(callArg).toHaveProperty("name", "updated-name");
    });

    it("does not include encrypted when only name changes", async () => {
      const record = fakeRecord({ name: "new-name" });
      (repo.update as jest.Mock).mockResolvedValue(record);

      await service.updateCredential("tenant-1", "cred-1", { name: "new-name" });

      const callArg = (repo.update as jest.Mock).mock.calls[0]?.[2] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty("encrypted");
    });
  });

  // ── deleteCredential ──────────────────────────────────────────────────────

  describe("deleteCredential", () => {
    it("delegates to repository", async () => {
      (repo.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteCredential("tenant-1", "cred-1");

      expect(repo.delete).toHaveBeenCalledWith("cred-1", "tenant-1");
    });
  });

  // ── resolveForExecution ───────────────────────────────────────────────────

  describe("resolveForExecution", () => {
    it("returns empty object when names array is empty", async () => {
      const result = await service.resolveForExecution("tenant-1", []);
      expect(result).toEqual({});
      expect(repo.findByName).not.toHaveBeenCalled();
    });

    it("resolves known credential names to decrypted data", async () => {
      (repo.findByName as jest.Mock).mockImplementation((name: unknown) => {
        if (name === "stripe-key") return Promise.resolve(fakeRecord({ name: "stripe-key" }));
        return Promise.resolve(null);
      });

      const result = await service.resolveForExecution("tenant-1", ["stripe-key", "unknown"]);

      expect(result["stripe-key"]).toEqual({ token: "sk_live_secret" });
      expect(result["unknown"]).toBeUndefined();
    });
  });
});
