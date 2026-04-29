import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../../shared/errors/index.js";
import type { NodeRegistry } from "../../nodes/NodeRegistry.js";

export class NodeController {
  constructor(private readonly registry: NodeRegistry) {}

  list = (_req: Request, res: Response): void => {
    // NodeRegistry doesn't expose a list method — we get all registered types
    // by accessing the internal map via a helper
    const types = this.registry.listAll();
    res.json({ items: types });
  };

  get = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const node = this.registry.resolve(req.params["type"]!);
      res.json(node.definition);
    } catch (err) {
      next(new NotFoundError(`Node type '${req.params["type"]}' not found`));
    }
  };
}
