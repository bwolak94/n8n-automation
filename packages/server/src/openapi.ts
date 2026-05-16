// OpenAPI 3.0 specification for Automation Hub API

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Automation Hub API",
    version: "1.0.0",
    description:
      "REST API for the Automation Hub visual workflow automation platform. " +
      "All protected endpoints require a Bearer JWT token and the X-Tenant-Id header.",
  },
  servers: [
    { url: "/", description: "Current host" },
  ],

  // ── Security scheme ─────────────────────────────────────────────────────────
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from POST /api/auth/login",
      },
    },

    // ── Shared parameters ────────────────────────────────────────────────────
    parameters: {
      TenantIdHeader: {
        name: "X-Tenant-Id",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Tenant identifier injected from JWT; must match the authenticated tenant.",
      },
      LimitQuery: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        description: "Maximum number of items to return.",
      },
      OffsetQuery: {
        name: "offset",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 0, default: 0 },
        description: "Number of items to skip.",
      },
    },

    // ── Reusable schemas ─────────────────────────────────────────────────────
    schemas: {
      // Auth
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "user@example.com" },
          password: { type: "string", minLength: 8, example: "s3cr3tP@ss" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password", "name"],
        properties: {
          email: { type: "string", format: "email", example: "newuser@example.com" },
          password: { type: "string", minLength: 8, example: "s3cr3tP@ss" },
          name: { type: "string", minLength: 1, example: "Alice Smith" },
        },
      },
      AuthResponse: {
        type: "object",
        required: ["token", "tenantId", "role"],
        properties: {
          token: { type: "string", description: "JWT access token" },
          tenantId: { type: "string", example: "tenant_01HXYZ" },
          role: {
            type: "string",
            enum: ["owner", "admin", "member"],
            example: "owner",
          },
        },
      },

      // Workflow
      WorkflowSummary: {
        type: "object",
        required: ["id", "name", "tenantId", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", example: "wf_01HXYZ" },
          name: { type: "string", example: "Daily Report" },
          description: { type: "string", example: "Sends a daily Slack report" },
          tenantId: { type: "string", example: "tenant_01HXYZ" },
          active: { type: "boolean", default: false },
          nodeCount: { type: "integer", example: 4 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateWorkflowRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, example: "Daily Report" },
          description: { type: "string", example: "Sends a daily Slack report" },
        },
      },
      UpdateWorkflowRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, example: "Updated Report" },
          description: { type: "string", example: "Updated description" },
          active: { type: "boolean" },
          nodes: {
            type: "array",
            items: { "$ref": "#/components/schemas/WorkflowNode" },
          },
          edges: {
            type: "array",
            items: { "$ref": "#/components/schemas/WorkflowEdge" },
          },
        },
      },
      WorkflowNode: {
        type: "object",
        required: ["id", "type", "position"],
        properties: {
          id: { type: "string", example: "node_1" },
          type: { type: "string", example: "http-request" },
          label: { type: "string", example: "Fetch Data" },
          position: {
            type: "object",
            required: ["x", "y"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
            },
          },
          config: {
            type: "object",
            additionalProperties: true,
            description: "Node-specific configuration values",
          },
        },
      },
      WorkflowEdge: {
        type: "object",
        required: ["id", "source", "target"],
        properties: {
          id: { type: "string", example: "edge_1" },
          source: { type: "string", example: "node_1" },
          target: { type: "string", example: "node_2" },
          sourceHandle: { type: "string" },
          targetHandle: { type: "string" },
        },
      },

      // Execution
      Execution: {
        type: "object",
        required: ["id", "workflowId", "tenantId", "status", "startedAt"],
        properties: {
          id: { type: "string", example: "exec_01HXYZ" },
          workflowId: { type: "string", example: "wf_01HXYZ" },
          tenantId: { type: "string", example: "tenant_01HXYZ" },
          status: {
            type: "string",
            enum: ["pending", "running", "success", "failed", "cancelled"],
            example: "success",
          },
          triggerData: {
            type: "object",
            additionalProperties: true,
            description: "Input data that triggered this execution",
          },
          error: {
            type: "string",
            nullable: true,
            description: "Error message if execution failed",
          },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", format: "date-time", nullable: true },
          durationMs: { type: "integer", example: 1340, nullable: true },
        },
      },
      ExecutionStep: {
        type: "object",
        required: ["id", "executionId", "nodeId", "status", "startedAt"],
        properties: {
          id: { type: "string", example: "step_01HXYZ" },
          executionId: { type: "string", example: "exec_01HXYZ" },
          nodeId: { type: "string", example: "node_1" },
          nodeType: { type: "string", example: "http-request" },
          status: {
            type: "string",
            enum: ["pending", "running", "success", "failed", "skipped"],
          },
          input: { type: "object", additionalProperties: true, nullable: true },
          output: { type: "object", additionalProperties: true, nullable: true },
          error: { type: "string", nullable: true },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", format: "date-time", nullable: true },
          durationMs: { type: "integer", nullable: true },
        },
      },

      // Node definition
      NodeDefinition: {
        type: "object",
        required: ["type", "name", "category"],
        properties: {
          type: { type: "string", example: "http-request" },
          name: { type: "string", example: "HTTP Request" },
          description: { type: "string", example: "Makes an HTTP request to a URL" },
          category: {
            type: "string",
            enum: ["trigger", "action", "transform", "condition", "ai"],
            example: "action",
          },
          icon: { type: "string", example: "globe" },
          inputs: {
            type: "array",
            items: { "$ref": "#/components/schemas/NodePort" },
          },
          outputs: {
            type: "array",
            items: { "$ref": "#/components/schemas/NodePort" },
          },
          configSchema: {
            type: "object",
            additionalProperties: true,
            description: "JSON Schema describing valid node configuration",
          },
        },
      },
      NodePort: {
        type: "object",
        required: ["id", "label"],
        properties: {
          id: { type: "string", example: "main" },
          label: { type: "string", example: "Main" },
          dataType: { type: "string", example: "any" },
        },
      },

      // Queue / DLQ
      DLQJob: {
        type: "object",
        required: ["jobId", "name", "failedReason", "timestamp"],
        properties: {
          jobId: { type: "string", example: "job_01HXYZ" },
          name: { type: "string", example: "workflow:execute" },
          data: { type: "object", additionalProperties: true },
          failedReason: { type: "string", example: "Connection timeout" },
          attemptsMade: { type: "integer", example: 3 },
          timestamp: { type: "integer", description: "Unix epoch ms", example: 1714389601000 },
          processedOn: { type: "integer", nullable: true },
          finishedOn: { type: "integer", nullable: true },
        },
      },
      DLQListResponse: {
        type: "object",
        required: ["jobs", "total"],
        properties: {
          jobs: {
            type: "array",
            items: { "$ref": "#/components/schemas/DLQJob" },
          },
          total: { type: "integer", example: 5 },
        },
      },

      // Pagination wrapper
      PaginatedWorkflows: {
        type: "object",
        required: ["items", "total", "limit", "offset"],
        properties: {
          items: {
            type: "array",
            items: { "$ref": "#/components/schemas/WorkflowSummary" },
          },
          total: { type: "integer", example: 42 },
          limit: { type: "integer", example: 20 },
          offset: { type: "integer", example: 0 },
        },
      },
      PaginatedExecutions: {
        type: "object",
        required: ["items", "total", "limit", "offset"],
        properties: {
          items: {
            type: "array",
            items: { "$ref": "#/components/schemas/Execution" },
          },
          total: { type: "integer", example: 100 },
          limit: { type: "integer", example: 20 },
          offset: { type: "integer", example: 0 },
        },
      },

      // Generic error
      ErrorResponse: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "string", example: "NotFound" },
          message: { type: "string", example: "Workflow not found" },
          statusCode: { type: "integer", example: 404 },
        },
      },

      // Health
      HealthResponse: {
        type: "object",
        required: ["status", "databases"],
        properties: {
          status: { type: "string", enum: ["ok"], example: "ok" },
          databases: {
            type: "object",
            required: ["mongo", "postgres"],
            properties: {
              mongo: { type: "string", enum: ["ok", "degraded"], example: "ok" },
              postgres: { type: "string", enum: ["ok", "degraded"], example: "ok" },
            },
          },
        },
      },
    },

    // ── Reusable responses ───────────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: "Missing or invalid JWT token",
        content: {
          "application/json": {
            schema: { "$ref": "#/components/schemas/ErrorResponse" },
            example: { error: "Unauthorized", message: "Invalid or expired token", statusCode: 401 },
          },
        },
      },
      Forbidden: {
        description: "Insufficient permissions or plan limit exceeded",
        content: {
          "application/json": {
            schema: { "$ref": "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { "$ref": "#/components/schemas/ErrorResponse" },
            example: { error: "NotFound", message: "Resource not found", statusCode: 404 },
          },
        },
      },
      ValidationError: {
        description: "Request body failed Zod validation",
        content: {
          "application/json": {
            schema: { "$ref": "#/components/schemas/ErrorResponse" },
            example: { error: "ValidationError", message: "email: Invalid email address", statusCode: 400 },
          },
        },
      },
    },
  },

  // ── Global security (overridden per-operation where public) ─────────────────
  security: [{ BearerAuth: [] as string[] }],

  // ── Tags ────────────────────────────────────────────────────────────────────
  tags: [
    { name: "auth", description: "Authentication — register, login, logout" },
    { name: "workflows", description: "Workflow CRUD and execution" },
    { name: "executions", description: "Execution history, logs, and cancellation" },
    { name: "nodes", description: "Available node types and their definitions" },
    { name: "queue", description: "BullMQ dead-letter queue management" },
    { name: "webhooks", description: "Inbound webhook triggers" },
  ],

  // ── Paths ───────────────────────────────────────────────────────────────────
  paths: {

    // ── Health ──────────────────────────────────────────────────────────────
    "/health": {
      get: {
        summary: "Health check",
        description: "Returns the liveness status of the server and its database connections.",
        operationId: "healthCheck",
        tags: ["auth"],
        security: [],
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },

    // ── Auth ────────────────────────────────────────────────────────────────
    "/api/auth/register": {
      post: {
        summary: "Register a new user",
        operationId: "authRegister",
        tags: ["auth"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "User created and JWT returned",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": { "$ref": "#/components/responses/ValidationError" },
          "409": {
            description: "Email already registered",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/auth/login": {
      post: {
        summary: "Login with email and password",
        operationId: "authLogin",
        tags: ["auth"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": { "$ref": "#/components/responses/ValidationError" },
          "401": { "$ref": "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/auth/logout": {
      post: {
        summary: "Logout (invalidate session / token)",
        operationId: "authLogout",
        tags: ["auth"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
        ],
        responses: {
          "204": { description: "Successfully logged out" },
          "401": { "$ref": "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Workflows ────────────────────────────────────────────────────────────
    "/api/workflows": {
      get: {
        summary: "List workflows for the current tenant",
        operationId: "listWorkflows",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          { "$ref": "#/components/parameters/LimitQuery" },
          { "$ref": "#/components/parameters/OffsetQuery" },
        ],
        responses: {
          "200": {
            description: "Paginated list of workflows",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/PaginatedWorkflows" },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
        },
      },
      post: {
        summary: "Create a new workflow",
        operationId: "createWorkflow",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/CreateWorkflowRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Workflow created",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/WorkflowSummary" },
              },
            },
          },
          "400": { "$ref": "#/components/responses/ValidationError" },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "402": { "$ref": "#/components/responses/Forbidden" },
        },
      },
    },

    "/api/workflows/{id}": {
      get: {
        summary: "Get a workflow by ID",
        operationId: "getWorkflow",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Workflow ID",
          },
        ],
        responses: {
          "200": {
            description: "Workflow details",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/WorkflowSummary" },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
      put: {
        summary: "Update a workflow",
        operationId: "updateWorkflow",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Workflow ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/UpdateWorkflowRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated workflow",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/WorkflowSummary" },
              },
            },
          },
          "400": { "$ref": "#/components/responses/ValidationError" },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
      delete: {
        summary: "Delete a workflow",
        operationId: "deleteWorkflow",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Workflow ID",
          },
        ],
        responses: {
          "204": { description: "Workflow deleted" },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    "/api/workflows/{id}/execute": {
      post: {
        summary: "Enqueue a workflow for execution",
        operationId: "executeWorkflow",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Workflow ID",
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  triggerData: {
                    type: "object",
                    additionalProperties: true,
                    description: "Optional data passed to the first node",
                  },
                },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Execution job enqueued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["jobId"],
                  properties: {
                    jobId: { type: "string", example: "job_01HXYZ" },
                  },
                },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "402": { "$ref": "#/components/responses/Forbidden" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    "/api/workflows/{id}/executions": {
      get: {
        summary: "List executions for a specific workflow",
        operationId: "listWorkflowExecutions",
        tags: ["workflows"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Workflow ID",
          },
          { "$ref": "#/components/parameters/LimitQuery" },
          { "$ref": "#/components/parameters/OffsetQuery" },
        ],
        responses: {
          "200": {
            description: "Paginated list of executions for the workflow",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/PaginatedExecutions" },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    // ── Executions ───────────────────────────────────────────────────────────
    "/api/executions/{id}": {
      get: {
        summary: "Get a single execution by ID",
        operationId: "getExecution",
        tags: ["executions"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Execution ID",
          },
        ],
        responses: {
          "200": {
            description: "Execution details including steps",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/Execution" },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    "/api/executions/{id}/logs": {
      get: {
        summary: "Stream execution logs via Server-Sent Events",
        operationId: "streamExecutionLogs",
        tags: ["executions"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Execution ID",
          },
        ],
        responses: {
          "200": {
            description: "SSE stream of execution log events",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description:
                    "Newline-delimited SSE events. Each `data:` field is a JSON-encoded ExecutionStep.",
                },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    "/api/executions/{id}/cancel": {
      post: {
        summary: "Request cancellation of a running execution",
        operationId: "cancelExecution",
        tags: ["executions"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Execution ID",
          },
        ],
        responses: {
          "200": {
            description: "Cancellation accepted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["cancelled"],
                  properties: {
                    cancelled: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
          "409": {
            description: "Execution is not in a cancellable state",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ── Nodes ────────────────────────────────────────────────────────────────
    "/api/nodes": {
      get: {
        summary: "List all available node types",
        operationId: "listNodes",
        tags: ["nodes"],
        security: [],
        responses: {
          "200": {
            description: "Array of node definitions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { "$ref": "#/components/schemas/NodeDefinition" },
                },
              },
            },
          },
        },
      },
    },

    "/api/nodes/{type}": {
      get: {
        summary: "Get a single node definition by type",
        operationId: "getNodeDefinition",
        tags: ["nodes"],
        security: [],
        parameters: [
          {
            name: "type",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Node type identifier, e.g. `http-request`",
            example: "http-request",
          },
        ],
        responses: {
          "200": {
            description: "Node definition",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/NodeDefinition" },
              },
            },
          },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    // ── Queue / DLQ ──────────────────────────────────────────────────────────
    "/api/queue/dlq": {
      get: {
        summary: "List all jobs currently in the dead-letter queue",
        operationId: "listDLQ",
        tags: ["queue"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
        ],
        responses: {
          "200": {
            description: "Dead-letter queue contents",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/DLQListResponse" },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/queue/dlq/{jobId}/retry": {
      post: {
        summary: "Re-enqueue a DLQ job for retry",
        operationId: "retryDLQJob",
        tags: ["queue"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "BullMQ job ID",
          },
        ],
        responses: {
          "200": {
            description: "Job successfully re-queued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["retried"],
                  properties: {
                    retried: { type: "boolean", example: true },
                    newJobId: { type: "string", example: "job_01HABC" },
                  },
                },
              },
            },
          },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    "/api/queue/dlq/{jobId}": {
      delete: {
        summary: "Remove a job from the dead-letter queue",
        operationId: "deleteDLQJob",
        tags: ["queue"],
        security: [{ BearerAuth: [] as string[] }],
        parameters: [
          { "$ref": "#/components/parameters/TenantIdHeader" },
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "BullMQ job ID",
          },
        ],
        responses: {
          "204": { description: "Job removed from DLQ" },
          "401": { "$ref": "#/components/responses/Unauthorized" },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },

    // ── Webhooks ─────────────────────────────────────────────────────────────
    "/api/webhooks/{workflowId}/{path}": {
      post: {
        summary: "Inbound webhook trigger for a workflow",
        description:
          "Receives an HTTP POST from an external service and enqueues the target workflow " +
          "with the request body as trigger data. No JWT authentication required; " +
          "the workflow must have a webhook trigger node configured.",
        operationId: "triggerWebhook",
        tags: ["webhooks"],
        security: [],
        parameters: [
          {
            name: "workflowId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID of the workflow that owns this webhook",
          },
          {
            name: "path",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Webhook path segment configured on the trigger node",
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
                description: "Arbitrary JSON payload forwarded as trigger data",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Webhook received and workflow enqueued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["received", "jobId"],
                  properties: {
                    received: { type: "boolean", example: true },
                    jobId: { type: "string", example: "job_01HXYZ" },
                  },
                },
              },
            },
          },
          "404": { "$ref": "#/components/responses/NotFound" },
        },
      },
    },
  },
} as const;
