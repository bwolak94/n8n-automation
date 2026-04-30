import type { DailyVolume, ExecutionSummary, NodeTypeUsage } from "../types/index.js";

// ─── Success rate ─────────────────────────────────────────────────────────────

export function calculateSuccessRate(successCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((successCount / totalCount) * 1000) / 10; // 1 decimal
}

// ─── Execution volume bucketing ───────────────────────────────────────────────

export function bucketExecutionsByDay(executions: ExecutionSummary[]): DailyVolume[] {
  const buckets = new Map<string, DailyVolume>();

  for (const exec of executions) {
    const day = exec.startedAt.slice(0, 10); // YYYY-MM-DD
    const existing = buckets.get(day) ?? { date: day, success: 0, failed: 0 };
    if (exec.status === "completed") {
      buckets.set(day, { ...existing, success: existing.success + 1 });
    } else if (exec.status === "failed") {
      buckets.set(day, { ...existing, failed: existing.failed + 1 });
    } else {
      buckets.set(day, existing);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Node type aggregation ────────────────────────────────────────────────────

export function aggregateNodeTypes(executions: ExecutionSummary[]): NodeTypeUsage[] {
  const counts = new Map<string, number>();

  for (const exec of executions) {
    for (const step of exec.steps) {
      counts.set(step.nodeType, (counts.get(step.nodeType) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Duration formatting ──────────────────────────────────────────────────────

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

// ─── Last N days date labels ──────────────────────────────────────────────────

export function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}
