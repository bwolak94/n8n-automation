-- =============================================================================
-- PostgreSQL initialisation script — runs once on first container boot.
-- Creates the execution log schema from PRD §8.2.
-- =============================================================================

-- Idempotent: safe to re-run (though Docker only runs this on a fresh volume)

CREATE TABLE IF NOT EXISTS executions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    VARCHAR(36)  NOT NULL,
  workflow_id  VARCHAR(36)  NOT NULL,
  status       VARCHAR(20)  NOT NULL,
  trigger      VARCHAR(20)  NOT NULL,
  trigger_data JSONB,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms  INTEGER,
  error                TEXT,
  parent_execution_id  UUID,
  resume_after         TIMESTAMPTZ,
  resume_data          JSONB,
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID         NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  node_id       VARCHAR(100) NOT NULL,
  node_type     VARCHAR(100) NOT NULL,
  status        VARCHAR(20)  NOT NULL,
  input         JSONB,
  output        JSONB,
  error         TEXT,
  attempt       INTEGER      DEFAULT 1,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   INTEGER,
  tokens_used   INTEGER
);

-- Indexes for common query patterns (tenant-scoped, time-range)
CREATE INDEX IF NOT EXISTS idx_executions_tenant_workflow
  ON executions(tenant_id, workflow_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_status
  ON executions(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_steps_execution_id
  ON execution_steps(execution_id);

-- Row Level Security — enforced at the application layer via tenantId filter,
-- but RLS adds a database-level safety net.
ALTER TABLE executions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_steps ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Audit logs — immutable append-only table.  No UPDATE or DELETE in app layer.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT      NOT NULL,
  actor_id    TEXT      NOT NULL,
  actor_email TEXT,
  ip_address  INET,
  user_agent  TEXT,
  event_type  TEXT      NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_created
  ON audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity
  ON audit_logs(tenant_id, entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
