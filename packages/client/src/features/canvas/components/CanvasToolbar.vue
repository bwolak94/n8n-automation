<script setup lang="ts">
import { useCanvasStore } from "../../../stores/canvasStore.js";

const canvasStore = useCanvasStore();

interface Emits {
  (e: "save"): void;
  (e: "execute"): void;
  (e: "zoom-in"): void;
  (e: "zoom-out"): void;
  (e: "fit-view"): void;
}

const emit = defineEmits<Emits>();
</script>

<template>
  <header
    class="flex h-12 flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3"
    data-testid="canvas-toolbar"
    role="toolbar"
    aria-label="Canvas toolbar"
  >
    <!-- Save -->
    <button
      type="button"
      class="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      :class="canvasStore.isDirty ? 'text-violet-600' : 'text-gray-600'"
      :disabled="!canvasStore.isDirty"
      data-testid="toolbar-save"
      title="Save (⌘S)"
      @click="emit('save')"
    >
      💾 Save{{ canvasStore.isDirty ? " *" : "" }}
    </button>

    <!-- Execute -->
    <button
      type="button"
      class="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
      data-testid="toolbar-execute"
      title="Run workflow"
      @click="emit('execute')"
    >
      ▶ Run
    </button>

    <div class="mx-1 h-6 w-px bg-gray-200" role="separator" />

    <!-- Undo -->
    <button
      type="button"
      class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="!canvasStore.canUndo"
      data-testid="toolbar-undo"
      title="Undo (⌘Z)"
      aria-label="Undo"
      @click="canvasStore.undo()"
    >
      ↩
    </button>

    <!-- Redo -->
    <button
      type="button"
      class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="!canvasStore.canRedo"
      data-testid="toolbar-redo"
      title="Redo (⌘⇧Z)"
      aria-label="Redo"
      @click="canvasStore.redo()"
    >
      ↪
    </button>

    <div class="mx-1 h-6 w-px bg-gray-200" role="separator" />

    <!-- Zoom controls -->
    <button
      type="button"
      class="rounded p-1.5 text-gray-500 hover:bg-gray-100"
      data-testid="toolbar-zoom-in"
      title="Zoom in"
      aria-label="Zoom in"
      @click="emit('zoom-in')"
    >
      +
    </button>

    <button
      type="button"
      class="rounded p-1.5 text-gray-500 hover:bg-gray-100"
      data-testid="toolbar-zoom-out"
      title="Zoom out"
      aria-label="Zoom out"
      @click="emit('zoom-out')"
    >
      −
    </button>

    <button
      type="button"
      class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
      data-testid="toolbar-fit-view"
      title="Fit to view"
      aria-label="Fit to view"
      @click="emit('fit-view')"
    >
      Fit
    </button>

    <!-- Dirty indicator -->
    <div class="ml-auto flex items-center gap-1 text-xs text-gray-400">
      <span
        v-if="canvasStore.isDirty"
        class="h-1.5 w-1.5 rounded-full bg-amber-400"
        aria-hidden="true"
      />
      <span v-if="canvasStore.isDirty" data-testid="unsaved-indicator">Unsaved changes</span>
    </div>
  </header>
</template>
