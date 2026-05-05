<template>
  <div class="flex flex-col gap-6 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Audit Logs</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Immutable record of all significant actions in your workspace.
        </p>
      </div>
      <a
        :href="exportUrl"
        download="audit-logs.csv"
        class="inline-flex items-center gap-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        Export CSV
      </a>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <select
        v-model="filters.eventType"
        class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @change="resetAndLoad"
      >
        <option value="">All event types</option>
        <option v-for="et in eventTypes" :key="et.value" :value="et.value">{{ et.label }}</option>
      </select>

      <input
        v-model="filters.actorId"
        type="text"
        placeholder="Filter by actor ID"
        class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
        @change="resetAndLoad"
      />

      <input
        v-model="filters.from"
        type="date"
        class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @change="resetAndLoad"
      />
      <span class="self-center text-sm text-gray-400">to</span>
      <input
        v-model="filters.to"
        type="date"
        class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @change="resetAndLoad"
      />

      <button
        class="rounded-md text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-2 transition-colors"
        @click="clearFilters"
      >
        Clear
      </button>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <tr>
            <th class="px-4 py-3 text-left">Timestamp</th>
            <th class="px-4 py-3 text-left">Actor</th>
            <th class="px-4 py-3 text-left">Event</th>
            <th class="px-4 py-3 text-left">Entity</th>
            <th class="px-4 py-3 text-left">IP</th>
            <th class="px-4 py-3 text-left w-8"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          <template v-if="loading">
            <tr v-for="n in 8" :key="n">
              <td colspan="6" class="px-4 py-3">
                <div class="h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </td>
            </tr>
          </template>

          <template v-else-if="items.length === 0">
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                No audit log entries found.
              </td>
            </tr>
          </template>

          <template v-else>
            <template v-for="log in items" :key="log.id">
              <tr
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                @click="toggleExpand(log.id)"
              >
                <td class="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-gray-400">
                  {{ formatDate(log.createdAt) }}
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]" :title="log.actorId">
                    {{ log.actorEmail ?? log.actorId }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span :class="eventBadgeClass(log.eventType)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {{ log.eventType }}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">
                  <span v-if="log.entityType">{{ log.entityType }}</span>
                  <span v-if="log.entityId" class="ml-1 font-mono text-xs truncate max-w-[120px] inline-block" :title="log.entityId">
                    {{ log.entityId.slice(0, 12) }}…
                  </span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">
                  {{ log.ipAddress ?? "—" }}
                </td>
                <td class="px-4 py-3 text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 transition-transform"
                    :class="expanded.has(log.id) ? 'rotate-180' : ''"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </td>
              </tr>
              <!-- Expanded metadata row -->
              <tr v-if="expanded.has(log.id)" class="bg-gray-50 dark:bg-gray-800/60">
                <td colspan="6" class="px-4 py-3">
                  <pre class="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-all font-mono">{{ JSON.stringify({ actorId: log.actorId, userAgent: log.userAgent, metadata: log.metadata }, null, 2) }}</pre>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
      <span>{{ total }} total records</span>
      <div class="flex gap-2">
        <button
          :disabled="offset === 0"
          class="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          @click="prevPage"
        >
          Previous
        </button>
        <span class="self-center">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          :disabled="offset + limit >= total"
          class="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { listAuditLogs, exportAuditLogsUrl, type AuditLog, type AuditLogQuery } from "../../../shared/api/auditLogs.js";

// ─── Event type metadata ──────────────────────────────────────────────────────

const eventTypes = [
  { value: "workflow.created",    label: "Workflow Created" },
  { value: "workflow.updated",    label: "Workflow Updated" },
  { value: "workflow.deleted",    label: "Workflow Deleted" },
  { value: "credential.created",  label: "Credential Created" },
  { value: "credential.deleted",  label: "Credential Deleted" },
  { value: "member.invited",      label: "Member Invited" },
  { value: "member.removed",      label: "Member Removed" },
  { value: "execution.triggered", label: "Execution Triggered" },
  { value: "execution.cancelled", label: "Execution Cancelled" },
  { value: "billing.subscribed",  label: "Billing Subscribed" },
  { value: "billing.cancelled",   label: "Billing Cancelled" },
];

function eventBadgeClass(eventType: string): string {
  if (eventType.startsWith("workflow."))   return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  if (eventType.startsWith("credential.")) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  if (eventType.startsWith("execution."))  return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (eventType.startsWith("member."))     return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
  if (eventType.startsWith("billing."))    return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

// ─── State ────────────────────────────────────────────────────────────────────

const limit  = 50;
const offset = ref(0);
const total  = ref(0);
const items  = ref<AuditLog[]>([]);
const loading = ref(false);
const expanded = ref(new Set<string>());

const filters = ref<AuditLogQuery>({
  eventType:  "",
  actorId:    "",
  from:       "",
  to:         "",
});

// ─── Computed ─────────────────────────────────────────────────────────────────

const currentPage = computed(() => Math.floor(offset.value / limit) + 1);
const totalPages  = computed(() => Math.max(1, Math.ceil(total.value / limit)));

const exportUrl = computed(() =>
  exportAuditLogsUrl({
    eventType:  filters.value.eventType  || undefined,
    actorId:    filters.value.actorId    || undefined,
    from:       filters.value.from       || undefined,
    to:         filters.value.to         || undefined,
  })
);

// ─── Methods ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toggleExpand(id: string): void {
  if (expanded.value.has(id)) {
    expanded.value.delete(id);
  } else {
    expanded.value.add(id);
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await listAuditLogs({
      eventType:  filters.value.eventType  || undefined,
      actorId:    filters.value.actorId    || undefined,
      from:       filters.value.from       || undefined,
      to:         filters.value.to         || undefined,
      limit,
      offset:     offset.value,
    });
    items.value = result.items;
    total.value = result.total;
    expanded.value.clear();
  } finally {
    loading.value = false;
  }
}

function resetAndLoad(): void {
  offset.value = 0;
  void load();
}

function clearFilters(): void {
  filters.value = { eventType: "", actorId: "", from: "", to: "" };
  resetAndLoad();
}

function nextPage(): void {
  offset.value += limit;
  void load();
}

function prevPage(): void {
  offset.value = Math.max(0, offset.value - limit);
  void load();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onMounted(() => void load());
</script>
