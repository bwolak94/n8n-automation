// =============================================================================
// MongoDB initialisation script — runs once on first container boot.
// Creates tenantId indexes on all collections (PRD §8.1).
// =============================================================================

// Switch to (or create) the automation_hub database
db = db.getSiblingDB("automation_hub");

// ── Workflows collection ──────────────────────────────────────────────────────
db.workflows.createIndex({ tenantId: 1 }, { background: true });
db.workflows.createIndex({ tenantId: 1, status: 1 }, { background: true });
db.workflows.createIndex(
  { tenantId: 1, updatedAt: -1 },
  { background: true }
);
// Soft-delete support
db.workflows.createIndex(
  { tenantId: 1, deletedAt: 1 },
  { background: true, sparse: true }
);

// ── TenantMembers collection ──────────────────────────────────────────────────
db.tenantmembers.createIndex({ tenantId: 1 }, { background: true });
db.tenantmembers.createIndex(
  { tenantId: 1, userId: 1 },
  { background: true, unique: true }
);
db.tenantmembers.createIndex({ userId: 1 }, { background: true });

// ── Tenants collection ────────────────────────────────────────────────────────
db.tenants.createIndex({ slug: 1 }, { background: true, unique: true });
db.tenants.createIndex(
  { stripeCustomerId: 1 },
  { background: true, sparse: true }
);

// ── Marketplace packages collection ──────────────────────────────────────────
db.marketplacepackages.createIndex({ name: 1 }, { background: true });
db.marketplacepackages.createIndex({ tenantId: 1 }, { background: true });

// ── Schedules collection ──────────────────────────────────────────────────────
db.schedules.createIndex({ tenantId: 1 }, { background: true });
db.schedules.createIndex(
  { tenantId: 1, workflowId: 1 },
  { background: true }
);

print("MongoDB initialisation complete — indexes created.");
