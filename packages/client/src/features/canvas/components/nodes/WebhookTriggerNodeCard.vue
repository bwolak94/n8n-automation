<script setup lang="ts">
import { ref, computed } from "vue";
import { apiClient } from "../../../../shared/api/client.js";
import type { WebhookResponse } from "@automation-hub/shared";

const props = defineProps<{
  nodeId: string;
  workflowId: string;
  config?: {
    webhookId?: string;
    method?: string;
    secret?: string;
  };
}>();

const emit = defineEmits<{
  (e: "config-change", config: Record<string, unknown>): void;
}>();

const webhookRecord = ref<WebhookResponse | null>(null);
const isRegistering = ref(false);
const copied = ref(false);
const method = ref(props.config?.method ?? "ANY");
const secret = ref(props.config?.secret ?? "");
const showSecret = ref(false);
const error = ref<string | null>(null);

const webhookUrl = computed(() => webhookRecord.value?.url ?? null);

const methods = ["ANY", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function registerWebhook(): Promise<void> {
  isRegistering.value = true;
  error.value = null;
  try {
    const result = await apiClient
      .post("webhooks", {
        json: {
          workflowId: props.workflowId,
          method: method.value,
          secret: secret.value || undefined,
        },
      })
      .json<WebhookResponse>();

    webhookRecord.value = result;
    emit("config-change", {
      webhookId: result.webhookId,
      method: method.value,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to register webhook";
  } finally {
    isRegistering.value = false;
  }
}

async function copyUrl(): Promise<void> {
  if (!webhookUrl.value) return;
  await navigator.clipboard.writeText(webhookUrl.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <div class="space-y-4 rounded-xl border border-violet-200 bg-white p-5" data-testid="webhook-trigger-card">
    <div class="flex items-center gap-2">
      <span class="text-lg">🪝</span>
      <h3 class="text-sm font-semibold text-gray-800">Webhook Trigger</h3>
    </div>

    <p class="text-xs text-gray-500">
      Receive HTTP requests at a unique URL to trigger this workflow.
      Trigger data is available via <code class="rounded bg-gray-100 px-1"><span v-pre>{{ $trigger.body }}</span></code>.
    </p>

    <!-- Method selector -->
    <div>
      <label class="mb-1 block text-xs font-medium text-gray-600">Accepted Method</label>
      <select
        v-model="method"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        data-testid="method-select"
      >
        <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
      </select>
    </div>

    <!-- Secret for HMAC -->
    <div>
      <label class="mb-1 block text-xs font-medium text-gray-600">
        HMAC Secret <span class="text-gray-400">(optional)</span>
      </label>
      <div class="relative">
        <input
          v-model="secret"
          :type="showSecret ? 'text' : 'password'"
          placeholder="Minimum 8 characters"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-violet-400 focus:outline-none"
          data-testid="secret-input"
          autocomplete="off"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
          @click="showSecret = !showSecret"
        >
          {{ showSecret ? "hide" : "show" }}
        </button>
      </div>
      <p class="mt-1 text-xs text-gray-400">
        Validates incoming requests via <code>X-Hub-Signature-256</code> header (GitHub-compatible).
      </p>
    </div>

    <!-- Register button -->
    <button
      v-if="!webhookRecord"
      type="button"
      class="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      :disabled="isRegistering"
      data-testid="register-btn"
      @click="registerWebhook"
    >
      {{ isRegistering ? "Registering…" : "Register Webhook URL" }}
    </button>

    <!-- Webhook URL display -->
    <div v-if="webhookUrl" class="rounded-lg border border-green-200 bg-green-50 p-3">
      <div class="mb-1 flex items-center justify-between">
        <span class="text-xs font-medium text-green-700">Webhook URL</span>
        <button
          type="button"
          class="text-xs text-green-600 hover:text-green-800"
          data-testid="copy-url-btn"
          @click="copyUrl"
        >
          {{ copied ? "Copied!" : "Copy" }}
        </button>
      </div>
      <code class="block break-all text-xs text-green-800" data-testid="webhook-url">
        {{ webhookUrl }}
      </code>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-xs text-red-500" data-testid="webhook-error">{{ error }}</p>
  </div>
</template>
