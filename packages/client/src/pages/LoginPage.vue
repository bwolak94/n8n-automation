<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/authStore.js";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const isLoading = ref(false);

async function handleSubmit(): Promise<void> {
  if (!email.value || !password.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    await authStore.login({ email: email.value, password: password.value });
    const redirect = (route.query["redirect"] as string) || "/";
    await router.push(redirect);
  } catch {
    error.value = "Invalid credentials. Please try again.";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
      <h1 class="mb-6 text-2xl font-bold text-gray-900">Automation Hub</h1>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700" for="email">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700" for="password">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {{ isLoading ? "Signing in..." : "Sign in" }}
        </button>
      </form>
    </div>
  </div>
</template>
