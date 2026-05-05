import { randomUUID } from "crypto";
import type { ExecutionContext, NodeOutput } from "../nodes/contracts/INode.js";
import type { NodeExecutor } from "./NodeExecutor.js";
import type { TopologicalSorter } from "./TopologicalSorter.js";
import type {
  IWorkflowRepository,
  ExpressionContext,
  WorkflowEdge,
  WorkflowNode,
} from "./types.js";
import { NotFoundError, AppError } from "../shared/errors/index.js";

// ─── Minimal Redis interface (makes unit-testing straightforward) ──────────────

export interface IDebugRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exMode: "EX", ttlSeconds: number): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type DebugEmitter = (event: string, payload: Record<string, unknown>) => void;

export interface DebugNodeState {
  status: "pending" | "running" | "completed" | "error" | "skipped" | "mocked";
  input?:     unknown;
  output?:    unknown;
  error?:     string;
  durationMs?: number;
}

// ─── Session data (serialised to Redis) ──────────────────────────────────────

interface DebugSessionData {
  sessionId:     string;
  workflowId:    string;
  tenantId:      string;
  socketId:      string;
  triggerData:   Record<string, unknown>;
  breakpoints:   string[];
  flatNodeIds:   string[];
  currentIndex:  number;
  outputs:       Record<string, { data: unknown; metadata?: Record<string, unknown> }>;
  activeBranches: [string, number][];
  skippedNodes:  string[];
  nodeStates:    Record<string, DebugNodeState>;
  mockOutputs:   Record<string, unknown>;
  status:        "running" | "paused" | "completed" | "cancelled";
  // Cached workflow topology — avoids re-querying MongoDB on every stepOver
  workflowNodes: WorkflowNode[];
  workflowEdges: WorkflowEdge[];
}

// ─── DebugRunner ──────────────────────────────────────────────────────────────

