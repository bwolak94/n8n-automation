<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { CredentialCreate, CredentialResponse } from "@automation-hub/shared";
import { useCredentialStore } from "../credentialStore.js";
import CredentialForm from "./CredentialForm.vue";

const store = useCredentialStore();

const showForm = ref(false);
const editingCredential = ref<CredentialResponse | null>(null);
const testStatus = ref<Record<string, "ok" | "error" | null>>({});
const deleteError = ref<string | null>(null);

onMounted(() => {
  void store.load();
});

function openAddForm(): void {
  editingCredential.value = null;
  showForm.value = true;
}

function openEditForm(cred: CredentialResponse): void {
  editingCredential.value = cred;
  showForm.value = true;
}

function closeForm(): void {
  showForm.value = false;
  editingCredential.value = null;
}

async function handleSubmit(data: CredentialCreate): Promise<void> {
  if (editingCredential.value) {
    await store.edit(editingCredential.value.id, { name: data.name, data: data.data });
  } else {
    await store.add(data);
  }
  closeForm();
}

async function handleDelete(id: string): Promise<void> {
  if (!confirm("Delete this credential? Workflows referencing it will fail.")) return;
  deleteError.value = null;
  try {
    await store.remove(id);
  } catch {
    deleteError.value = "Failed to delete credential.";
  }
}

async function handleTest(id: string): Promise<void> {
  testStatus.value[id] = null;
  try {
    const result = await store.test(id);
    testStatus.value[id] = result.ok ? "ok" : "error";
  } catch {
    testStatus.value[id] = "error";
  }
}

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

function credRef(name: string): string {
  return "{{ $credentials." + name + " }}";
}
</script>

<template>
  <section data-testid="credential-list">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-base font-semibold text-gray-800">Credentials</h2>
      <button
        type="button"
        class="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
        data-testid="add-credential-btn"
        @click="openAddForm"
      >
        Add credential
      </button>
    </div>

    <!-- Add / Edit form -->
    <div
      v-if="showForm"
      class="mb-5 rounded-xl border border-gray-200 bg-white p-5"
      data-testid="credential-form-panel"
    >
      <h3 class="mb-4 text-sm font-semibold text-gray-700">
        {{ editingCredential ? "Edit credential" : "New credential" }}
      </h3>
      <CredentialForm
        :credential="editingCredential"
        @submit="handleSubmit"
        @cancel="closeForm"
      />
    </div>

    <!-- Error -->
    <p v-if="deleteError" class="mb-3 text-xs text-red-500" data-testid="delete-error">
      {{ deleteError }}
    </p>

    <!-- Loading -->
    <div v-if="store.isLoading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="store.items.length === 0"
      class="rounded-xl border border-gray-200 bg-white p-8 text-center"
      data-testid="empty-state"
    >
      <p class="text-sm text-gray-400">No credentials yet. Add one to get started.</p>
    </div>

    <!-- Table -->
    <div v-else class="rounded-xl border border-gray-200 bg-white" data-testid="credentials-table">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th class="px-5 py-2.5">Name</th>
            <th class="px-5 py-2.5">Type</th>
            <th class="px-5 py-2.5">Created</th>
            <th class="px-5 py-2.5">Status</th>
            <th class="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="cred in store.items"
            :key="cred.id"
            class="border-b border-gray-50 last:border-none"
            data-testid="credential-row"
          >
            <td class="px-5 py-3 font-medium text-gray-800">
              <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">{{ credRef(cred.name) }}</code>
            </td>
            <td class="px-5 py-3 capitalize text-gray-600">{{ formatType(cred.type) }}</td>
            <td class="px-5 py-3 text-xs text-gray-400">
              {{ new Date(cred.createdAt).toLocaleDateString() }}
            </td>
            <td class="px-5 py-3">
              <span
                v-if="testStatus[cred.id] === 'ok'"
                class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                data-testid="test-ok"
              >OK</span>
              <span
                v-else-if="testStatus[cred.id] === 'error'"
                class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                data-testid="test-error"
              >Failed</span>
            </td>
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="text-xs text-blue-500 hover:text-blue-700"
                  :data-testid="`test-btn-${cred.id}`"
                  @click="handleTest(cred.id)"
                >
                  Test
                </button>
                <button
                  type="button"
                  class="text-xs text-gray-500 hover:text-gray-700"
                  :data-testid="`edit-btn-${cred.id}`"
                  @click="openEditForm(cred)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="text-xs text-red-400 hover:text-red-600"
                  :data-testid="`delete-btn-${cred.id}`"
                  @click="handleDelete(cred.id)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
