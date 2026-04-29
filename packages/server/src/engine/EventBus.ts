import type { NodeOutput } from "../nodes/contracts/INode.js";

export interface ExecutionStartedEvent {
  readonly executionId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly startedAt: Date;
}

export interface ExecutionCompletedEvent {
  readonly executionId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly completedAt: Date;
  readonly outputs: Record<string, NodeOutput>;
}

export interface ExecutionFailedEvent {
  readonly executionId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly failedAt: Date;
  readonly error: Error;
}

export interface StepStartedEvent {
  readonly executionId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly startedAt: Date;
}

export interface StepCompletedEvent {
  readonly executionId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly completedAt: Date;
  readonly output: NodeOutput;
}

export interface StepFailedEvent {
  readonly executionId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly failedAt: Date;
  readonly error: Error;
}

export interface EventMap {
  "execution.started": ExecutionStartedEvent;
  "execution.completed": ExecutionCompletedEvent;
  "execution.failed": ExecutionFailedEvent;
  "step.started": StepStartedEvent;
  "step.completed": StepCompletedEvent;
  "step.failed": StepFailedEvent;
}

export type EventType = keyof EventMap;

type EventHandler<T> = (event: T) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  on<K extends EventType>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler as EventHandler<unknown>);
  }

  off<K extends EventType>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler as EventHandler<unknown>);
    if (idx !== -1) list.splice(idx, 1);
  }

  async emit<K extends EventType>(
    event: K,
    payload: EventMap[K]
  ): Promise<void> {
    const list = this.handlers.get(event) ?? [];
    await Promise.all(list.map((handler) => handler(payload)));
  }
}
