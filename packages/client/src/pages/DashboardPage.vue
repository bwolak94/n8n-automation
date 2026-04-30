<script setup lang="ts">
import { computed } from "vue";
import AppLayout from "../shared/components/AppLayout.vue";
import KpiCard from "../features/dashboard/components/KpiCard.vue";
import ExecutionVolumeChart from "../features/dashboard/components/ExecutionVolumeChart.vue";
import NodeTypeChart from "../features/dashboard/components/NodeTypeChart.vue";
import AiUsagePanel from "../features/dashboard/components/AiUsagePanel.vue";
import RecentExecutionsTable from "../features/dashboard/components/RecentExecutionsTable.vue";
import { useAnalyticsQuery } from "../shared/queries/useAnalytics.js";

const { data, isPending } = useAnalyticsQuery();

const successRateLabel = computed(() => {
  if (isPending.value || !data.value) return null;
  return `${data.value.successRate}%`;
});
</script>

<template>
  <AppLayout>
    <!-- Page header -->
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">Dashboard</h1>
      <p class="text-sm text-gray-400">Overview of your automation activity</p>
    </header>

    <main class="flex-1 overflow-y-auto p-6">
      <!-- KPI Row -->
      <div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="kpi-grid">
        <KpiCard
          label="Total Workflows"
          icon="⚡"
          color="violet"
          :value="data?.totalWorkflows ?? null"
          :loading="isPending"
        />
        <KpiCard
          label="Executions This Month"
          icon="▶"
          color="blue"
          :value="data?.executionsThisMonth ?? null"
          :loading="isPending"
        />
        <KpiCard
          label="Success Rate"
          icon="✓"
          color="green"
          :value="successRateLabel"
          :loading="isPending"
        />
        <KpiCard
          label="AI Tokens Used"
          icon="🤖"
          color="amber"
          :value="data?.aiTokensUsed ?? null"
          :loading="isPending"
        />
      </div>

      <!-- Charts row -->
      <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <ExecutionVolumeChart
            :volume-by-day="data?.volumeByDay ?? []"
            :loading="isPending"
          />
        </div>
        <NodeTypeChart
          :node-type-usage="data?.nodeTypeUsage ?? []"
          :loading="isPending"
        />
      </div>

      <!-- AI usage + Recent executions row -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AiUsagePanel
          :tokens-used="data?.aiTokensUsed ?? 0"
          :token-limit="data?.aiTokenLimit ?? 100000"
          :loading="isPending"
        />
        <div class="lg:col-span-2">
          <RecentExecutionsTable
            :executions="data?.recentExecutions ?? []"
            :loading="isPending"
          />
        </div>
      </div>
    </main>
  </AppLayout>
</template>