export class DebugRunner {
  static readonly SESSION_TTL_SECS = 1800; // 30 minutes

  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly nodeExecutor: NodeExecutor,
    private readonly sorter: TopologicalSorter,
    private readonly redis: IDebugRedis
  ) {}

  // ── Redis helpers ───────────────────────────────────────────────────────────

  private sessionKey(sessionId: string): string {
    return `debug:session:${sessionId}`;
  }

  private tenantKey(tenantId: string): string {
    return `debug:tenant:${tenantId}:active`;
  }

  private async loadSession(sessionId: string): Promise<DebugSessionData | null> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as DebugSessionData;
  }

  private async saveSession(session: DebugSessionData): Promise<void> {
    await this.redis.set(
      this.sessionKey(session.sessionId),
      JSON.stringify(session),
      "EX",
      DebugRunner.SESSION_TTL_SECS
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Creates a debug session for the given workflow and begins executing
   * node-by-node until the first breakpoint (or completion if no breakpoints).
   * Returns the new sessionId.
   */
  async startDebugSession(
    workflowId:  string,
    tenantId:    string,
    socketId:    string,
    triggerData: Record<string, unknown>,
    breakpoints: string[],
    emitter:     DebugEmitter
  ): Promise<string> {
    // Enforce max 1 active session per tenant
    const existing = await this.redis.get(this.tenantKey(tenantId));
    if (existing) {
      throw new AppError(
        "A debug session is already active for this tenant. Cancel it first.",
        409,
        "DEBUG_SESSION_CONFLICT"
      );
    }

    const workflow = await this.workflowRepo.findById(workflowId, tenantId);
    if (!workflow) throw new NotFoundError(`Workflow '${workflowId}' not found`);

    const mainNodes = workflow.nodes.filter((n) => !n.loopNodeId) as WorkflowNode[];
    const mainNodeIdSet = new Set(mainNodes.map((n) => n.id));
    const mainEdges = workflow.edges.filter(
      (e) => mainNodeIdSet.has(e.from) && mainNodeIdSet.has(e.to)
    ) as WorkflowEdge[];

    const groups      = this.sorter.sort(mainNodes.map((n) => n.id), mainEdges);
    const flatNodeIds = groups.flat();

    const sessionId = randomUUID();

    const session: DebugSessionData = {
      sessionId,
      workflowId,
      tenantId,
      socketId,
      triggerData,
      breakpoints,
      flatNodeIds,
      currentIndex:   0,
      outputs:        {},
      activeBranches: [],
      skippedNodes:   [],
      nodeStates:     {},
      mockOutputs:    {},
      status:         "running",
      workflowNodes:  mainNodes,
      workflowEdges:  mainEdges,
    };

    await this.saveSession(session);
    await this.redis.set(
      this.tenantKey(tenantId),
      sessionId,
      "EX",
      DebugRunner.SESSION_TTL_SECS
    );

    await this.advance(session, emitter, false);
    return sessionId;
  }

  /**
   * Resumes a paused debug session, executing from the paused node
   * until the next breakpoint or completion.
   */
  async stepOver(sessionId: string, emitter: DebugEmitter): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) throw new NotFoundError(`Debug session '${sessionId}' not found or expired`);
    if (session.status !== "paused") {
      throw new AppError(
        `Debug session is not paused (status: ${session.status})`,
        400,
        "DEBUG_NOT_PAUSED"
      );
    }

    session.status = "running";
    await this.advance(session, emitter, true);
  }

  /** Stores a mock output for the given node; used on the next execution of that node. */
  async setMockOutput(sessionId: string, nodeId: string, mockData: unknown): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) throw new NotFoundError(`Debug session '${sessionId}' not found`);
    session.mockOutputs[nodeId] = mockData;
    await this.saveSession(session);
  }

  /** Returns the stored input/output state for a specific node in the session. */
  async getNodeState(sessionId: string, nodeId: string): Promise<DebugNodeState | null> {
    const session = await this.loadSession(sessionId);
    return session?.nodeStates[nodeId] ?? null;
  }

  /** Cancels and removes the debug session (idempotent). */
  async cancelDebugSession(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;
    await this.redis.del(this.sessionKey(sessionId), this.tenantKey(session.tenantId));
  }

  // ── Core execution ──────────────────────────────────────────────────────────

  /**
   * Advances execution from `session.currentIndex` until either:
   *   - a breakpoint is encountered (pauses before that node), or
   *   - all nodes are executed (completes the session).
   *
   * @param resumingFromBreakpoint When true, the first node at currentIndex is
   *   executed even if it has a breakpoint set (we're resuming past it).
   */
  private async advance(
    session:                 DebugSessionData,
    emitter:                 DebugEmitter,
    resumingFromBreakpoint:  boolean
  ): Promise<void> {
    const outputs        = session.outputs as Record<string, NodeOutput>;
    const activeBranches = new Map<string, number>(session.activeBranches);
    const skippedNodes   = new Set<string>(session.skippedNodes);
    const breakpointSet  = new Set<string>(session.breakpoints);
    const nodeMap        = new Map<string, WorkflowNode>(
      session.workflowNodes.map((n) => [n.id, n])
    );
    const edges          = session.workflowEdges;

    let i          = session.currentIndex;
    let isFirstStep = true;

    while (i < session.flatNodeIds.length) {
      const nodeId = session.flatNodeIds[i]!;

      // Skip nodes pruned by conditional branches
      if (shouldSkipNode(nodeId, edges, skippedNodes, activeBranches)) {
        skippedNodes.add(nodeId);
        session.nodeStates[nodeId] = { status: "skipped" };
        i++;
        isFirstStep = false;
        continue;
      }

      // Breakpoint check — skip if we're resuming from this exact position
      if (breakpointSet.has(nodeId) && !(resumingFromBreakpoint && isFirstStep)) {
        session.currentIndex   = i;
        session.status         = "paused";
        session.activeBranches = [...activeBranches.entries()];
        session.skippedNodes   = [...skippedNodes];
        session.outputs        = outputs;
        await this.saveSession(session);
        emitter("debug:paused", { sessionId: session.sessionId, nodeId });
        return;
      }

      isFirstStep = false;

      const node      = nodeMap.get(nodeId)!;
      const input     = resolveInput(nodeId, edges, outputs, session.triggerData, skippedNodes, activeBranches);
      const startedAt = Date.now();

      session.nodeStates[nodeId] = { status: "running", input };
      emitter("debug:nodeStart", { sessionId: session.sessionId, nodeId });

      try {
        let rawOutput: NodeOutput;

        if (nodeId in session.mockOutputs) {
          // Use the registered mock output instead of executing the node
          rawOutput = { data: session.mockOutputs[nodeId] };
          delete session.mockOutputs[nodeId];
        } else {
          const exprCtx: ExpressionContext = {
            nodes:     outputs,
            variables: {},
            trigger:   session.triggerData,
          };
          const execCtx: ExecutionContext = {
            tenantId:    session.tenantId,
            executionId: session.sessionId,
            workflowId:  session.workflowId,
            variables:   {},
            nodeId,
          };
          rawOutput = await this.nodeExecutor.execute(node, input, exprCtx, execCtx);
        }

        const durationMs             = Date.now() - startedAt;
        const [cleanedOutput, branch] = extractBranch(rawOutput);
        outputs[nodeId]              = cleanedOutput;
        if (branch !== undefined) activeBranches.set(nodeId, branch);

        const isMocked = !(nodeId in session.mockOutputs); // already deleted above if mocked
        session.nodeStates[nodeId] = {
          status: nodeId in session.mockOutputs ? "mocked" : "completed",
          input,
          output: cleanedOutput.data,
          durationMs,
        };

        emitter("debug:nodeEnd", {
          sessionId: session.sessionId,
          nodeId,
          output:    cleanedOutput.data,
          durationMs,
          ...(isMocked ? {} : { mocked: true }),
        });
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        const errorMsg   = err instanceof Error ? err.message : String(err);

        session.nodeStates[nodeId] = { status: "error", input, error: errorMsg, durationMs };
        emitter("debug:nodeError", { sessionId: session.sessionId, nodeId, error: errorMsg });

        // Pause after error so the user can inspect and decide to continue
        i++;
        session.currentIndex   = i;
        session.status         = "paused";
        session.activeBranches = [...activeBranches.entries()];
        session.skippedNodes   = [...skippedNodes];
        session.outputs        = outputs;
        await this.saveSession(session);
        return;
      }

      i++;
    }

    // All nodes executed — mark session complete
    session.currentIndex   = i;
    session.status         = "completed";
    session.activeBranches = [...activeBranches.entries()];
    session.skippedNodes   = [...skippedNodes];
    session.outputs        = outputs;
    await this.saveSession(session);
    // Remove active-session marker so the tenant can start a new session
    await this.redis.del(this.tenantKey(session.tenantId));
    emitter("debug:complete", { sessionId: session.sessionId });
  }
}

