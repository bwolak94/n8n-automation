import type { EventBus } from "../engine/EventBus.js";
import type { ILokiLogger } from "./LokiLogger.js";
import type { IPrometheusMetrics } from "./PrometheusMetrics.js";

/**
 * ObservabilityService — subscribes to the engine EventBus and fans out to:
 *  - LokiLogger: structured log shipping to Loki
 *  - PrometheusMetrics: counters + histograms exposed at /metrics
 *
 * Single Responsibility: knows the EventBus contract and delegates everything else.
 * Dependency Inversion: depends on ILokiLogger + IPrometheusMetrics interfaces.
 */
export class ObservabilityService {
  // Tracks wall-clock start times so we can compute durations on completion
  private readonly executionStartTimes = new Map<string, number>();
  private readonly stepStartTimes = new Map<string, number>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly loki: ILokiLogger,
    private readonly metrics: IPrometheusMetrics
  ) {
    this.register();
  }

  private register(): void {
    this.eventBus.on("execution.started", (e) => {
      this.executionStartTimes.set(e.executionId, Date.now());

      this.loki.log("info", "execution.started", {
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
      }, {
        executionId: e.executionId,
        startedAt: e.startedAt.toISOString(),
      });

      this.metrics.recordExecutionStarted({
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
      });
    });

    this.eventBus.on("execution.completed", (e) => {
      const durationMs = this.popDuration(this.executionStartTimes, e.executionId);

      this.loki.log("info", "execution.completed", {
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
      }, {
        executionId: e.executionId,
        completedAt: e.completedAt.toISOString(),
        durationMs,
      });

      this.metrics.recordExecutionCompleted({
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        status: "completed",
        durationMs,
      });
    });

    this.eventBus.on("execution.failed", (e) => {
      const durationMs = this.popDuration(this.executionStartTimes, e.executionId);

      this.loki.log("error", "execution.failed", {
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
      }, {
        executionId: e.executionId,
        failedAt: e.failedAt.toISOString(),
        error: e.error.message,
        durationMs,
      });

      this.metrics.recordExecutionCompleted({
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        status: "failed",
        durationMs,
      });
    });

    this.eventBus.on("step.started", (e) => {
      const key = `${e.executionId}:${e.nodeId}`;
      this.stepStartTimes.set(key, Date.now());

      this.loki.log("info", "step.started", {
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        node_type: e.nodeType,
      }, {
        executionId: e.executionId,
        nodeId: e.nodeId,
        startedAt: e.startedAt.toISOString(),
      });
    });

    this.eventBus.on("step.completed", (e) => {
      const key = `${e.executionId}:${e.nodeId}`;
      const durationMs = this.popDuration(this.stepStartTimes, key);

      this.loki.log("info", "step.completed", {
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        node_type: e.nodeType,
      }, {
        executionId: e.executionId,
        nodeId: e.nodeId,
        completedAt: e.completedAt.toISOString(),
        durationMs,
      });

      this.metrics.recordNodeExecution({
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        node_type: e.nodeType,
        status: "completed",
        durationMs,
      });
    });

    this.eventBus.on("step.failed", (e) => {
      const key = `${e.executionId}:${e.nodeId}`;
      const durationMs = this.popDuration(this.stepStartTimes, key);

      this.loki.log("error", "step.failed", {
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        node_type: e.nodeType,
      }, {
        executionId: e.executionId,
        nodeId: e.nodeId,
        failedAt: e.failedAt.toISOString(),
        error: e.error.message,
        durationMs,
      });

      this.metrics.recordNodeExecution({
        tenant_id: e.tenantId,
        workflow_id: e.workflowId,
        node_type: e.nodeType,
        status: "failed",
        durationMs,
      });
    });
  }

  private popDuration(map: Map<string, number>, key: string): number {
    const start = map.get(key);
    map.delete(key);
    return start !== undefined ? Date.now() - start : 0;
  }
}
