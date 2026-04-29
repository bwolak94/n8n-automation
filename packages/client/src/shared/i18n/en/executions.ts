export const executions = {
  title: "Executions",
  id: "Execution ID",
  status: "Status",
  startedAt: "Started at",
  completedAt: "Completed at",
  duration: "Duration",
  trigger: "Trigger",
  logs: "Logs",
  steps: "Steps",
  cancel: "Cancel execution",
  retry: "Retry",
  statuses: {
    pending: "Pending",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  },
  empty: "No executions yet",
  streamingLogs: "Streaming execution logs...",
} as const;

export type ExecutionsMessages = typeof executions;