// ─── Pure helpers (local copies; avoids coupling to WorkflowRunner) ───────────

function shouldSkipNode(
  nodeId:        string,
  edges:         readonly WorkflowEdge[],
  skippedNodes:  ReadonlySet<string>,
  activeBranches: ReadonlyMap<string, number>
): boolean {
  const incoming = edges.filter((e) => e.to === nodeId);
  if (incoming.length === 0) return false; // root node — always runs
  return incoming.every((edge) => {
    if (skippedNodes.has(edge.from)) return true;
    const branch = activeBranches.get(edge.from);
    return branch !== undefined && edge.sourceHandle !== String(branch);
  });
}

function extractBranch(output: NodeOutput): [NodeOutput, number | undefined] {
  const data = output.data;
  if (typeof data !== "object" || data === null || !("_branch" in data)) {
    return [output, undefined];
  }
  const raw    = data as Record<string, unknown>;
  const branch = raw["_branch"] as number;
  const { _branch: _b, ...rest } = raw;
  return [{ ...output, data: rest }, branch];
}

function resolveInput(
  nodeId:        string,
  edges:         readonly WorkflowEdge[],
  outputs:       Record<string, NodeOutput>,
  triggerData:   Record<string, unknown>,
  skippedNodes:  Set<string>,
  activeBranches: Map<string, number>
): unknown {
  const parentEdges = edges.filter((e) => e.to === nodeId);
  const activeParentEdges = parentEdges.filter((e) => {
    if (skippedNodes.has(e.from)) return false;
    const branch = activeBranches.get(e.from);
    return branch === undefined || e.sourceHandle === String(branch);
  });

  if (activeParentEdges.length === 0) return triggerData;
  if (activeParentEdges.length === 1) return outputs[activeParentEdges[0]!.from];
  return activeParentEdges.map((e) => outputs[e.from]);
}
