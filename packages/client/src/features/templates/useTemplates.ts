import { ref, computed } from "vue";
import {
  listTemplates,
  getTemplate,
  cloneTemplate,
  publishWorkflowAsTemplate,
} from "../../shared/api/templates.js";
import type { TemplateSummary, Template, ListTemplatesQuery } from "../../shared/api/templates.js";

export function useTemplates() {
  const templates = ref<TemplateSummary[]>([]);
  const total     = ref(0);
  const loading   = ref(false);
  const error     = ref<string | null>(null);
  const cloning   = ref<string | null>(null);

  const categories = computed(() => {
    const cats = new Set(templates.value.map((t) => t.category));
    return [...cats].sort();
  });

  async function fetchTemplates(query: ListTemplatesQuery = {}): Promise<void> {
    loading.value = true;
    error.value   = null;
    try {
      const result = await listTemplates(query);
      templates.value = result.items;
      total.value     = result.total;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load templates";
    } finally {
      loading.value = false;
    }
  }

  async function fetchTemplate(id: string): Promise<Template | null> {
    try {
      return await getTemplate(id);
    } catch {
      return null;
    }
  }

  async function clone(
    templateId: string
  ): Promise<{ workflowId: string; name: string } | null> {
    cloning.value = templateId;
    try {
      return await cloneTemplate(templateId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Clone failed";
      return null;
    } finally {
      cloning.value = null;
    }
  }

  async function publish(payload: {
    workflowId: string;
    category: string;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<Template | null> {
    try {
      return await publishWorkflowAsTemplate(payload);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Publish failed";
      return null;
    }
  }

  return {
    templates,
    total,
    loading,
    error,
    cloning,
    categories,
    fetchTemplates,
    fetchTemplate,
    clone,
    publish,
  };
}
