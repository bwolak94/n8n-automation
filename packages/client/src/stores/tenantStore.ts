import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useTenantStore = defineStore("tenant", () => {
  const tenantId = ref<string | null>(null);
  const role = ref<string | null>(null);
  const plan = ref<string | null>(null);

  // ── Getters ────────────────────────────────────────────────────────────────

  const isOwner = computed(() => role.value === "owner");
  const isAdmin = computed(
    () => role.value === "owner" || role.value === "admin"
  );
  const canEdit = computed(
    () => role.value === "owner" || role.value === "admin" || role.value === "editor"
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  function setTenant(
    id: string,
    tenantRole: string,
    tenantPlan: string | null = null
  ): void {
    tenantId.value = id;
    role.value = tenantRole;
    plan.value = tenantPlan;
  }

  function clear(): void {
    tenantId.value = null;
    role.value = null;
    plan.value = null;
  }

  return { tenantId, role, plan, isOwner, isAdmin, canEdit, setTenant, clear };
});
