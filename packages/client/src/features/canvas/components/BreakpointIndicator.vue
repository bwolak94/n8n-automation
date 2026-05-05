<template>
  <button
    class="absolute -top-1.5 -left-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
    :class="active
      ? 'bg-red-500 hover:bg-red-600'
      : 'bg-gray-300 dark:bg-gray-600 hover:bg-red-400 dark:hover:bg-red-500 opacity-0 group-hover:opacity-100'"
    :title="active ? 'Remove breakpoint' : 'Add breakpoint'"
    :aria-label="active ? 'Remove breakpoint' : 'Add breakpoint'"
    :aria-pressed="active"
    @click.stop="emit('toggle')"
  >
    <!-- Filled dot when active -->
    <span
      v-if="active"
      class="h-1.5 w-1.5 rounded-full bg-white"
    />
  </button>
</template>

<script setup lang="ts">
interface Props {
  /** Whether a breakpoint is currently set on this node. */
  active: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>
