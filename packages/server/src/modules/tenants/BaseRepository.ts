import type { FilterQuery, Model } from "mongoose";

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationOpts {
  limit: number;
  offset: number;
}

// ─── BaseRepository ───────────────────────────────────────────────────────────
//
// Architectural guarantee of tenant isolation: every find* method automatically
// scopes its query by tenantId. Concrete repositories extend this class and
// must NOT bypass the scoped helpers.
//
// Generic params:
//   TDoc    – the Mongoose lean document type (raw DB shape)
//   TEntity – the public domain entity type returned to callers

export abstract class BaseRepository<TDoc extends { tenantId: string }, TEntity> {
  protected abstract readonly model: Model<TDoc>;

  protected abstract toEntity(doc: TDoc): TEntity;

  // ─── Scoped filter builder ──────────────────────────────────────────────────
  // The single point where tenantId is injected — all find helpers call this.

  protected scopedFilter(
    tenantId: string,
    extra: FilterQuery<TDoc> = {}
  ): FilterQuery<TDoc> {
    return { tenantId, ...extra } as FilterQuery<TDoc>;
  }

  // ─── find helpers ──────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string): Promise<TEntity | null> {
    const doc = await (
      this.model.findOne(
        this.scopedFilter(tenantId, { _id: id } as FilterQuery<TDoc>)
      ) as unknown as { lean(): Promise<TDoc | null> }
    ).lean();

    return doc ? this.toEntity(doc) : null;
  }

  async findAll(
    tenantId: string,
    opts: PaginationOpts = { limit: 100, offset: 0 }
  ): Promise<TEntity[]> {
    const docs = await (
      this.model.find(this.scopedFilter(tenantId)) as unknown as {
        skip(n: number): unknown;
        limit(n: number): unknown;
        lean(): Promise<TDoc[]>;
      }
    )
      .skip(opts.offset)
      .limit(opts.limit)
      .lean();

    return docs.map((d) => this.toEntity(d));
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.model.countDocuments(
      this.scopedFilter(tenantId)
    ) as unknown as Promise<number>;
  }

  async existsById(id: string, tenantId: string): Promise<boolean> {
    const count = (await this.model.countDocuments(
      this.scopedFilter(tenantId, { _id: id } as FilterQuery<TDoc>)
    )) as unknown as number;
    return count > 0;
  }
}
