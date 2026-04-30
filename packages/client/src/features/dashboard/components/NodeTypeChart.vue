<script setup lang="ts">
import { computed } from "vue";
import { Doughnut } from "vue-chartjs";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { NodeTypeUsage } from "../../../shared/types/index.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  nodeTypeUsage: NodeTypeUsage[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const PALETTE = [
  "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95",
  "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe",
  "#2563eb", "#1d4ed8",
];

const chartData = computed(() => ({
  labels: props.nodeTypeUsage.map((n) => n.type),
  datasets: [{
    data: props.nodeTypeUsage.map((n) => n.count),
    backgroundColor: props.nodeTypeUsage.map((_, i) => PALETTE[i % PALETTE.length]),
    borderWidth: 2,
    borderColor: "#fff",
  }],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "65%",
  plugins: {
    legend: { position: "right" as const, labels: { font: { size: 11 }, boxWidth: 12 } },
  },
};
</script>

<template>
  <div
    class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    data-testid="node-type-chart"
  >
    <h3 class="mb-4 text-sm font-semibold text-gray-700">Node Type Usage</h3>

    <div v-if="loading" class="flex h-48 items-center justify-center" data-testid="node-chart-skeleton">
      <div class="h-full w-full animate-pulse rounded-full bg-gray-100" />
    </div>

    <div
      v-else-if="nodeTypeUsage.length === 0"
      class="flex h-48 items-center justify-center"
      data-testid="node-chart-empty"
    >
      <p class="text-sm text-gray-400">No node usage data available.</p>
    </div>

    <div v-else class="h-48" data-testid="node-chart-canvas">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
