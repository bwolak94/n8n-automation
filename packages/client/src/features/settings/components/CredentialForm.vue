<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { CredentialType, CredentialCreateSchema } from "@automation-hub/shared";
import type { CredentialCreate, CredentialResponse } from "@automation-hub/shared";

const props = defineProps<{
  credential?: CredentialResponse | null;
}>();

const emit = defineEmits<{
  (e: "submit", data: CredentialCreate): void;
  (e: "cancel"): void;
}>();

// ── Field definitions per credential type ─────────────────────────────────────

const FIELD_MAP: Record<string, Array<{ key: string; label: string; placeholder: string; secret?: boolean }>> = {
  generic:      [{ key: "value",    label: "Value",    placeholder: "secret-value", secret: true }],
  http_basic:   [{ key: "username", label: "Username", placeholder: "user" }, { key: "password", label: "Password", placeholder: "••••••", secret: true }],
  bearer:       [{ key: "token",    label: "Token",    placeholder: "Bearer token", secret: true }],
  oauth2:       [
    { key: "clientId",     label: "Client ID",     placeholder: "client_id" },
    { key: "clientSecret", label: "Client Secret", placeholder: "client_secret", secret: true },
    { key: "tokenUrl",     label: "Token URL",     placeholder: "https://…/oauth/token" },
  ],
  smtp:         [
    { key: "host",     label: "Host",     placeholder: "smtp.example.com" },
    { key: "port",     label: "Port",     placeholder: "587" },
    { key: "user",     label: "Username", placeholder: "user@example.com" },
    { key: "password", label: "Password", placeholder: "••••••", secret: true },
  ],
  database_dsn: [{ key: "dsn", label: "DSN", placeholder: "postgres://user:pass@host/db", secret: true }],
};

const credentialTypes = Object.values(CredentialType);

// ── Form state ────────────────────────────────────────────────────────────────

const name = ref(props.credential?.name ?? "");
const type = ref<string>(props.credential?.type ?? "bearer");
const fieldValues = ref<Record<string, string>>({});
const formError = ref<string | null>(null);

const fields = computed(() => FIELD_MAP[type.value] ?? []);

// Reset fields when type changes
watch(type, () => {
  fieldValues.value = {};
});

// Pre-fill name when editing
watch(
  () => props.credential,
  (cred) => {
    name.value = cred?.name ?? "";
    type.value = cred?.type ?? "bearer";
    fieldValues.value = {};
  }
);

// ── Submit ────────────────────────────────────────────────────────────────────

function handleSubmit(): void {
  formError.value = null;

  const payload = {
    name: name.value.trim(),
    type: type.value,
    data: { ...fieldValues.value },
  };

  const parsed = CredentialCreateSchema.safeParse(payload);
  if (!parsed.success) {
    formError.value = parsed.error.errors[0]?.message ?? "Validation failed";
    return;
  }

  emit("submit", parsed.data);
}

const isEditing = computed(() => !!props.credential);
</script>

<template>
  <form data-testid="credential-form" class="space-y-4" @submit.prevent="handleSubmit">
    <!-- Name -->
    <div>
      <label class="mb-1 block text-sm font-medium text-gray-700" for="cred-name">
        Name
      </label>
      <input
        id="cred-name"
        v-model="name"
        type="text"
        placeholder="e.g. stripe-live-key"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        data-testid="cred-name-input"
      />
    </div>

    <!-- Type -->
    <div v-if="!isEditing">
      <label class="mb-1 block text-sm font-medium text-gray-700" for="cred-type">
        Type
      </label>
      <select
        id="cred-type"
        v-model="type"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm capitalize focus:border-violet-400 focus:outline-none"
        data-testid="cred-type-select"
      >
        <option v-for="t in credentialTypes" :key="t" :value="t" class="capitalize">
          {{ t.replace(/_/g, " ") }}
        </option>
      </select>
    </div>

    <!-- Dynamic fields for selected type -->
    <div v-for="field in fields" :key="field.key">
      <label class="mb-1 block text-sm font-medium text-gray-700" :for="`cred-field-${field.key}`">
        {{ field.label }}
      </label>
      <input
        :id="`cred-field-${field.key}`"
        v-model="fieldValues[field.key]"
        :type="field.secret ? 'password' : 'text'"
        :placeholder="field.placeholder"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        :data-testid="`cred-field-${field.key}`"
        autocomplete="off"
      />
    </div>

    <!-- Error -->
    <p v-if="formError" class="text-xs text-red-500" data-testid="cred-form-error">
      {{ formError }}
    </p>

    <!-- Actions -->
    <div class="flex justify-end gap-2 pt-2">
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        data-testid="cred-cancel-btn"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        data-testid="cred-submit-btn"
      >
        {{ isEditing ? "Save changes" : "Add credential" }}
      </button>
    </div>
  </form>
</template>
