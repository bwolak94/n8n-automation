import { CyclicWorkflowError } from "../shared/errors/index.js";
import type { WorkflowEdge } from "./types.js";

export class TopologicalSorter {
  /**
   * Kahn's algorithm — returns parallel execution groups.
   * Each group is a set of node IDs with no dependency on each other;
   * all nodes in group N must complete before group N+1 begins.
   *
   * @throws {CyclicWorkflowError} when the graph contains a cycle.
   */
  sort(nodeIds: readonly string[], edges: readonly WorkflowEdge[]): string[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const id of nodeIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const { from, to } of edges) {
      // Both maps are pre-seeded with all nodeIds; ! is safe here
      adjacency.get(from)!.push(to);
      // to may reference a node from nodeIds (always in map); if not, treat as 0
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }

    const groups: string[][] = [];
    // Start with all zero-in-degree nodes
    let queue = [...inDegree.entries()]
      .filter(([, deg]) => deg === 0)
      .map(([id]) => id);

    let processed = 0;

    while (queue.length > 0) {
      groups.push([...queue]);
      processed += queue.length;

      const nextQueue: string[] = [];
      for (const id of queue) {
        // id is always in adjacency since queue only contains nodeIds
        for (const neighbor of adjacency.get(id)!) {
          const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
          inDegree.set(neighbor, newDeg);
          if (newDeg === 0) nextQueue.push(neighbor);
        }
      }
      queue = nextQueue;
    }

    if (processed !== nodeIds.length) {
      throw new CyclicWorkflowError();
    }

    return groups;
  }
}
