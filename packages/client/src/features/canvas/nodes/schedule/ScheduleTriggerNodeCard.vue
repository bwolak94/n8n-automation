<template>
  <div class="space-y-4 rounded-xl border border-orange-200 bg-white dark:bg-gray-900 p-5"
    data-testid="schedule-trigger-card">

    <!-- Header -->
    <div class="flex items-center gap-2">
      <span class="text-lg">⏰</span>
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Schedule Trigger</h3>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400">
      Run this workflow on a recurring schedule. Trigger data is available via
      <code class="rounded bg-gray-100 dark:bg-gray-800 px-1"><span v-pre>{{ $trigger.scheduledAt }}</span></code>.
    </p>

    <!-- Timezone selector -->
    <div>
      <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Timezone</label>
      <input
        v-model="timezoneSearch"
        list="tz-list"
        placeholder="UTC"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
        data-testid="timezone-input"
        @change="onTimezoneChange"
      />
      <datalist id="tz-list">
        <option v-for="tz in COMMON_TIMEZONES" :key="tz" :value="tz" />
      </datalist>
    </div>

    <!-- Schedule list -->
    <div class="space-y-4">
      <div
        v-for="(_, idx) in schedules"
        :key="idx"
        class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
        :data-testid="`schedule-${idx}`"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Schedule {{ schedules.length > 1 ? idx + 1 : "" }}
          </span>
          <button
            v-if="schedules.length > 1"
            class="text-xs text-red-400 hover:text-red-600 transition-colors"
            :data-testid="`remove-schedule-${idx}`"
            @click="removeSchedule(idx)"
          >
            Remove
          </button>
        </div>

        <CronBuilder
          v-model="schedules[idx]"
          :timezone="selectedTimezone"
        />
      </div>
    </div>

    <!-- Add schedule button -->
    <button
      type="button"
      class="w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-2 text-xs text-gray-500 dark:text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
      data-testid="add-schedule-btn"
      @click="addSchedule"
    >
      + Add another schedule
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import CronBuilder from "./CronBuilder.vue";

// ─── Props / emits ────────────────────────────────────────────────────────────

interface Props {
  config?: {
    schedules?:  string[];
    timezone?:   string;
  };
}

const props = withDefaults(defineProps<Props>(), {
  config: () => ({}),
});

const emit = defineEmits<{
  "config-change": [config: { schedules: string[]; timezone: string }];
}>();

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ─── State ────────────────────────────────────────────────────────────────────

const schedules        = ref<string[]>(props.config.schedules?.length ? [...props.config.schedules] : ["0 9 * * *"]);
const selectedTimezone = ref<string>(props.config.timezone ?? "UTC");
const timezoneSearch   = ref<string>(selectedTimezone.value);

// ─── Actions ──────────────────────────────────────────────────────────────────

function addSchedule(): void {
  schedules.value.push("0 9 * * *");
}

function removeSchedule(idx: number): void {
  schedules.value.splice(idx, 1);
}

function onTimezoneChange(): void {
  const tz = timezoneSearch.value.trim();
  if (tz) selectedTimezone.value = tz;
}

// ─── Emit on change ───────────────────────────────────────────────────────────

watch(
  [schedules, selectedTimezone],
  () => {
    emit("config-change", {
      schedules: [...schedules.value],
      timezone:  selectedTimezone.value,
    });
  },
  { deep: true }
);
</script>
