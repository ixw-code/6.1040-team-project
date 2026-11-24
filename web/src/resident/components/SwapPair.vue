<script setup lang="ts">
// "You Get ⇄ Name Gets" pair of post-its used on the Swap and Swaps screens.
import StickyNote from "./StickyNote.vue";
import { formatDateTime, noteColor, statusText } from "../display.ts";
import type { Person, TaskSummary } from "../types.ts";

defineProps<{
  get: TaskSummary;
  give: TaskSummary;
  otherName: string;
  people: Person[];
}>();

const owner = (people: Person[], id: string) => people.find((p) => p.id === id);
</script>

<template>
  <div class="pair">
    <span class="rs-heading rs-label">You Get</span>
    <span />
    <span class="rs-heading rs-label">{{ otherName }} Gets</span>

    <StickyNote v-for="(task, i) in [get, give]" :key="task.id" square :color="noteColor(task.status, owner(people, task.ownerId))" :tilt="i ? '1.5deg' : '-1.5deg'" :style="{ order: 3 + i * 2 }">
      <span>{{ task.title }}</span>
      <span><span class="rs-heading small">Due:</span> {{ formatDateTime(task.due) }}</span>
      <span><span class="rs-heading small">Status:</span> {{ statusText(task.status, owner(people, task.ownerId)) }}</span>
    </StickyNote>

    <svg class="arrow" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3" /></svg>
  </div>
</template>

<style scoped>
.pair { display: grid; grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr); align-items: center; gap: 10px 4px; max-width: 460px; }
.pair > :deep(.note) { font-size: 16px; padding: 14px 8px 8px; gap: 2px; }
.arrow { order: 4; color: var(--rs-ink); }
.small { font-size: 14px; }
</style>
