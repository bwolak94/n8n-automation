import { shallowRef, computed } from "vue";

export function useUndoRedo<T>(maxHistory = 50) {
  const past = shallowRef<T[]>([]);
  const future = shallowRef<T[]>([]);

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  function push(snapshot: T): void {
    past.value = [...past.value, snapshot].slice(-maxHistory);
    future.value = [];
  }

  function undo(current: T): T | undefined {
    if (!canUndo.value) return undefined;
    const previous = past.value[past.value.length - 1];
    past.value = past.value.slice(0, -1);
    future.value = [current, ...future.value];
    return previous;
  }

  function redo(current: T): T | undefined {
    if (!canRedo.value) return undefined;
    const next = future.value[0];
    future.value = future.value.slice(1);
    past.value = [...past.value, current];
    return next;
  }

  function clear(): void {
    past.value = [];
    future.value = [];
  }

  return { past, future, canUndo, canRedo, push, undo, redo, clear };
}
