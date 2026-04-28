# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Automation Hub** — a visual workflow automation platform built from scratch. Users design automation workflows on a drag-and-drop canvas connecting nodes (HTTP requests, AI transforms, email, conditions, etc.). Self-hostable via Docker Compose. See `docs/prd.md` for full specification.

> This is NOT an n8n wrapper. It is a from-scratch workflow engine demonstrating event-driven execution, a custom node system, production retry strategies with dead-letter queues, and a dual-database design.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend canvas | Vue 3 + Vue Flow |
| Frontend state | Pinia + Vue Query |
| UI components | Tailwind CSS + Radix Vue |
| Forms | VeeValidate + Zod |
| Backend | Node.js 20 + Express 4 + TypeScript 5 (strict) |
| Workflow storage | MongoDB 7 |
| Execution logs | PostgreSQL 16 |
| Job queue | BullMQ + Redis 7 |
| AI integration | Anthropic Claude API |
| Real-time | Socket.io |
| Billing | Stripe |
| Containerization | Docker + Docker Compose + Nginx |

## Monorepo Structure

```
automation-hub/
├── packages/
│   ├── shared/          # Zod schemas + TypeScript types shared between client/server
│   │   └── src/
│   │       ├── schemas/ # workflow, node, execution, tenant, billing, marketplace
│   │       ├── types/   # inferred from Zod schemas
│   │       └── constants/
│   ├── server/
│   │   └── src/
│   │       ├── config/       # env.ts, database.ts, redis.ts
│   │       ├── engine/       # WorkflowRunner, NodeExecutor, RetryManager, TopologicalSorter, EventBus
│   │       ├── nodes/
│   │       │   ├── contracts/INode.ts
│   │       │   ├── NodeRegistry.ts
│   │       │   └── implementations/
│   │       ├── modules/      # workflows, executions, auth, tenants, billing, marketplace, collaboration
│   │       ├── jobs/         # queues, workers, scheduler.ts
│   │       ├── shared/       # errors, middleware, utils
│   │       ├── app.ts
│   │       └── server.ts
│   └── client/
│       └── src/
│           ├── features/     # canvas, palette, execution, scheduler, billing, marketplace, settings
│           └── shared/       # components, stores (canvas/execution/ui/tenant/collaboration), api, i18n
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Start all services (dev mode)
pnpm dev                          # via turbo
pnpm --filter server dev
pnpm --filter client dev

# Build
pnpm build                        # builds all packages via turbo

# Testing
pnpm --filter server test         # Jest + Supertest
pnpm --filter server test -- --testPathPattern=WorkflowRunner  # single test file
pnpm --filter client test         # Vitest + Testing Library
pnpm test:e2e                     # Playwright

# Docker
docker compose up                 # starts all services (Mongo, Postgres, Redis, Nginx, server, client)
docker compose up --build         # rebuild images
```

## Architecture — Key Concepts

### Layered Architecture (no layer skipping)
```
UI (Vue SPA) → API (Express controllers) → Services → Engine / Repositories → Databases
```
- Controllers validate with Zod, delegate to services
- Services never import Mongoose or pg directly — only through repositories
- Engine (WorkflowRunner) never accesses DB directly

### Workflow Execution Flow
1. `WorkflowRunner` receives a workflow + trigger data
2. `TopologicalSorter` (Kahn's algorithm) produces parallel execution groups from the DAG
3. Groups execute via `Promise.allSettled` — independent branches run in parallel
4. `NodeExecutor` resolves template expressions (`{{nodes.x.data.field}}`), then calls `INode.execute()`
5. `RetryManager` handles retries with exponential/linear/fixed backoff; failures go to BullMQ DLQ
6. `EventBus` decouples logging, webhooks, and Socket.io updates from execution logic

### Adding a New Node Type
1. Create `packages/server/src/nodes/implementations/YourNode.ts` implementing `INode`
2. Register in `NodeRegistry` in `packages/server/src/app.ts`
3. Create Vue component in `packages/client/src/features/canvas/nodes/`

### INode Interface (core contract)
```typescript
interface INode {
  readonly definition: NodeDefinition
  execute(input: unknown, config: Record<string, unknown>, context: ExecutionContext): Promise<NodeOutput>
}
// ExecutionContext always includes tenantId — enforces data isolation
```

### Dual Database Design
- **MongoDB** — workflow definitions (JSON trees, schema-less, fits variable node configs)
- **PostgreSQL** — execution logs (`executions` + `execution_steps` tables, append-only, time-range queries)

### Multi-tenancy
Every DB query is scoped by `tenantId`. The `tenantContext` middleware injects tenant from JWT. The `planGuard` middleware enforces subscription limits.

## Key Design Patterns

| Pattern | Location |
|---|---|
| Strategy | `AIProviderInterface` — swap Claude/OpenAI without touching business logic |
| Registry | `NodeRegistry` — add node types with zero changes to orchestrator |
| Command | `INode.execute()` — each node encapsulates its own logic |
| Observer | `EventBus` in `WorkflowRunner` |
| Repository | `WorkflowRepository`, `ExecutionLogRepository` |
| DTO | Zod-inferred types from `packages/shared` — single schema validates both sides |

## Coding Standards

- TypeScript strict mode (`strict: true`) — no `any`, use `unknown` with runtime checks
- Prefer interfaces over types for object definitions
- Early returns / guard clauses over nested if-else
- Functional, immutable style unless it becomes much more verbose
- Zod for all input validation at system boundaries (API routes, external data)
- All new DB tables require Row Level Security (RLS) enabled
