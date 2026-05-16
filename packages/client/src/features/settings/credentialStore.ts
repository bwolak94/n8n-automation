import { defineStore } from "pinia";
import { ref } from "vue";
import type { CredentialCreate, CredentialUpdate, CredentialResponse } from "@automation-hub/shared";
import {
  fetchCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
  testCredential,
} from "../../shared/api/credentials.js";

export const useCredentialStore = defineStore("credentials", () => {
  const items = ref<CredentialResponse[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await fetchCredentials();
      items.value = result.items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load credentials";
    } finally {
      isLoading.value = false;
    }
  }

  async function add(data: CredentialCreate): Promise<CredentialResponse> {
    const credential = await createCredential(data);
    items.value.push(credential);
    return credential;
  }

  async function edit(id: string, data: CredentialUpdate): Promise<CredentialResponse> {
    const updated = await updateCredential(id, data);
    const idx = items.value.findIndex((c) => c.id === id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function remove(id: string): Promise<void> {
    await deleteCredential(id);
    items.value = items.value.filter((c) => c.id !== id);
  }

  async function test(id: string): Promise<{ ok: boolean; type: string; name: string }> {
    return testCredential(id);
  }

  return { items, isLoading, error, load, add, edit, remove, test };
});
