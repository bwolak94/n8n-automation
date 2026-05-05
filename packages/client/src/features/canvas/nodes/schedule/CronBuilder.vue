<template>
  <div class="space-y-3" data-testid="cron-builder">
    <!-- Mode tabs -->
    <div class="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      <button
        v-for="m in MODES"
        :key="m.id"
        class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="mode === m.id
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        :data-testid="`mode-tab-${m.id}`"
        @click="mode = m.id"
      >
        {{ m.label }}
      </button>
    </div>

    <!-- Preset chips -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="preset in PRESETS"
        :key="preset.cron"
        class="rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        :data-testid="`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`"
        @click="applyPreset(preset.cron)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Simple mode -->
    <div v-if="mode === 'simple'" class="space-y-2" data-testid="simple-mode">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm text-gray-600 dark:text-gray-400">Repeat every</span>

        <template v-if="simple.type === 'minutes' || simple.type === 'hours'">
          <input
            v-model.number="simple.value"
            type="number"
            min="1"
            :max="simple.type === 'minutes' ? 59 : 23"
            class="w-16 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-center focus:border-indigo-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
            data-testid="simple-value"
          />
        </template>

        <select
          v-model="simple.type"
          class="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
          data-testid="simple-type"
        >
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="daily">day</option>
          <option value="weekly">week</option>
          <option value="monthly">month</option>
        </select>
      </div>

      <!-- Weekly: day selector -->
      <div v-if="simple.type === 'weekly'" class="flex flex-wrap gap-1.5">
        <button
          v-for="(day, idx) in WEEKDAY_LABELS"
          :key="idx"
          class="rounded-full w-8 h-8 text-xs font-medium border transition-colors"
          :class="simple.weekday === idx
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400'"
          :data-testid="`weekday-${idx}`"
          @click="simple.weekday = idx"
        >
          {{ day }}
        </button>
      </div>

      <!-- Monthly: day of month -->
      <div v-if="simple.type === 'monthly'" class="flex items-center gap-2">
        <span class="text-sm text-gray-600 dark:text-gray-400">on day</span>
        <input
          v-model.number="simple.day"
          type="number"
          min="1"
          max="31"
          class="w-16 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-center focus:border-indigo-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
          data-testid="simple-day"
        />
      </div>

      <!-- Time picker for daily/weekly/monthly -->
      <div v-if="simple.type === 'daily' || simple.type === 'weekly' || simple.type === 'monthly'"
        class="flex items-center gap-2">
        <span class="text-sm text-gray-600 dark:text-gray-400">at</span>
        <input
          v-model="simple.time"
          type="time"
          class="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
          data-testid="simple-time"
        />
      </div>
    </div>

    <!-- Advanced mode -->
    <div v-else-if="mode === 'advanced'" class="space-y-2" data-testid="advanced-mode">
      <div
        v-for="field in CRON_FIELDS"
        :key="field.key"
        class="flex items-center gap-3"
      >
        <span class="w-28 text-xs font-medium text-gray-600 dark:text-gray-400">{{ field.label }}</span>
        <input
          v-model="advanced[field.key]"
          type="text"
          :placeholder="field.placeholder"
          class="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm font-mono focus:border-indigo-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
          :data-testid="`advanced-${field.key}`"
        />
        <span class="text-xs text-gray-400">{{ field.hint }}</span>
      </div>
    </div>

    <!-- Raw mode -->
    <div v-else class="space-y-1" data-testid="raw-mode">
      <input
        v-model="rawCron"
        type="text"
        placeholder="* * * * *"
        class="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-mono focus:border-indigo-400 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
        data-testid="raw-input"
      />
      <p class="text-xs text-gray-400">minute hour day month weekday</p>
    </div>

    <!-- Current cron string display -->
    <div class="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <code class="text-xs font-mono text-indigo-600 dark:text-indigo-400" data-testid="cron-output">
          {{ cronString }}
        </code>
        <span
          v-if="validationError"
          class="text-xs text-red-500"
          data-testid="validation-error"
        >{{ validationError }}</span>
      </div>
    </div>

    <!-- Human-readable summary -->
    <div
      v-if="humanReadable && !validationError"
      class="text-sm text-gray-700 dark:text-gray-300 font-medium"
      data-testid="human-readable"
    >
      {{ humanReadable }}
    </div>

    <!-- Next runs preview -->
    <div v-if="nextRuns.length > 0 && !validationError">
      <p class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Next 5 runs</p>
      <ul class="space-y-0.5">
        <li
          v-for="(run, i) in nextRuns"
          :key="i"
          class="text-xs text-gray-600 dark:text-gray-400 font-mono"
          :data-testid="`next-run-${i}`"
        >
          {{ run }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import { isValidCron } from "cron-validator";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "simple" | "advanced" | "raw";
type SimpleType = "minutes" | "hours" | "daily" | "weekly" | "monthly";

interface SimpleConfig {
  type:    SimpleType;
  value:   number;
  time:    string;
  weekday: number;
  day:     number;
}

interface AdvancedConfig {
  minute:  string;
  hour:    string;
  day:     string;
  month:   string;
  weekday: string;
}

// ─── Props / emits ────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  modelValue: string;
  timezone?:  string;
}>(), {
  timezone: "UTC",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = [
  { id: "simple" as Mode,   label: "Simple"   },
  { id: "advanced" as Mode, label: "Advanced" },
  { id: "raw" as Mode,      label: "Raw"      },
] as const;

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CRON_FIELDS = [
  { key: "minute" as const,  label: "Minute",       placeholder: "0",  hint: "0–59" },
  { key: "hour" as const,    label: "Hour",          placeholder: "*",  hint: "0–23" },
  { key: "day" as const,     label: "Day of month",  placeholder: "*",  hint: "1–31" },
  { key: "month" as const,   label: "Month",         placeholder: "*",  hint: "1–12" },
  { key: "weekday" as const, label: "Day of week",   placeholder: "*",  hint: "0–6 (Sun=0)" },
];

const PRESETS = [
  { label: "Every minute", cron: "* * * * *"   },
  { label: "Every hour",   cron: "0 * * * *"   },
  { label: "Daily 00:00",  cron: "0 0 * * *"   },
  { label: "Weekdays 9am", cron: "0 9 * * 1-5" },
  { label: "Weekly Mon",   cron: "0 9 * * 1"   },
  { label: "Monthly 1st",  cron: "0 0 1 * *"   },
];

// ─── State ────────────────────────────────────────────────────────────────────

const mode = ref<Mode>("simple");

const simple = reactive<SimpleConfig>({
  type:    "daily",
  value:   1,
  time:    "09:00",
  weekday: 1,
  day:     1,
});

const advanced = reactive<AdvancedConfig>({
  minute:  "0",
  hour:    "*",
  day:     "*",
  month:   "*",
  weekday: "*",
});

const rawCron = ref(props.modelValue || "0 9 * * *");

// ─── Derived cron string ──────────────────────────────────────────────────────

const cronString = computed<string>(() => {
  if (mode.value === "raw") return rawCron.value.trim();
  if (mode.value === "advanced") {
    const { minute, hour, day, month, weekday } = advanced;
    return `${minute} ${hour} ${day} ${month} ${weekday}`;
  }
  // Simple mode
  return buildSimpleCron(simple);
});

function buildSimpleCron(cfg: SimpleConfig): string {
  const [h, m] = (cfg.time || "00:00").split(":").map(Number);
  const hour   = String(h ?? 0);
  const min    = String(m ?? 0);

  switch (cfg.type) {
    case "minutes": return `*/${cfg.value} * * * *`;
    case "hours":   return `0 */${cfg.value} * * *`;
    case "daily":   return `${min} ${hour} * * *`;
    case "weekly":  return `${min} ${hour} * * ${cfg.weekday}`;
    case "monthly": return `${min} ${hour} ${cfg.day} * *`;
    default:        return "0 9 * * *";
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const validationError = computed<string | null>(() => {
  const expr = cronString.value;
  if (!expr) return "Cron expression is required";
  const valid = isValidCron(expr, { allowBlankDay: true, alias: false });
  if (!valid) return "Invalid cron expression";
  return null;
});

// ─── Human-readable ───────────────────────────────────────────────────────────

const humanReadable = computed<string>(() => {
  if (validationError.value) return "";
  try {
    return cronstrue.toString(cronString.value, { use24HourTimeFormat: true });
  } catch {
    return "";
  }
});

// ─── Next runs ────────────────────────────────────────────────────────────────

const nextRuns = computed<string[]>(() => {
  if (validationError.value) return [];
  try {
    const interval = CronExpressionParser.parse(cronString.value, { tz: props.timezone });
    const runs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const next = interval.next();
      runs.push(next.toDate().toLocaleString("en-US", {
        weekday: "short",
        year:    "numeric",
        month:   "short",
        day:     "numeric",
        hour:    "2-digit",
        minute:  "2-digit",
        timeZone: props.timezone,
      }));
    }
    return runs;
  } catch {
    return [];
  }
});

// ─── Sync with parent ─────────────────────────────────────────────────────────

watch(cronString, (val) => {
  if (!validationError.value) {
    emit("update:modelValue", val);
  }
}, { immediate: true });

// ─── Apply preset ─────────────────────────────────────────────────────────────

function applyPreset(cron: string): void {
  rawCron.value = cron;
  // Sync advanced fields
  const parts = cron.split(/\s+/);
  if (parts.length === 5) {
    const [min, hr, d, mo, wd] = parts as [string, string, string, string, string];
    advanced.minute  = min;
    advanced.hour    = hr;
    advanced.day     = d;
    advanced.month   = mo;
    advanced.weekday = wd;
  }
  // If in simple mode, switch to raw so preset is shown immediately
  if (mode.value !== "advanced") {
    mode.value = "raw";
    rawCron.value = cron;
  }
}

// ─── Expose for tests ─────────────────────────────────────────────────────────

defineExpose({ cronString, humanReadable, nextRuns, validationError, buildSimpleCron });
</script>
