import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../../shared/errors/index.js";
import type { NodeRegistry } from "../../nodes/NodeRegistry.js";

// ─── Category + icon metadata per node type ──────────────────────────────────

interface NodeMeta {
  category: string;
  icon: string;
}

const NODE_META: Record<string, NodeMeta> = {
  http:         { category: "actions",       icon: "🌐" },
  webhook:      { category: "triggers",      icon: "⚡" },
  ai_transform: { category: "ai",            icon: "🤖" },
  openai:       { category: "ai",            icon: "🧠" },
  condition:    { category: "logic",         icon: "🔀" },
  javascript:   { category: "logic",         icon: "⚙️" },
  loop:         { category: "logic",         icon: "🔁" },
  merge:        { category: "logic",         icon: "⤵️" },
  delay:        { category: "logic",         icon: "⏱️" },
  noop:         { category: "logic",         icon: "⭕" },
  transform:    { category: "data",          icon: "📊" },
  set_variable: { category: "data",          icon: "📝" },
  db_query:     { category: "data",          icon: "🗄️" },
  email:        { category: "communication", icon: "📧" },
  slack:        { category: "integrations",  icon: "💬" },
  telegram:     { category: "integrations",  icon: "✈️" },
  discord:      { category: "integrations",  icon: "🎮" },
  github:       { category: "integrations",  icon: "🐙" },
};

function toClientShape(def: { type: string; name: string; description?: string; configSchema?: Record<string, unknown> }) {
  const meta: NodeMeta = NODE_META[def.type] ?? { category: "actions", icon: "📦" };
  return {
    type:         def.type,
    label:        def.name,
    description:  def.description ?? "",
    icon:         meta.icon,
    category:     meta.category,
    configSchema: def.configSchema ?? {},
    inputSchema:  {},
    outputSchema: {},
  };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class NodeController {
  constructor(private readonly registry: NodeRegistry) {}

  list = (_req: Request, res: Response): void => {
    const items = this.registry.listAll().map(toClientShape);
    res.json({ items });
  };

  get = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const node = this.registry.resolve(req.params["type"]!);
      res.json(toClientShape(node.definition));
    } catch (err) {
      next(new NotFoundError(`Node type '${req.params["type"]}' not found`));
    }
  };
}
