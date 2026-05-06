<script setup lang="ts">
import { computed } from "vue";

interface FileStorageConfig {
  provider?: "s3" | "gcs" | "local";
  bucket?: string;
  key?: string;
  operation?: "upload" | "download" | "delete" | "list" | "signedUrl" | "metadata";
  contentEncoding?: "utf8" | "base64";
  contentType?: string;
  signedUrlExpiresIn?: number;
  maxKeys?: number;
  listPrefix?: string;
}

const props = defineProps<{
  config: FileStorageConfig;
  selected?: boolean;
}>();

const providerIcon = computed(() => {
  switch (props.config.provider) {
    case "s3":    return "🪣";
    case "gcs":   return "☁️";
    case "local": return "💾";
    default:      return "📁";
  }
});

const providerLabel = computed(() => {
  switch (props.config.provider) {
    case "s3":    return "S3";
    case "gcs":   return "GCS";
    case "local": return "Local";
    default:      return "Storage";
  }
});

const providerColor = computed(() => {
  switch (props.config.provider) {
    case "s3":    return "bg-orange-100 text-orange-700";
    case "gcs":   return "bg-blue-100 text-blue-700";
    case "local": return "bg-gray-100 text-gray-600";
    default:      return "bg-gray-100 text-gray-600";
  }
});

const operationIcon = computed(() => {
  switch (props.config.operation) {
    case "upload":    return "⬆️";
    case "download":  return "⬇️";
    case "delete":    return "🗑️";
    case "list":      return "📋";
    case "signedUrl": return "🔗";
    case "metadata":  return "ℹ️";
    default:          return "⚙️";
  }
});

const operationLabel = computed(() => {
  switch (props.config.operation) {
    case "upload":    return "Upload";
    case "download":  return "Download";
    case "delete":    return "Delete";
    case "list":      return "List";
    case "signedUrl": return "Signed URL";
    case "metadata":  return "Metadata";
    default:          return props.config.operation ?? "—";
  }
});

const operationColor = computed(() => {
  switch (props.config.operation) {
    case "upload":    return "bg-green-100 text-green-700";
    case "download":  return "bg-blue-100 text-blue-700";
    case "delete":    return "bg-red-100 text-red-700";
    case "list":      return "bg-purple-100 text-purple-700";
    case "signedUrl": return "bg-yellow-100 text-yellow-700";
    case "metadata":  return "bg-gray-100 text-gray-600";
    default:          return "bg-gray-100 text-gray-600";
  }
});

const keyPreview = computed(() => {
  const k = props.config.key ?? "";
  return k.length > 32 ? "…" + k.slice(-30) : k;
});

const bucketPreview = computed(() => {
  const b = props.config.bucket ?? "";
  return b.length > 24 ? b.slice(0, 22) + "…" : b;
});

const showExpiresIn = computed(
  () => props.config.operation === "signedUrl" && props.config.signedUrlExpiresIn !== undefined
);

const expiresLabel = computed(() => {
  const secs = props.config.signedUrlExpiresIn ?? 3600;
  if (secs >= 3600) return `${secs / 3600}h`;
  if (secs >= 60)   return `${Math.floor(secs / 60)}m`;
  return `${secs}s`;
});
</script>

<template>
  <div
    class="rounded-xl border bg-white shadow-sm transition-shadow"
    :class="selected ? 'border-cyan-400 shadow-cyan-100 shadow-md' : 'border-gray-200 hover:shadow-md'"
    style="min-width: 220px; max-width: 260px;"
    role="article"
    :aria-label="`File Storage node — ${providerLabel} ${operationLabel}`"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
      <span class="text-base" aria-hidden="true">{{ providerIcon }}</span>
      <span class="flex-1 truncate text-sm font-semibold text-gray-800">File Storage</span>
      <span
        class="rounded-full px-2 py-0.5 text-xs font-medium"
        :class="providerColor"
      >
        {{ providerLabel }}
      </span>
    </div>

    <!-- Body -->
    <div class="space-y-2 px-3 py-2.5">

      <!-- Operation -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs" aria-hidden="true">{{ operationIcon }}</span>
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="operationColor"
        >
          {{ operationLabel }}
        </span>
      </div>

      <!-- Bucket -->
      <div v-if="config.bucket" class="flex items-center gap-1.5">
        <span class="text-xs text-gray-400">Bucket</span>
        <span class="ml-auto max-w-[140px] truncate rounded bg-gray-50 px-1.5 py-0.5 text-xs font-mono text-gray-700">
          {{ bucketPreview }}
        </span>
      </div>

      <!-- Key -->
      <div v-if="keyPreview && config.operation !== 'list'" class="rounded-md bg-gray-50 px-2 py-1.5">
        <p class="text-xs font-medium text-gray-400">Key</p>
        <p class="mt-0.5 truncate text-xs font-mono text-gray-700">{{ keyPreview }}</p>
      </div>

      <!-- List prefix -->
      <div
        v-if="config.operation === 'list' && config.listPrefix"
        class="rounded-md bg-purple-50 px-2 py-1.5"
      >
        <p class="text-xs font-medium text-purple-500">Prefix</p>
        <p class="mt-0.5 truncate text-xs font-mono text-purple-800">{{ config.listPrefix }}</p>
      </div>

      <!-- Badges -->
      <div class="flex flex-wrap items-center gap-1.5 pt-0.5">

        <!-- Content type -->
        <span
          v-if="config.contentType && config.operation === 'upload'"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          :title="`Content-Type: ${config.contentType}`"
        >
          {{ config.contentType }}
        </span>

        <!-- Encoding -->
        <span
          v-if="config.contentEncoding === 'base64'"
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
        >
          base64
        </span>

        <!-- Max keys -->
        <span
          v-if="config.operation === 'list' && config.maxKeys"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          :title="`Max ${config.maxKeys} results`"
        >
          max {{ config.maxKeys }}
        </span>

        <!-- Signed URL expiry -->
        <span
          v-if="showExpiresIn"
          class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700"
          :title="`URL expires in ${config.signedUrlExpiresIn} seconds`"
        >
          ⏱ {{ expiresLabel }}
        </span>
      </div>
    </div>
  </div>
</template>
