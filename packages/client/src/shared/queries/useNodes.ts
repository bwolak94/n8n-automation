import { useQuery } from "@tanstack/vue-query";
import { fetchNodeDefinitions, fetchNodeDefinition } from "../api/nodes.js";

export const NODES_KEY = "nodes";

export function useNodeDefinitionsQuery() {
  return useQuery({
    queryKey: [NODES_KEY],
    queryFn: fetchNodeDefinitions,
    staleTime: 5 * 60 * 1000, // Node definitions rarely change
  });
}

export function useNodeDefinitionQuery(type: string) {
  return useQuery({
    queryKey: [NODES_KEY, type],
    queryFn: () => fetchNodeDefinition(type),
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  });
}
