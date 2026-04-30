import { describe, it, expect } from "vitest";
import {
  calculateSuccessRate,
  bucketExecutionsByDay,
  aggregateNodeTypes,
  formatDuration,
  lastNDays,
} from "../stats.js";
import type { ExecutionSummary } from "../../types/index.js";

// ─── calculateSuccessRate ──────────────────────────────────────────────────────

describe("calculateSuccessRate", () => {
  it("returns 0 when total is 0", () => {
    expect(calculateSuccessRate(0, 0)).toBe(0);
  });

  it("returns 100 when all succeed", () => {
    expect(calculateSuccessRate(10, 10)).toBe(100);
  });

  it("returns 50 for half success", () => {
    expect(calculateSuccessRate(5, 10)).toBe(50);
  });

  it("rounds to 1 decimal place", () => {
    expect(calculateSuccessRate(1, 3)).toBe(33.3);
  });

  it("handles success count of 0", () => {
    expect(calculateSuccessRate(0, 5)).toBe(0);
  });
});

// ─── bucketExecutionsByDay ─────────────────────────────────────────────────────

function makeExec(overrides: Partial<ExecutionSummary> = {}): ExecutionSummary {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    tenantId: "t-1",
    status: "completed",
    steps: [],
    startedAt: "2024-01-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("bucketExecutionsByDay", () => {
  it("returns empty array for no executions", () => {
    expect(bucketExecutionsByDay([])).toEqual([]);
  });

  it("counts completed executions as success", () => {
    const result = bucketExecutionsByDay([makeExec({ status: "completed", startedAt: "2024-01-15T10:00:00Z" })]);
    expect(result).toEqual([{ date: "2024-01-15", success: 1, failed: 0 }]);
  });

  it("counts failed executions", () => {
    const result = bucketExecutionsByDay([makeExec({ status: "failed", startedAt: "2024-01-15T10:00:00Z" })]);
    expect(result).toEqual([{ date: "2024-01-15", success: 0, failed: 1 }]);
  });

  it("ignores running/cancelled status for success/failed counts", () => {
    const result = bucketExecutionsByDay([makeExec({ status: "running", startedAt: "2024-01-15T10:00:00Z" })]);
    expect(result).toEqual([{ date: "2024-01-15", success: 0, failed: 0 }]);
  });

  it("groups multiple executions by day", () => {
    const executions = [
      makeExec({ id: "1", status: "completed", startedAt: "2024-01-15T08:00:00Z" }),
      makeExec({ id: "2", status: "completed", startedAt: "2024-01-15T12:00:00Z" }),
      makeExec({ id: "3", status: "failed", startedAt: "2024-01-15T20:00:00Z" }),
    ];
    const result = bucketExecutionsByDay(executions);
    expect(result).toEqual([{ date: "2024-01-15", success: 2, failed: 1 }]);
  });

  it("sorts results by date ascending", () => {
    const executions = [
      makeExec({ id: "1", status: "completed", startedAt: "2024-01-20T10:00:00Z" }),
      makeExec({ id: "2", status: "completed", startedAt: "2024-01-10T10:00:00Z" }),
    ];
    const result = bucketExecutionsByDay(executions);
    expect(result[0]!.date).toBe("2024-01-10");
    expect(result[1]!.date).toBe("2024-01-20");
  });
});

// ─── aggregateNodeTypes ────────────────────────────────────────────────────────

describe("aggregateNodeTypes", () => {
  it("returns empty array for no executions", () => {
    expect(aggregateNodeTypes([])).toEqual([]);
  });

  it("counts node types across steps", () => {
    const exec = makeExec({
      steps: [
        { id: "s1", executionId: "e1", nodeId: "n1", nodeType: "HttpRequest", status: "success", attempt: 1 },
        { id: "s2", executionId: "e1", nodeId: "n2", nodeType: "HttpRequest", status: "success", attempt: 1 },
        { id: "s3", executionId: "e1", nodeId: "n3", nodeType: "Email", status: "success", attempt: 1 },
      ],
    });
    const result = aggregateNodeTypes([exec]);
    const httpEntry = result.find((r) => r.type === "HttpRequest");
    const emailEntry = result.find((r) => r.type === "Email");
    expect(httpEntry?.count).toBe(2);
    expect(emailEntry?.count).toBe(1);
  });

  it("sorts by count descending", () => {
    const exec = makeExec({
      steps: [
        { id: "s1", executionId: "e1", nodeId: "n1", nodeType: "Email", status: "success", attempt: 1 },
        { id: "s2", executionId: "e1", nodeId: "n2", nodeType: "HttpRequest", status: "success", attempt: 1 },
        { id: "s3", executionId: "e1", nodeId: "n3", nodeType: "HttpRequest", status: "success", attempt: 1 },
        { id: "s4", executionId: "e1", nodeId: "n4", nodeType: "HttpRequest", status: "success", attempt: 1 },
      ],
    });
    const result = aggregateNodeTypes([exec]);
    expect(result[0]!.type).toBe("HttpRequest");
    expect(result[0]!.count).toBe(3);
  });

  it("aggregates across multiple executions", () => {
    const exec1 = makeExec({
      id: "e1",
      steps: [
        { id: "s1", executionId: "e1", nodeId: "n1", nodeType: "AiTransform", status: "success", attempt: 1 },
      ],
    });
    const exec2 = makeExec({
      id: "e2",
      steps: [
        { id: "s2", executionId: "e2", nodeId: "n1", nodeType: "AiTransform", status: "success", attempt: 1 },
      ],
    });
    const result = aggregateNodeTypes([exec1, exec2]);
    expect(result[0]!.count).toBe(2);
  });
});

// ─── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns em-dash for undefined", () => {
    expect(formatDuration(undefined)).toBe("—");
  });

  it("returns ms for values < 1000", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("returns seconds with 2 decimals for values >= 1000", () => {
    expect(formatDuration(1000)).toBe("1.00s");
    expect(formatDuration(2500)).toBe("2.50s");
    expect(formatDuration(10000)).toBe("10.00s");
  });
});

// ─── lastNDays ─────────────────────────────────────────────────────────────────

describe("lastNDays", () => {
  it("returns array of length n", () => {
    expect(lastNDays(7)).toHaveLength(7);
    expect(lastNDays(30)).toHaveLength(30);
  });

  it("returns strings in YYYY-MM-DD format", () => {
    const result = lastNDays(3);
    for (const d of result) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("ends with today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = lastNDays(5);
    expect(result[result.length - 1]).toBe(today);
  });

  it("returns dates in ascending order", () => {
    const result = lastNDays(5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]! > result[i - 1]!).toBe(true);
    }
  });
});
