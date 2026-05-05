<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 w-80">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex-1">
        Debug
      </span>

      <template v-if="status === 'idle'">
        <button
          class="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          @click="emit('run')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
          Run
        </button>
      </template>

      <template v-else-if="status === 'paused'">
        <button
          class="inline-flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
          @click="emit('step')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" />
          </svg>
          Step Over
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          @click="emit('cancel')"
        >
          Cancel
        </button>
      </template>

      <template v-else-if="status === 'running'">
        <span class="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse font-medium">Running…</span>
        <button
          class="rounded text-xs text-gray-500 hover:text-red-600 px-2 py-1.5 transition-colors"
          @click="emit('cancel')"
        >
          Stop
        </button>
      </template>

      <template v-else-if="status === 'completed'">
        <span class="text-xs text-green-600 dark:text-green-400 font-medium">Completed</span>
        <button
          class="rounded text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors"
          @click="emit('run')"
        >
          Re-run
        </button>
      </template>
    </div>

    <!-- Error banner -->
    <div
      v-if="errorMessage"
      class="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
    >
      {{ errorMessage }}
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-4 py-2 text-xs font-medium transition-colors border-b-2"
        :class="activeTab === tab.id
          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto">

      <!-- Trigger Data tab -->
      <div v-if="activeTab === 'trigger'" class="p-3">
        <textarea
          v-model="triggerDataJson"
          class="w-full h-48 text-xs font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          placeholder="{}"
          spellcheck="false"
        />
        <p v-if="triggerJsonError" class="mt-1 text-xs text-red-600">{{ triggerJsonError }}</p>
      </div>

      <!-- Node Inspector tab -->
      <div v-else-if="activeTab === 'inspector'">
        <div v-if="!selectedNodeId" class="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
          Click a node on the canvas to inspect its data.
        </div>

        <div v-else class="p-3 space-y-3">
          <!-- Node ID + status -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
              {{ selectedNodeId }}
            </span>
            <span
              class="text-xs rounded-full px-2 py-0.5 font-medium"
              :class="statusBadgeClass(selectedNodeState?.status)"
            >
              {{ selectedNodeState?.status ?? "pending" }}
            </span>
          </div>

          <!-- Duration -->
          <div v-if="selectedNodeState?.durationMs !== undefined" class="text-xs text-gray-400">
            {{ selectedNodeState.durationMs }}ms
          </div>

          <!-- Input -->
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Input</p>
            <pre class="text-xs font-mono bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300">{{ formatJson(selectedNodeState?.input) }}</pre>
          </div>

          <!-- Output / Error -->
          <div v-if="selectedNodeState?.status === 'error'">
            <p class="text-xs font-semibold text-red-500 mb-1">Error</p>
            <pre class="text-xs font-mono bg-red-50 dark:bg-red-900/20 rounded p-2 text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">{{ selectedNodeState.error }}</pre>
          </div>
          <div v-else-if="selectedNodeState?.output !== undefined">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Output</p>
            <pre class="text-xs font-mono bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300">{{ formatJson(selectedNodeState.output) }}</pre>
          </div>

          <!-- Mock output section -->
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Mock Output</p>
            <textarea
              v-model="mockOutputJson"
              class="w-full h-24 text-xs font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder='{"key": "value"}'
              spellcheck="false"
            />
            <button
              class="mt-1 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
              @click="applyMock"
            >
              Set Mock
            </button>
          </div>
        </div>
      </div>

      <!-- Logs tab -->
      <div v-else-if="activeTab === 'logs'" class="p-2">
        <div
          v-for="log in executionLog"
          :key="log.nodeId + log.event"
          class="text-xs font-mono py-1 border-b border-gray-100 dark:border-gray-800"
        >
          <span class="text-gray-400 dark:text-gray-500 mr-2">{{ log.time }}</span>
          <span :class="logEventClass(log.event)" class="mr-2 font-medium">{{ log.event }}</span>
          <span class="text-gray-700 dark:text-gray-300">{{ log.nodeId }}</span>
        </div>
        <div v-if="executionLog.length === 0" class="text-xs text-gray-400 p-2">No events yet.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { DebugNodeState, DebugNodeStatus } from "../composables/useDebugSession.js";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  status:         "idle" | "running" | "paused" | "completed" | "error";
  errorMessage?:  string | null;
  nodeStates:     Record<string, DebugNodeState>;
  selectedNodeId?: string | null;
}

const props = defineProps<Props>();

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  run:   [];
  step:  [];
  cancel: [];
  mock:  [nodeId: string, mockData: unknown];
}>();

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: "trigger",  label: "Trigger" },
  { id: "inspector", label: "Inspector" },
  { id: "logs",     label: "Logs" },
] as const;

type TabId = (typeof tabs)[number]["id"];
const activeTab = ref<TabId>("trigger");

// ─── Trigger data ─────────────────────────────────────────────────────────────

const triggerDataJson  = ref("{}");
const triggerJsonError = ref<string | null>(null);

function parsedTriggerData(): Record<string, unknown> {
  try {
    triggerJsonError.value = null;
    return JSON.parse(triggerDataJson.value) as Record<string, unknown>;
  } catch {
    triggerJsonError.value = "Invalid JSON";
    return {};
  }
}

// ─── Inspector ────────────────────────────────────────────────────────────────

const selectedNodeState = computed<DebugNodeState | undefined>(() =>
  props.selectedNodeId ? props.nodeStates[props.selectedNodeId] : undefined
);

const mockOutputJson = ref("{}");

function applyMock(): void {
  if (!props.selectedNodeId) return;
  try {
    const data = JSON.parse(mockOutputJson.value) as unknown;
    emit("mock", props.selectedNodeId, data);
  } catch {
    // ignore invalid JSON
  }
}

// ─── Execution log ────────────────────────────────────────────────────────────

interface LogEntry { time: string; event: string; nodeId: string; }

const executionLog = ref<LogEntry[]>([]);

// Watchers for node state changes (build log from parent)
function appendLog(event: string, nodeId: string): void {
  executionLog.value.push({
    time:   new Date().toLocaleTimeString(),
    event,
    nodeId,
  });
}

defineExpose({ parsedTriggerData, appendLog });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return "—";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function statusBadgeClass(status: DebugNodeStatus | undefined): string {
  switch (status) {
    case "running":   return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "completed": return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "error":     return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "skipped":   return "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
    case "mocked":    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
    default:          return "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
  }
}

function logEventClass(event: string): string {
  if (event.includes("Start"))  return "text-blue-500";
  if (event.includes("End"))    return "text-green-500";
  if (event.includes("Error"))  return "text-red-500";
  if (event.includes("paused")) return "text-yellow-500";
  return "text-gray-500";
}
</script>
