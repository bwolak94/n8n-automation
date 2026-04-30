<script setup lang="ts">
interface Props {
  label: string;
  value: string | number | null;
  icon: string;
  loading?: boolean;
  color?: "violet" | "green" | "blue" | "amber";
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  color: "violet",
});

const colorMap = {
  violet: "bg-violet-50 text-violet-600",
  green: "bg-green-50 text-green-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
};
</script>

<template>
  <div
    class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    data-testid="kpi-card"
  >
    <div
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
      :class="colorMap[props.color]"
      aria-hidden="true"
    >
      {{ icon }}
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ label }}</p>
      <!-- Skeleton -->
      <div
        v-if="loading"
        class="mt-1 h-7 w-20 animate-pulse rounded bg-gray-100"
        data-testid="kpi-skeleton"
      />
      <!-- Value -->
      <p
        v-else
        class="mt-0.5 text-2xl font-bold text-gray-900"
        data-testid="kpi-value"
      >
        {{ value ?? "—" }}
      </p>
    </div>
  </div>
</template>
