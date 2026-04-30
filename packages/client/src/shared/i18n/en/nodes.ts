export const nodes = {
  searchPlaceholder: "Search nodes...",
  categories: "Categories",
  allNodes: "All nodes",
  triggers: "Triggers",
  actions: "Actions",
  logic: "Logic",
  data: "Data",
  ai: "AI",
  communication: "Communication",
  integrations: "Integrations",
  configure: "Configure node",
  noConfig: "No configuration required",
  inputLabel: "Input",
  outputLabel: "Output",
} as const;

export type NodesMessages = Record<keyof typeof nodes, string>;
