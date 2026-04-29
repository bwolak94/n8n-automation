<script setup lang="ts">
import { computed } from "vue";
import { useCancelExecution } from "../../../shared/queries/useExecutions.js";

interface Props {
  executionId: string;
  status: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ cancelled: [] }>();

const isRunning = computed(() => props.status === "running");

const { mutate: cancel, isPending } = useCancelExecution();

function handleCancel(): void {
  cancel(props.executionId, {
    onSuccess: () => emit("cancelled"),
  });
}
</script>

<template>
  <button
    v-if="isRunning"
    type="button"
    class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
    :disabled="isPending"
    data-testid="cancel-execution-btn"
    @click="handleCancel"
  >
    {{ isPending ? "Cancelling…" : "Cancel" }}
  </button>
</template>
