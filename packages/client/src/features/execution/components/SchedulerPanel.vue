<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { parseCronDescription } from "../../../shared/utils/cronDescription.js";
import { useUpdateWorkflow } from "../../../shared/queries/useWorkflows.js";
import type { ScheduleConfig } from "../../../shared/types/index.js";

interface Props {
  workflowId: string;
  initialSchedule?: ScheduleConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ saved: [schedule: ScheduleConfig] }>();

// ─── Common IANA timezones ─────────────────────────────────────────────────────
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Warsaw",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

const enabled = ref(props.initialSchedule?.enabled ?? false);
const cronExpression = ref(props.initialSchedule?.cronExpression ?? "0 9 * * 1");
const timezone = ref(props.initialSchedule?.timezone ?? "UTC");

watch(
  () => props.initialSchedule,
  (next) => {
    if (!next) return;
    enabled.value = next.enabled;
    cronExpression.value = next.cronExpression;
    timezone.value = next.timezone;
  },
  { immediate: false }
);

const descriptionResult = computed(() => parseCronDescription(cronExpression.value));

const description = computed(() =>
  descriptionResult.value.valid ? descriptionResult.value.description : null
);

const cronError = computed(() =>
  !descriptionResult.value.valid ? descriptionResult.value.error : null
);

const isValid = computed(() => descriptionResult.value.valid);

const { mutate: updateWorkflow, isPending: isSaving } = useUpdateWorkflow();

function save(): void {
  if (!isValid.value) return;
  const schedule: ScheduleConfig = {
    enabled: enabled.value,
    cronExpression: cronExpression.value.trim(),
    timezone: timezone.value,
  };
  updateWorkflow(
    { id: props.workflowId, data: { schedule } },
    { onSuccess: () => emit("saved", schedule) }
  );
}
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="scheduler-panel">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-gray-800">Schedule</h2>
      <!-- Enable toggle -->
      <label class="flex cursor-pointer items-center gap-2 text-sm" data-testid="scheduler-toggle">
        <span class="text-gray-600">{{ enabled ? "Enabled" : "Disabled" }}</span>
        <button
          type="button"
          role="switch"
          :aria-checked="enabled"
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          :class="enabled ? 'bg-violet-600' : 'bg-gray-300'"
          data-testid="scheduler-toggle-btn"
          @click="enabled = !enabled"
        >
          <span
            class="inline-block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white shadow transition-transform"
            :class="{ 'translate-x-4': enabled }"
          />
        </button>
      </label>
    </div>

    <!-- Cron expression -->
    <div>
      <label for="cron-input" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Cron Expression
      </label>
      <input
        id="cron-input"
        v-model="cronExpression"
        type="text"
        placeholder="0 9 * * 1"
        class="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none"
        :class="cronError
          ? 'border-red-300 focus:border-red-400'
          : 'border-gray-300 focus:border-violet-400'"
        data-testid="cron-input"
        spellcheck="false"
        autocomplete="off"
      />
      <!-- Human-readable preview -->
      <p
        v-if="description"
        class="mt-1.5 text-xs text-green-600"
        data-testid="cron-description"
      >
        {{ description }}
      </p>
      <!-- Validation error -->
      <p
        v-else-if="cronError"
        class="mt-1.5 text-xs text-red-500"
        data-testid="cron-error"
      >
        {{ cronError }}
      </p>
    </div>

    <!-- Timezone selector -->
    <div>
      <label for="timezone-select" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Timezone
      </label>
      <select
        id="timezone-select"
        v-model="timezone"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        data-testid="timezone-select"
      >
        <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
      </select>
    </div>

    <!-- Save -->
    <div class="flex justify-end">
      <button
        type="button"
        class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!isValid || isSaving"
        data-testid="scheduler-save-btn"
        @click="save"
      >
        {{ isSaving ? "Saving…" : "Save Schedule" }}
      </button>
    </div>
  </section>
</template>
