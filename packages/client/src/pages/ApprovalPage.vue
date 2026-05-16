<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const approvalId = computed(() => route.params["id"] as string);
const token      = computed(() => route.query["token"] as string | undefined);

type PageState = "loading" | "pending" | "decided" | "expired" | "error";

const state     = ref<PageState>("loading");
const comment   = ref("");
const decision  = ref<"approved" | "rejected" | "pending" | null>(null);
const errorMsg  = ref("");
const submitting = ref(false);

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

onMounted(async () => {
  if (!token.value) {
    state.value  = "expired";
    errorMsg.value = "No approval token found in the URL.";
    return;
  }
  // Just show the pending form — token validity is checked on submit
  state.value = "pending";
});

async function submit(chosenDecision: "approved" | "rejected"): Promise<void> {
  if (!token.value) return;
  submitting.value = true;

  const action   = chosenDecision === "approved" ? "approve" : "reject";
  const endpoint = `${BASE}/api/approvals/${approvalId.value}/${action}?token=${encodeURIComponent(token.value)}`;

  try {
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ comment: comment.value || undefined }),
    });

    if (res.status === 410) {
      state.value   = "expired";
      errorMsg.value = "This approval link has expired.";
      return;
    }

    if (res.status === 409) {
      state.value   = "decided";
      decision.value = null;
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? `HTTP ${res.status}`);
    }

    const body = await res.json() as { finalDecision: string };
    decision.value = body.finalDecision as "approved" | "rejected" | "pending";
    state.value    = "decided";
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : "An unexpected error occurred.";
    state.value    = "error";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 p-4">
    <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">

      <!-- Loading -->
      <div v-if="state === 'loading'" class="flex flex-col items-center gap-3 py-8 text-gray-500">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500"></div>
        <p class="text-sm">Loading…</p>
      </div>

      <!-- Expired / Invalid -->
      <div v-else-if="state === 'expired'" class="text-center">
        <div class="mb-4 flex justify-center text-4xl">⏰</div>
        <h1 class="text-xl font-bold text-gray-800">Link Expired</h1>
        <p class="mt-2 text-sm text-gray-500">
          {{ errorMsg || "This approval link has expired and is no longer valid." }}
        </p>
      </div>

      <!-- Error -->
      <div v-else-if="state === 'error'" class="text-center">
        <div class="mb-4 flex justify-center text-4xl">❌</div>
        <h1 class="text-xl font-bold text-gray-800">Error</h1>
        <p class="mt-2 text-sm text-red-500">{{ errorMsg }}</p>
      </div>

      <!-- Already decided -->
      <div v-else-if="state === 'decided' && decision === null" class="text-center">
        <div class="mb-4 flex justify-center text-4xl">✅</div>
        <h1 class="text-xl font-bold text-gray-800">Already Decided</h1>
        <p class="mt-2 text-sm text-gray-500">A decision has already been recorded for this approval.</p>
      </div>

      <!-- Decision recorded -->
      <div v-else-if="state === 'decided'" class="text-center">
        <div class="mb-4 flex justify-center text-4xl">
          {{ decision === "approved" ? "✅" : decision === "rejected" ? "❌" : "⏳" }}
        </div>
        <h1 class="text-xl font-bold text-gray-800">
          <span v-if="decision === 'approved'">Approved!</span>
          <span v-else-if="decision === 'rejected'">Rejected</span>
          <span v-else>Vote Recorded</span>
        </h1>
        <p class="mt-2 text-sm text-gray-500">
          <span v-if="decision === 'pending'">
            Your approval has been recorded. Waiting for other reviewers.
          </span>
          <span v-else>
            The workflow will continue based on your decision. You may close this tab.
          </span>
        </p>
      </div>

      <!-- Pending — show form -->
      <div v-else-if="state === 'pending'">
        <div class="mb-6 text-center">
          <div class="mb-3 flex justify-center text-4xl">👤</div>
          <h1 class="text-xl font-bold text-gray-800">Approval Required</h1>
          <p class="mt-2 text-sm text-gray-500">
            A workflow is paused and waiting for your decision.
          </p>
        </div>

        <!-- Optional comment -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700" for="comment">
            Comment <span class="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="comment"
            v-model="comment"
            rows="3"
            placeholder="Add a note for the workflow log…"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <button
            type="button"
            :disabled="submitting"
            class="flex-1 rounded-lg border border-green-300 bg-green-50 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
            aria-label="Approve this request"
            @click="submit('approved')"
          >
            <span v-if="submitting">…</span>
            <span v-else>✓ Approve</span>
          </button>

          <button
            type="button"
            :disabled="submitting"
            class="flex-1 rounded-lg border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            aria-label="Reject this request"
            @click="submit('rejected')"
          >
            <span v-if="submitting">…</span>
            <span v-else>✕ Reject</span>
          </button>
        </div>

        <p class="mt-4 text-center text-xs text-gray-400">
          This link is single-use and time-limited. Do not share it.
        </p>
      </div>

    </div>
  </div>
</template>
