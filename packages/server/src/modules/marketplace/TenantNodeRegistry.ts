import { NodeRegistry } from "../../nodes/NodeRegistry.js";
import type { INode, NodeDefinition } from "../../nodes/contracts/INode.js";
import { UnknownNodeTypeError } from "../../shared/errors/index.js";

// ─── TenantNodeRegistry ───────────────────────────────────────────────────────
//
// Extends the global NodeRegistry with a per-tenant overlay.
// The NodeExecutor detects the presence of `resolveForTenant` via duck typing
// and uses it instead of `resolve` to get tenant-specific nodes.

export class TenantNodeRegistry extends NodeRegistry {
  private readonly tenantNodes = new Map<string, Map<string, INode>>();

  // ── Per-tenant registration ────────────────────────────────────────────────

  registerForTenant(tenantId: string, node: INode): void {
    if (!this.tenantNodes.has(tenantId)) {
      this.tenantNodes.set(tenantId, new Map());
    }
    this.tenantNodes.get(tenantId)!.set(node.definition.type, node);
  }

  unregisterForTenant(tenantId: string, nodeType: string): void {
    this.tenantNodes.get(tenantId)?.delete(nodeType);
  }

  // ── Tenant-aware resolution (duck-typed by NodeExecutor) ───────────────────

  resolveForTenant(type: string, tenantId: string): INode {
    const tenantNode = this.tenantNodes.get(tenantId)?.get(type);
    if (tenantNode) return tenantNode;
    return this.resolve(type); // falls back to global; throws UnknownNodeTypeError if absent
  }

  // ── Merged registry snapshot for a given tenant ────────────────────────────

  getForTenant(tenantId: string): NodeRegistry {
    const scoped = new NodeRegistry();
    for (const node of this.getAll()) {
      scoped.register(node);
    }
    const tenantMap = this.tenantNodes.get(tenantId);
    if (tenantMap) {
      for (const [, node] of tenantMap) {
        if (!scoped.has(node.definition.type)) {
          scoped.register(node);
        }
      }
    }
    return scoped;
  }

  // ── Listing ────────────────────────────────────────────────────────────────

  listForTenant(tenantId: string): NodeDefinition[] {
    const result = new Map<string, NodeDefinition>();
    for (const def of this.listAll()) {
      result.set(def.type, def);
    }
    const tenantMap = this.tenantNodes.get(tenantId);
    if (tenantMap) {
      for (const [, node] of tenantMap) {
        result.set(node.definition.type, node.definition);
      }
    }
    return [...result.values()];
  }

  hasForTenant(type: string, tenantId: string): boolean {
    return this.tenantNodes.get(tenantId)?.has(type) ?? this.has(type);
  }
}
