<script setup lang="ts">
import { computed } from "vue";
import { Form as VeeForm, Field } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { useCanvasStore } from "../../../stores/canvasStore.js";
import { useNodeRegistryStore } from "../../../stores/nodeRegistryStore.js";

const canvasStore = useCanvasStore();
const registryStore = useNodeRegistryStore();

const selectedNode = computed(() => canvasStore.selectedNode);

const nodeDef = computed(() =>
  selectedNode.value ? registryStore.getDefinition(selectedNode.value.type) : undefined
);

interface SchemaField {
  key: string;
  fieldType: "string" | "number" | "enum";
  label: string;
  options?: string[];
}

const fields = computed((): SchemaField[] => {
  const schema = nodeDef.value?.configSchema as Record<string, unknown> | undefined;
  if (!schema) return [];
  const properties = schema["properties"] as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return [];

  return Object.entries(properties).map(([key, field]) => ({
    key,
    fieldType: field["enum"]
      ? "enum"
      : field["type"] === "number"
        ? "number"
        : "string",
    label: (field["title"] as string) ?? key,
    options: field["enum"] as string[] | undefined,
  }));
});

function buildZodSchema(): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const f of fields.value) {
    shape[f.key] = f.fieldType === "number"
      ? z.coerce.number().optional()
      : z.string().optional();
  }
  return z.object(shape);
}

// Reactive validation schema — VeeValidate Form accepts ComputedRef
const validationSchema = computed(() => toTypedSchema(buildZodSchema()));

// Seed form with current node config
const initialValues = computed(() => (selectedNode.value?.config ?? {}) as Record<string, unknown>);

function onSubmit(values: Record<string, unknown>): void {
  if (!selectedNode.value) return;
  canvasStore.updateNodeConfig(selectedNode.value.id, values);
  canvasStore.selectNode(null);
}

function close(): void {
  canvasStore.selectNode(null);
}
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-200 ease-out"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-150 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <aside
      v-if="selectedNode"
      class="absolute inset-y-0 right-0 z-10 flex w-80 flex-col border-l border-gray-200 bg-white shadow-lg"
      data-testid="node-config-panel"
      role="complementary"
      :aria-label="`Configure ${selectedNode.type} node`"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 class="text-sm font-semibold text-gray-800" data-testid="panel-title">
          {{ nodeDef?.label ?? selectedNode.type }}
        </h2>
        <button
          type="button"
          class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          data-testid="panel-close"
          aria-label="Close panel"
          @click="close"
        >
          ✕
        </button>
      </div>

      <!-- Form -->
      <VeeForm
        :validation-schema="validationSchema"
        :initial-values="initialValues"
        class="flex flex-1 flex-col overflow-y-auto"
        data-testid="config-form"
        @submit="onSubmit"
      >
        <div class="flex-1 space-y-4 px-4 py-4">
          <p
            v-if="fields.length === 0"
            class="text-sm text-gray-500"
            data-testid="no-config-message"
          >
            No configuration required
          </p>

          <div
            v-for="field in fields"
            :key="field.key"
            :data-testid="`field-${field.key}`"
          >
            <label
              :for="`config-${field.key}`"
              class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              {{ field.label }}
            </label>

            <Field
              v-if="field.fieldType === 'string'"
              :id="`config-${field.key}`"
              :name="field.key"
              type="text"
              class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
              :data-testid="`input-${field.key}`"
            />

            <Field
              v-else-if="field.fieldType === 'number'"
              :id="`config-${field.key}`"
              :name="field.key"
              as="input"
              type="number"
              class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
              :data-testid="`input-${field.key}`"
            />

            <Field
              v-else-if="field.fieldType === 'enum'"
              :id="`config-${field.key}`"
              :name="field.key"
              as="select"
              class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
              :data-testid="`input-${field.key}`"
            >
              <option value="">-- select --</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">
                {{ opt }}
              </option>
            </Field>
          </div>
        </div>

        <div class="border-t border-gray-100 px-4 py-3">
          <button
            type="submit"
            class="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none"
            data-testid="config-save"
          >
            Save
          </button>
        </div>
      </VeeForm>
    </aside>
  </Transition>
</template>
