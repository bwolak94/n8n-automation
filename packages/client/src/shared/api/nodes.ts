import { apiClient } from "./client.js";
import type { NodeDefinition } from "../types/index.js";

export async function fetchNodeDefinitions(): Promise<{
  items: NodeDefinition[];
}> {
  return apiClient.get("nodes").json<{ items: NodeDefinition[] }>();
}

export async function fetchNodeDefinition(
  type: string
): Promise<NodeDefinition> {
  return apiClient.get(`nodes/${type}`).json<NodeDefinition>();
}
