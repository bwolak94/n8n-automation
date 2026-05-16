import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { NodeDefinition } from "../shared/types/index.js";

export const useNodeRegistryStore = defineStore("nodeRegistry", () => {
  const definitions = ref<NodeDefinition[]>([]);
  const isLoaded = ref(false);

  // ── Getters ────────────────────────────────────────────────────────────────

  const byCategory = computed(() => {
    const map: Record<string, NodeDefinition[]> = {};
    for (const def of definitions.value) {
      if (!map[def.category]) {
        map[def.category] = [];
      }
      map[def.category]!.push(def);
    }
    return map;
  });

  const definitionByType = computed(() => {
    const map: Record<string, NodeDefinition> = {};
    for (const def of definitions.value) {
      map[def.type] = def;
    }
    return map;
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  function setDefinitions(defs: NodeDefinition[]): void {
    definitions.value = defs;
    isLoaded.value = true;
  }

  function getDefinition(type: string): NodeDefinition | undefined {
    return definitionByType.value[type];
  }

  function reset(): void {
    definitions.value = [];
    isLoaded.value = false;
  }

  return {
    definitions,
    isLoaded,
    byCategory,
    definitionByType,
    setDefinitions,
    getDefinition,
    reset,
  };
});
