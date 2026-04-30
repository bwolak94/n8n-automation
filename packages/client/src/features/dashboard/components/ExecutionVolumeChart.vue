<script setup lang="ts">
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { lastNDays } from "../../../shared/utils/stats.js";
import type { DailyVolume } from "../../../shared/types/index.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  volumeByDay: DailyVolume[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const DAYS = 30;

const chartData = computed(() => {
  const labels = lastNDays(DAYS);
  const successMap = new Map(props.volumeByDay.map((d) => [d.date, d.success]));
  const failedMap = new Map(props.volumeByDay.map((d) => [d.date, d.failed]));

  return {
    labels: labels.map((d) => d.slice(5)), // MM-DD
    datasets: [
      {
        label: "Success",
        data: labels.map((d) => successMap.get(d) ?? 0),
        backgroundColor: "rgba(124, 58, 237, 0.75)",
        borderRadius: 3,
      },
      {
        label: "Failed",
        data: labels.map((d) => failedMap.get(d) ?? 0),
        backgroundColor: "rgba(239, 68, 68, 0.65)",
        borderRadius: 3,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top" as const, labels: { font: { size: 12 } } },
    tooltip: { mode: "index" as const, intersect: false },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
    y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
  },
};

const hasData = computed(() => props.volumeByDay.some((d) => d.success > 0 || d.failed > 0));
</script>

<template>
  <div
    class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    data-testid="execution-volume-chart"
  >
    <h3 class="mb-4 text-sm font-semibold text-gray-700">Execution Volume (last 30 days)</h3>

    <!-- Skeleton -->
    <div v-if="loading" class="flex h-48 items-center justify-center" data-testid="chart-skeleton">
      <div class="h-full w-full animate-pulse rounded bg-gray-100" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!hasData"
      class="flex h-48 flex-col items-center justify-center text-center"
      data-testid="chart-empty"
    >
      <p class="text-sm text-gray-400">No execution data for the last 30 days.</p>
    </div>

    <!-- Chart -->
    <div v-else class="h-48" data-testid="chart-canvas">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
