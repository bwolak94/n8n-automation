<script setup lang="ts">
import { ref } from "vue";
import { useTenantStore } from "../../../stores/tenantStore.js";

const tenantStore = useTenantStore();
const orgName = ref("");
const timezone = ref("UTC");
const saved = ref(false);

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Warsaw",
  "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"];

function save(): void {
  // Persist to backend in a real implementation
  saved.value = true;
  setTimeout(() => { saved.value = false; }, 2000);
}
</script>

<template>
  <section class="max-w-lg" data-testid="org-settings-panel">
    <h2 class="mb-5 text-base font-semibold text-gray-800">Organisation Settings</h2>

    <div class="space-y-4">
      <div>
        <label for="org-name" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Organisation Name
        </label>
        <input
          id="org-name"
          v-model="orgName"
          type="text"
          placeholder="My Company"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          data-testid="org-name-input"
        />
      </div>

      <div>
        <label for="org-timezone" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Default Timezone
        </label>
        <select
          id="org-timezone"
          v-model="timezone"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          data-testid="org-timezone-select"
        >
          <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tenant ID
        </label>
        <p class="font-mono text-sm text-gray-500" data-testid="tenant-id">
          {{ tenantStore.tenantId ?? "—" }}
        </p>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          data-testid="org-save-btn"
          @click="save"
        >
          Save Changes
        </button>
        <span v-if="saved" class="text-sm text-green-600" data-testid="org-saved-msg">Saved!</span>
      </div>
    </div>
  </section>
</template>
