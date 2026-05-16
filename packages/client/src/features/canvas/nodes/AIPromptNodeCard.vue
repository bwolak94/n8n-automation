<script setup lang="ts">
import { computed } from "vue";

interface AIPromptMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIPromptConfig {
  provider?: "anthropic" | "openai" | "google";
  model?: string;
  systemPrompt?: string;
  messages?: AIPromptMessage[];
  responseFormat?: "text" | "json" | "structured";
  temperature?: number;
  maxTokens?: number;
  fallbackProvider?: string;
}

const props = defineProps<{
  config: AIPromptConfig;
  selected?: boolean;
}>();

const providerLabel = computed(() => {
  switch (props.config.provider) {
    case "anthropic": return "Claude";
    case "openai":    return "GPT";
    case "google":    return "Gemini";
    default:          return "AI";
  }
});

const providerColor = computed(() => {
  switch (props.config.provider) {
    case "anthropic": return "bg-orange-100 text-orange-700";
    case "openai":    return "bg-green-100 text-green-700";
    case "google":    return "bg-blue-100 text-blue-700";
    default:          return "bg-gray-100 text-gray-600";
  }
});

const providerIcon = computed(() => {
  switch (props.config.provider) {
    case "anthropic": return "🤖";
    case "openai":    return "✨";
    case "google":    return "💡";
    default:          return "🧠";
  }
});

const modelShort = computed(() => {
  const m = props.config.model ?? "";
  if (m.includes("claude-sonnet")) return "Sonnet";
  if (m.includes("claude-opus"))   return "Opus";
  if (m.includes("claude-haiku"))  return "Haiku";
  if (m.includes("gpt-4o-mini"))   return "4o-mini";
  if (m.includes("gpt-4o"))        return "4o";
  if (m.includes("gpt-4"))         return "GPT-4";
  if (m.includes("gemini-pro"))    return "Pro";
  if (m.includes("gemini-flash"))  return "Flash";
  return m.length > 12 ? m.slice(0, 12) + "…" : m;
});

const systemPreview = computed(() => {
  const s = props.config.systemPrompt ?? "";
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
});

const userMessage = computed(() => {
  const msgs = props.config.messages ?? [];
  const first = msgs.find((m) => m.role === "user");
  if (!first) return null;
  return first.content.length > 50 ? first.content.slice(0, 50) + "…" : first.content;
});

const messageCount = computed(() => (props.config.messages ?? []).length);

const fewShotCount = computed(() => {
  const msgs = props.config.messages ?? [];
  const pairs = msgs.filter((m) => m.role === "assistant").length;
  return pairs;
});

const formatBadgeClass = computed(() => {
  switch (props.config.responseFormat) {
    case "json":       return "bg-yellow-100 text-yellow-700";
    case "structured": return "bg-purple-100 text-purple-700";
    default:           return "bg-gray-100 text-gray-500";
  }
});

const formatLabel = computed(() => {
  switch (props.config.responseFormat) {
    case "json":       return "JSON";
    case "structured": return "Structured";
    default:           return "Text";
  }
});
</script>

<template>
  <div
    class="rounded-xl border bg-white shadow-sm transition-shadow"
    :class="selected ? 'border-indigo-400 shadow-indigo-100 shadow-md' : 'border-gray-200 hover:shadow-md'"
    style="min-width: 220px; max-width: 260px;"
    role="article"
    :aria-label="`AI Prompt node — ${providerLabel} ${modelShort}`"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
      <span class="text-base" aria-hidden="true">{{ providerIcon }}</span>
      <span class="flex-1 truncate text-sm font-semibold text-gray-800">AI Prompt</span>
      <span
        class="rounded-full px-2 py-0.5 text-xs font-medium"
        :class="providerColor"
      >
        {{ providerLabel }}
      </span>
    </div>

    <!-- Body -->
    <div class="space-y-2 px-3 py-2.5">

      <!-- Model -->
      <div v-if="config.model" class="flex items-center gap-1.5">
        <span class="text-xs text-gray-400">Model</span>
        <span class="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
          {{ modelShort }}
        </span>
      </div>

      <!-- System prompt preview -->
      <div v-if="systemPreview" class="rounded-md bg-indigo-50 px-2 py-1.5">
        <p class="text-xs font-medium text-indigo-600">System</p>
        <p class="mt-0.5 truncate text-xs text-indigo-800">{{ systemPreview }}</p>
      </div>

      <!-- User message preview -->
      <div v-if="userMessage" class="rounded-md bg-gray-50 px-2 py-1.5">
        <p class="text-xs font-medium text-gray-500">User</p>
        <p class="mt-0.5 text-xs text-gray-700 line-clamp-2">{{ userMessage }}</p>
      </div>

      <!-- Stats row -->
      <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
        <!-- Message count -->
        <span
          v-if="messageCount > 0"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          :title="`${messageCount} message(s)`"
        >
          {{ messageCount }} msg{{ messageCount !== 1 ? "s" : "" }}
        </span>

        <!-- Few-shot count -->
        <span
          v-if="fewShotCount > 0"
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
          :title="`${fewShotCount} few-shot example(s)`"
        >
          {{ fewShotCount }} example{{ fewShotCount !== 1 ? "s" : "" }}
        </span>

        <!-- Response format -->
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="formatBadgeClass"
        >
          {{ formatLabel }}
        </span>

        <!-- Temperature -->
        <span
          v-if="config.temperature !== undefined"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          :title="`Temperature: ${config.temperature}`"
        >
          T={{ config.temperature }}
        </span>

        <!-- Max tokens -->
        <span
          v-if="config.maxTokens"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          :title="`Max tokens: ${config.maxTokens}`"
        >
          {{ config.maxTokens }}tk
        </span>

        <!-- Fallback indicator -->
        <span
          v-if="config.fallbackProvider"
          class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500"
          title="Fallback provider configured"
        >
          ↩ fallback
        </span>
      </div>
    </div>
  </div>
</template>
