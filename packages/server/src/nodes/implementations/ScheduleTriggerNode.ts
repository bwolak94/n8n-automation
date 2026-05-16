import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

/**
 * ScheduleTriggerNode — trigger-only node.
 * Provides the scheduled execution time as trigger data for downstream nodes.
 * execute() passes through whatever trigger data the scheduler injects
 * (e.g. { scheduledAt, cron, timezone }).
 */
export class ScheduleTriggerNode implements INode {
  readonly definition: NodeDefinition = {
    type: "schedule_trigger",
    name: "Schedule Trigger",
    description:
      "Triggers a workflow on a recurring schedule defined by a cron expression. " +
      "Trigger data is available via {{ $trigger.scheduledAt }}.",
    trigger: true,
    configSchema: {
      type: "object",
      properties: {
        cron: {
          type: "string",
          description: "Cron expression (e.g. '0 9 * * 1-5' for weekdays at 9am)",
        },
        timezone: {
          type: "string",
          description: "IANA timezone name (e.g. 'UTC', 'America/New_York')",
          default: "UTC",
        },
      },
    },
  };

  async execute(
    input: unknown,
    _config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const trigger = (input ?? {}) as Record<string, unknown>;
    return {
      data: {
        scheduledAt: trigger["scheduledAt"] ?? new Date().toISOString(),
        cron:        trigger["cron"] ?? null,
        timezone:    trigger["timezone"] ?? "UTC",
      },
    };
  }
}
