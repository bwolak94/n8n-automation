import type { Redis } from "ioredis";

/** TTL for branch-sync hashes in Redis (seconds). */
const BRANCH_TTL_SEC = 3600;

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IBranchSyncManager {
  registerBranch(
    executionId: string,
    mergeNodeId: string,
    branchIndex: number,
    data: unknown
  ): Promise<void>;
  getCount(executionId: string, mergeNodeId: string): Promise<number>;
  isComplete(
    executionId: string,
    mergeNodeId: string,
    inputCount: number
  ): Promise<boolean>;
  getAll(
    executionId: string,
    mergeNodeId: string,
    inputCount: number
  ): Promise<unknown[]>;
  cleanup(executionId: string, mergeNodeId: string): Promise<void>;
}

// ─── Redis-backed implementation ──────────────────────────────────────────────

export class BranchSyncManager implements IBranchSyncManager {
  constructor(private readonly redis: Redis) {}

  private key(executionId: string, mergeNodeId: string): string {
    return `exec:merge:${executionId}:${mergeNodeId}`;
  }

  async registerBranch(
    executionId: string,
    mergeNodeId: string,
    branchIndex: number,
    data: unknown
  ): Promise<void> {
    const key = this.key(executionId, mergeNodeId);
    await this.redis.hset(key, `b:${branchIndex}`, JSON.stringify(data));
    await this.redis.expire(key, BRANCH_TTL_SEC);
  }

  async getCount(executionId: string, mergeNodeId: string): Promise<number> {
    return this.redis.hlen(this.key(executionId, mergeNodeId));
  }

  async isComplete(
    executionId: string,
    mergeNodeId: string,
    inputCount: number
  ): Promise<boolean> {
    return (await this.getCount(executionId, mergeNodeId)) >= inputCount;
  }

  async getAll(
    executionId: string,
    mergeNodeId: string,
    inputCount: number
  ): Promise<unknown[]> {
    const key = this.key(executionId, mergeNodeId);
    const results: unknown[] = [];
    for (let i = 0; i < inputCount; i++) {
      const raw = await this.redis.hget(key, `b:${i}`);
      results.push(raw !== null ? (JSON.parse(raw) as unknown) : null);
    }
    return results;
  }

  async cleanup(executionId: string, mergeNodeId: string): Promise<void> {
    await this.redis.del(this.key(executionId, mergeNodeId));
  }
}

// ─── In-memory implementation (tests / single-process fallback) ───────────────

export class InMemoryBranchSyncManager implements IBranchSyncManager {
  private readonly store = new Map<string, Map<number, unknown>>();

  private storageKey(executionId: string, mergeNodeId: string): string {
    return `${executionId}:${mergeNodeId}`;
  }

  private bucket(executionId: string, mergeNodeId: string): Map<number, unknown> {
    const k = this.storageKey(executionId, mergeNodeId);
    if (!this.store.has(k)) this.store.set(k, new Map());
    return this.store.get(k)!;
  }

  async registerBranch(
    executionId: string,
    mergeNodeId: string,
    branchIndex: number,
    data: unknown
  ): Promise<void> {
    this.bucket(executionId, mergeNodeId).set(branchIndex, data);
  }

  async getCount(executionId: string, mergeNodeId: string): Promise<number> {
    return this.bucket(executionId, mergeNodeId).size;
  }

  async isComplete(
    executionId: string,
    mergeNodeId: string,
    inputCount: number
  ): Promise<boolean> {
    return this.bucket(executionId, mergeNodeId).size >= inputCount;
  }

  async getAll(
    executionId: string,
    mergeNodeId: string,
    inputCount: number
  ): Promise<unknown[]> {
    const bucket = this.bucket(executionId, mergeNodeId);
    return Array.from({ length: inputCount }, (_, i) => bucket.get(i) ?? null);
  }

  async cleanup(executionId: string, mergeNodeId: string): Promise<void> {
    this.store.delete(this.storageKey(executionId, mergeNodeId));
  }
}
