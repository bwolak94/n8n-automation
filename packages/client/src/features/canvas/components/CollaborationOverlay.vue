<script setup lang="ts">
import { computed } from "vue";
import { useVueFlow } from "@vue-flow/core";
import { useCollaborationStore } from "../../../stores/collaborationStore.js";

const collaborationStore = useCollaborationStore();
const { project } = useVueFlow();

// Peers with cursor positions to render
const peersWithCursor = computed(() =>
  collaborationStore.peerList.filter((p) => p.cursor != null)
);

// Presence avatars (all peers, with cursor or not)
const peers = computed(() => collaborationStore.peerList);

function initials(email: string): string {
  const parts = email.split("@")[0]?.split(/[._-]/) ?? [];
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function screenPosition(cursor: { x: number; y: number }): { x: number; y: number } {
  // project() converts flow coordinates to screen coordinates
  return project(cursor);
}
</script>

<template>
  <!-- Pointer-events none: overlay never intercepts canvas interactions -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <!-- Peer cursors -->
    <template v-for="peer in peersWithCursor" :key="peer.userId">
      <div
        class="absolute flex items-start gap-1 transition-transform duration-75"
        :style="{
          transform: `translate(${screenPosition(peer.cursor!).x}px, ${screenPosition(peer.cursor!).y}px)`,
        }"
      >
        <!-- Cursor SVG -->
        <svg
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="-translate-y-1"
        >
          <path
            d="M0.5 0.5L0.5 14.5L4 11L6.5 17L8.5 16L6 10H10.5L0.5 0.5Z"
            :fill="peer.color"
            stroke="white"
            stroke-width="1"
          />
        </svg>
        <!-- Name label -->
        <span
          class="rounded px-1.5 py-0.5 text-xs font-medium text-white shadow-sm whitespace-nowrap"
          :style="{ backgroundColor: peer.color }"
        >
          {{ peer.email.split("@")[0] }}
        </span>
      </div>
    </template>

    <!-- Presence avatars (top-right) -->
    <div
      v-if="peers.length > 0"
      class="pointer-events-auto absolute right-3 top-3 flex -space-x-2"
    >
      <div
        v-for="peer in peers"
        :key="peer.userId"
        class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow"
        :style="{ backgroundColor: peer.color }"
        :title="peer.email"
      >
        {{ initials(peer.email) }}
      </div>
    </div>
  </div>
</template>
