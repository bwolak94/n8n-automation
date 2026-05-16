import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";

export interface IPrometheusMetrics {
  recordExecutionStarted(labels: { tenant_id: string; workflow_id: string }): void;
  recordExecutionCompleted(labels: {
    tenant_id: string;
    workflow_id: string;
    status: "completed" | "failed";
    durationMs: number;
  }): void;
  recordNodeExecution(labels: {
    tenant_id: string;
    workflow_id: string;
    node_type: string;
    status: "completed" | "failed";
    durationMs: number;
  }): void;
  getMetricsString(): Promise<string>;
  getContentType(): string;
}

export class PrometheusMetrics implements IPrometheusMetrics {
  private readonly registry: Registry;

  private readonly executionsTotal: Counter;
  private readonly executionDurationMs: Histogram;
  private readonly nodeExecutionsTotal: Counter;
  private readonly nodeExecutionDurationMs: Histogram;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({ register: this.registry });

    this.executionsTotal = new Counter({
      name: "workflow_executions_total",
      help: "Total number of workflow executions by status",
      labelNames: ["status", "tenant_id", "workflow_id"],
      registers: [this.registry],
    });

    this.executionDurationMs = new Histogram({
      name: "workflow_execution_duration_ms",
      help: "Workflow execution duration in milliseconds",
      labelNames: ["tenant_id", "workflow_id"],
      buckets: [100, 500, 1000, 2500, 5000, 10000, 30000, 60000],
      registers: [this.registry],
    });

    this.nodeExecutionsTotal = new Counter({
      name: "node_executions_total",
      help: "Total number of node executions by type and status",
      labelNames: ["node_type", "status", "tenant_id"],
      registers: [this.registry],
    });

    this.nodeExecutionDurationMs = new Histogram({
      name: "node_execution_duration_ms",
      help: "Node execution duration in milliseconds",
      labelNames: ["node_type", "tenant_id"],
      buckets: [10, 50, 100, 500, 1000, 5000, 15000],
      registers: [this.registry],
    });
  }

  recordExecutionStarted(labels: {
    tenant_id: string;
    workflow_id: string;
  }): void {
    this.executionsTotal.inc({ status: "started", ...labels });
  }

  recordExecutionCompleted(labels: {
    tenant_id: string;
    workflow_id: string;
    status: "completed" | "failed";
    durationMs: number;
  }): void {
    const { durationMs, ...counterLabels } = labels;
    this.executionsTotal.inc(counterLabels);
    this.executionDurationMs.observe(
      { tenant_id: labels.tenant_id, workflow_id: labels.workflow_id },
      durationMs
    );
  }

  recordNodeExecution(labels: {
    tenant_id: string;
    workflow_id: string;
    node_type: string;
    status: "completed" | "failed";
    durationMs: number;
  }): void {
    const { durationMs, workflow_id: _wf, ...nodeLabels } = labels;
    this.nodeExecutionsTotal.inc(nodeLabels);
    this.nodeExecutionDurationMs.observe(
      { node_type: labels.node_type, tenant_id: labels.tenant_id },
      durationMs
    );
  }

  async getMetricsString(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
