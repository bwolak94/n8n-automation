import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  InMemoryBranchSyncManager,
  BranchSyncManager,
} from "../../engine/BranchSyncManager.js";
import type { IBranchSyncManager } from "../../engine/BranchSyncManager.js";
import type { Redis } from "ioredis";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal Redis mock backed by a plain JS Map (no ioredis dependency). */
function makeMockRedis(): Redis {
  const store = new Map<string, Map<string, string>>();

  function getHash(key: string): Map<string, string> {
    if (!store.has(key)) store.set(key, new Map());
    return store.get(key)!;
  }

  return {
    hset: async (key: string, field: string, value: string) => {
      getHash(key).set(field, value);
      return 1;
    },
    expire: async () => 1,
    hlen: async (key: string) => getHash(key).size,
    hget: async (key: string, field: string) => getHash(key).get(field) ?? null,
    del: async (key: string) => {
      store.delete(key);
      return 1;
    },
  } as unknown as Redis;
}

// ─── Shared behaviour tests (run against both implementations) ─────────────────

function runBehaviourSuite(label: string, factory: () => IBranchSyncManager): void {
  describe(label, () => {
    const EID = "exec-1";
    const MID = "merge-node-1";

    let mgr: IBranchSyncManager;

    beforeEach(() => {
      mgr = factory();
    });

    it("getCount returns 0 for unknown key", async () => {
      expect(await mgr.getCount(EID, MID)).toBe(0);
    });

    it("registers a branch and increments count", async () => {
      await mgr.registerBranch(EID, MID, 0, { a: 1 });
      expect(await mgr.getCount(EID, MID)).toBe(1);
    });

    it("2 of 3 branches registered → isComplete returns false", async () => {
      await mgr.registerBranch(EID, MID, 0, "first");
      await mgr.registerBranch(EID, MID, 1, "second");
      expect(await mgr.isComplete(EID, MID, 3)).toBe(false);
    });

    it("all 3 branches registered → isComplete returns true", async () => {
      await mgr.registerBranch(EID, MID, 0, "first");
      await mgr.registerBranch(EID, MID, 1, "second");
      await mgr.registerBranch(EID, MID, 2, "third");
      expect(await mgr.isComplete(EID, MID, 3)).toBe(true);
    });

    it("getAll returns data in branch index order", async () => {
      // Register out of order: 2, 0, 1
      await mgr.registerBranch(EID, MID, 2, "C");
      await mgr.registerBranch(EID, MID, 0, "A");
      await mgr.registerBranch(EID, MID, 1, "B");
      const all = await mgr.getAll(EID, MID, 3);
      expect(all).toEqual(["A", "B", "C"]);
    });

    it("getAll returns null for missing branch indices", async () => {
      await mgr.registerBranch(EID, MID, 0, "A");
      // Branch 1 missing
      const all = await mgr.getAll(EID, MID, 2);
      expect(all[0]).toBe("A");
      expect(all[1]).toBeNull();
    });

    it("cleanup removes all branch data", async () => {
      await mgr.registerBranch(EID, MID, 0, "A");
      await mgr.registerBranch(EID, MID, 1, "B");
      await mgr.cleanup(EID, MID);
      expect(await mgr.getCount(EID, MID)).toBe(0);
      expect(await mgr.isComplete(EID, MID, 2)).toBe(false);
    });

    it("isolates branches from different executionIds", async () => {
      await mgr.registerBranch("exec-1", MID, 0, "from-exec-1");
      await mgr.registerBranch("exec-2", MID, 0, "from-exec-2");
      expect(await mgr.getCount("exec-1", MID)).toBe(1);
      expect(await mgr.getCount("exec-2", MID)).toBe(1);
    });

    it("isolates branches from different mergeNodeIds", async () => {
      await mgr.registerBranch(EID, "merge-A", 0, "A");
      await mgr.registerBranch(EID, "merge-B", 0, "B");
      const allA = await mgr.getAll(EID, "merge-A", 1);
      expect(allA[0]).toBe("A");
    });

    it("handles complex object data round-trip", async () => {
      const payload = { users: [{ id: 1, name: "Alice" }], meta: { total: 1 } };
      await mgr.registerBranch(EID, MID, 0, payload);
      const all = await mgr.getAll(EID, MID, 1);
      expect(all[0]).toEqual(payload);
    });
  });
}

// ─── Run against both implementations ─────────────────────────────────────────

runBehaviourSuite("InMemoryBranchSyncManager", () => new InMemoryBranchSyncManager());
runBehaviourSuite("BranchSyncManager (Redis mock)", () => new BranchSyncManager(makeMockRedis()));
