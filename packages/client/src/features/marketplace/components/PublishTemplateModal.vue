<script setup lang="ts">
import { ref, reactive } from "vue";
import type { PublishTemplateInput } from "../../../shared/api/integrations.js";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Pass the workflow ID to pre-fill the form */
  workflowId?: string;
  workflowName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  workflowId:   "",
  workflowName: "",
});

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  publish: [data: PublishTemplateInput];
  cancel: [];
}>();

// ─── Form state ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "integrations", label: "Integrations" },
  { value: "ai",           label: "AI / ML" },
  { value: "data",         label: "Data" },
  { value: "logic",        label: "Logic" },
  { value: "communication", label: "Communication" },
  { value: "triggers",     label: "Triggers" },
  { value: "actions",      label: "Actions" },
] as const;

const form = reactive<PublishTemplateInput>({
  name:            props.workflowName,
  description:     "",
  longDescription: "",
  category:        "integrations",
  tags:            [],
  workflowId:      props.workflowId,
  repositoryUrl:   "",
});

const tagsInput  = ref("");
const submitting = ref(false);
const errors     = reactive<Partial<Record<keyof PublishTemplateInput, string>>>({});

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(): boolean {
  errors.name       = !form.name.trim()       ? "Name is required"        : undefined;
  errors.workflowId = !form.workflowId.trim() ? "Workflow ID is required" : undefined;
  errors.category   = !form.category          ? "Category is required"    : undefined;
  return !errors.name && !errors.workflowId && !errors.category;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function onTagsBlur(): void {
  form.tags = parseTags(tagsInput.value);
}

async function onSubmit(): Promise<void> {
  if (!validate()) return;
  submitting.value = true;
  try {
    emit("publish", {
      name:            form.name.trim(),
      description:     form.description?.trim() || undefined,
      longDescription: form.longDescription?.trim() || undefined,
      category:        form.category,
      tags:            form.tags,
      workflowId:      form.workflowId.trim(),
      repositoryUrl:   form.repositoryUrl?.trim() || undefined,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="publish-modal-title"
    data-testid="publish-template-modal"
    @keydown.esc="emit('cancel')"
  >
    <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <div class="mb-5">
        <h2 id="publish-modal-title" class="text-base font-semibold text-gray-900">
          Publish as Integration Template
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Share your workflow with the community. It will go through a review process before being visible in the marketplace.
        </p>
      </div>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">

        <!-- Template name -->
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700" for="pt-name">
            Template name <span class="text-red-500">*</span>
          </label>
          <input
            id="pt-name"
            v-model="form.name"
            type="text"
            maxlength="255"
            class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-100"
            :class="errors.name ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-violet-400'"
            data-testid="pt-name"
          />
          <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
        </div>

        <!-- Workflow ID -->
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700" for="pt-workflow-id">
            Workflow ID <span class="text-red-500">*</span>
          </label>
          <input
            id="pt-workflow-id"
            v-model="form.workflowId"
            type="text"
            class="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-violet-100"
            :class="errors.workflowId ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-violet-400'"
            placeholder="The workflow you want to share"
            data-testid="pt-workflow-id"
          />
          <p v-if="errors.workflowId" class="mt-1 text-xs text-red-500">{{ errors.workflowId }}</p>
        </div>

        <!-- Category -->
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700" for="pt-category">
            Category <span class="text-red-500">*</span>
          </label>
          <select
            id="pt-category"
            v-model="form.category"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            data-testid="pt-category"
          >
            <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </div>

        <!-- Short description -->
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700" for="pt-desc">
            Short description
          </label>
          <textarea
            id="pt-desc"
            v-model="form.description"
            rows="2"
            maxlength="2000"
            class="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            placeholder="What does this integration do?"
            data-testid="pt-description"
          />
        </div>

        <!-- Tags -->
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700" for="pt-tags">
            Tags <span class="text-gray-400">(comma-separated)</span>
          </label>
          <input
            id="pt-tags"
            v-model="tagsInput"
            type="text"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            placeholder="slack, email, crm"
            data-testid="pt-tags"
            @blur="onTagsBlur"
          />
        </div>

        <!-- Repository URL -->
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700" for="pt-repo">
            Repository URL <span class="text-gray-400">(optional)</span>
          </label>
          <input
            id="pt-repo"
            v-model="form.repositoryUrl"
            type="url"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            placeholder="https://github.com/you/repo"
            data-testid="pt-repo-url"
          />
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            data-testid="pt-cancel-btn"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            :disabled="submitting"
            data-testid="pt-submit-btn"
          >
            {{ submitting ? "Submitting…" : "Submit for Review" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
