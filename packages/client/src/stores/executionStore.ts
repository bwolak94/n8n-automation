import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ExecutionSummary } from "../shared/types/index.js";

export const useExecutionStore = defineStore("execution", () => {
  const executions = ref<Map<string, ExecutionSummary>>(new Map());
  const currentExecutionId = ref<string | null>(null);

  // ── Getters ────────────────────────────────────────────────────────────────

  const currentExecution = computed(() =>
    currentExecutionId.value
      ? (executions.value.get(currentExecutionId.value) ?? null)
      : null
  );

  const executionList = computed(() =>
    Array.from(executions.value.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  function setExecution(execution: ExecutionSummary): void {
    executions.value.set(execution.id, execution);
  }

  function updateExecutionStatus(
    id: string,
    status: ExecutionSummary["status"]
  ): void {
    const existing = executions.value.get(id);
    if (existing) {
      executions.value.set(id, { ...existing, status });
    }
  }

  function setCurrentExecution(id: string | null): void {
    currentExecutionId.value = id;
  }

  function removeExecution(id: string): void {
    executions.value.delete(id);
    if (currentExecutionId.value === id) {
      currentExecutionId.value = null;
    }
  }

  function clearAll(): void {
    executions.value.clear();
    currentExecutionId.value = null;
  }

  return {
    executions,
    currentExecutionId,
    currentExecution,
    executionList,
    setExecution,
    updateExecutionStatus,
    setCurrentExecution,
    removeExecution,
    clearAll,
  };
});
