<script setup lang="ts">
import { computed } from "vue";

interface HumanApprovalConfig {
  reviewers?: string[];
  notificationChannel?: "email" | "slack" | "both";
  message?: string;
  timeoutHours?: number;
  timeoutAction?: "reject" | "approve";
  requireAll?: boolean;
}

const props = defineProps<{
  config: HumanApprovalConfig;
  selected?: boolean;
}>();

const channelIcon = computed(() => {
  switch (props.config.notificationChannel) {
    case "slack": return "💬";
    case "both":  return "📬";
    default:      return "📧";
  }
});

const channelLabel = computed(() => {
  switch (props.config.notificationChannel) {
    case "slack": return "Slack";
    case "both":  return "Email + Slack";
    default:      return "Email";
  }
});

const reviewerCount = computed(() => (props.config.reviewers ?? []).length);

const reviewerPreview = computed(() => {
  const list = props.config.reviewers ?? [];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return `${list[0]} +${list.length - 1} more`;
});

const timeoutLabel = computed(() => {
  const h = props.config.timeoutHours ?? 24;
  if (h >= 24 && h % 24 === 0) return `${h / 24}d`;
  return `${h}h`;
});

const messagePreview = computed(() => {
  const m = props.config.message ?? "";
  return m.length > 55 ? m.slice(0, 55) + "…" : m;
});
</script>

<template>
  <div
    class="rounded-xl border bg-white shadow-sm transition-shadow"
    :class="selected ? 'border-amber-400 shadow-amber-100 shadow-md' : 'border-gray-200 hover:shadow-md'"
    style="min-width: 220px; max-width: 260px;"
    role="article"
    :aria-label="`Human Approval node — ${reviewerCount} reviewer(s)`"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
      <span class="text-base" aria-hidden="true">👤</span>
      <span class="flex-1 truncate text-sm font-semibold text-gray-800">Human Approval</span>
      <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Human-in-loop
      </span>
    </div>

    <!-- Body -->
    <div class="space-y-2 px-3 py-2.5">

      <!-- Reviewer(s) -->
      <div v-if="reviewerPreview" class="rounded-md bg-amber-50 px-2 py-1.5">
        <p class="text-xs font-medium text-amber-600">Reviewer{{ reviewerCount !== 1 ? 's' : '' }}</p>
        <p class="mt-0.5 truncate text-xs text-amber-800">{{ reviewerPreview }}</p>
      </div>

      <!-- Message preview -->
      <div v-if="messagePreview" class="rounded-md bg-gray-50 px-2 py-1.5">
        <p class="text-xs font-medium text-gray-400">Message</p>
        <p class="mt-0.5 text-xs text-gray-700 line-clamp-2">{{ messagePreview }}</p>
      </div>

      <!-- Badges row -->
      <div class="flex flex-wrap items-center gap-1.5 pt-0.5">

        <!-- Notification channel -->
        <span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
          {{ channelIcon }} {{ channelLabel }}
        </span>

        <!-- Timeout -->
        <span
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          :title="`Timeout: ${config.timeoutHours ?? 24}h`"
        >
          ⏱ {{ timeoutLabel }}
        </span>

        <!-- Require all vs any -->
        <span
          v-if="config.requireAll"
          class="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
          title="All reviewers must approve (AND mode)"
        >
          AND
        </span>
        <span
          v-else
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          title="Any reviewer can approve (OR mode)"
        >
          OR
        </span>

        <!-- Timeout action -->
        <span
          v-if="config.timeoutAction === 'approve'"
          class="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600"
          title="Auto-approves on timeout"
        >
          auto-approve
        </span>
        <span
          v-else
          class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500"
          title="Auto-rejects on timeout"
        >
          auto-reject
        </span>
      </div>
    </div>
  </div>
</template>
