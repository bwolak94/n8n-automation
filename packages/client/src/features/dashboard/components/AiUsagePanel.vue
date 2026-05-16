<script setup lang="ts">
import { computed } from "vue";

interface Props {
  tokensUsed: number;
  tokenLimit: number;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });

const usagePct = computed(() => {
  if (props.tokenLimit === 0) return 0;
  return Math.min(100, Math.round((props.tokensUsed / props.tokenLimit) * 100));
});

const estimatedCost = computed(() => {
  // ~$0.002 per 1K tokens (approximate)
  const cost = (props.tokensUsed / 1000) * 0.002;
  return `$${cost.toFixed(4)}`;
});

const barColor = computed(() => {
  if (usagePct.value >= 90) return "bg-red-500";
  if (usagePct.value >= 70) return "bg-amber-400";
  return "bg-violet-500";
});

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
</script>

<template>
  <div
    class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    data-testid="ai-usage-panel"
  >
    <h3 class="mb-4 text-sm font-semibold text-gray-700">AI Usage This Month</h3>

    <div v-if="loading" class="space-y-3" data-testid="ai-usage-skeleton">
      <div class="h-4 animate-pulse rounded bg-gray-100" />
      <div class="h-2 animate-pulse rounded bg-gray-100" />
      <div class="h-4 w-24 animate-pulse rounded bg-gray-100" />
    </div>

    <template v-else>
      <!-- Tokens used vs limit -->
      <div class="mb-3 flex items-end justify-between text-sm">
        <span class="font-semibold text-gray-800" data-testid="ai-tokens-used">
          {{ formatTokens(tokensUsed) }} tokens
        </span>
        <span class="text-xs text-gray-400">of {{ formatTokens(tokenLimit) }} limit</span>
      </div>

      <!-- Progress bar -->
      <div class="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" :aria-valuenow="usagePct" aria-valuemin="0" aria-valuemax="100">
        <div
          class="h-full rounded-full transition-all"
          :class="barColor"
          :style="{ width: `${usagePct}%` }"
          data-testid="ai-usage-bar"
        />
      </div>
      <p class="mt-1 text-xs text-gray-400">{{ usagePct }}% used</p>

      <!-- Estimated cost -->
      <div class="mt-4 border-t border-gray-100 pt-3">
        <p class="text-xs text-gray-500">Estimated cost</p>
        <p class="text-lg font-semibold text-gray-800" data-testid="ai-estimated-cost">
          {{ estimatedCost }}
        </p>
      </div>
    </template>
  </div>
</template>
