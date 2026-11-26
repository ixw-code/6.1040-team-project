<script setup lang="ts">
// Swap Task: opened from someone else's task. Pick which of your open tasks they get.
import { computed, onMounted, ref } from "vue";
import BackLink from "../components/BackLink.vue";
import SwapPair from "../components/SwapPair.vue";
import { formatDateTime, isOpen } from "../display.ts";
import { useNav } from "../nav.ts";
import { getMyTasks, getPeople, getSwapTask, requestSwap } from "../residentApi.ts";
import type { Person, Task } from "../types.ts";

const props = defineProps<{ taskId: string }>();
const nav = useNav();
const theirs = ref<Task | null>(null);
const mineOpen = ref<Task[]>([]);
const people = ref<Person[]>([]);
const pickedId = ref("");
const state = ref<"idle" | "sending" | "sent" | "error">("idle");

onMounted(async () => {
  const [task, mine, folks] = await Promise.all([getSwapTask(props.taskId), getMyTasks(), getPeople()]);
  theirs.value = task;
  people.value = folks;
  mineOpen.value = mine.filter((t) => isOpen(t.status)).sort((a, b) => a.due.localeCompare(b.due));
  pickedId.value = mineOpen.value[0]?.id ?? "";
});

const owner = computed(() => people.value.find((p) => p.id === theirs.value?.ownerId));
const picked = computed(() => mineOpen.value.find((t) => t.id === pickedId.value));

async function send() {
  if (!theirs.value || !picked.value) return;
  state.value = "sending";
  try {
    await requestSwap(theirs.value.id, picked.value.id);
    state.value = "sent";
  } catch {
    state.value = "error";
  }
}
</script>

<template>
  <section class="rs-screen">
    <BackLink :label="owner ? `${owner.name}'s task` : undefined" />
    <h1 class="rs-title rs-heading">Swap Task</h1>

    <p v-if="!theirs || !owner" class="rs-status-line rs-hand">Loading…</p>
    <p v-else-if="mineOpen.length === 0" class="rs-status-line rs-hand">You have no open tasks to swap.</p>
    <template v-else>
      <SwapPair v-if="picked" :get="theirs" :give="picked" :other-name="owner.name" :people="people" />

      <label class="pick">
        <span class="rs-heading rs-label">{{ owner.name }} Gets:</span>
        <select v-model="pickedId" class="rs-select rs-hand" :disabled="state === 'sent'">
          <option v-for="t in mineOpen" :key="t.id" :value="t.id">{{ t.title }} · {{ formatDateTime(t.due) }}</option>
        </select>
      </label>

      <button v-if="state !== 'sent'" type="button" class="rs-pill rs-pill--big rs-heading send" :disabled="state === 'sending'" @click="send">
        {{ state === "sending" ? "Sending…" : "Send Swap Request" }}
      </button>
      <p v-if="state === 'error'" role="alert" class="rs-hand rs-error rs-status-line">Couldn't send. Try again.</p>
      <div v-if="state === 'sent'" role="status" class="sent">
        <span class="rs-hand">Request sent to {{ owner.name }}</span>
        <button type="button" class="link rs-heading" @click="nav.switchTab('calendar')">Back to Calendar</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.pick { display: flex; flex-direction: column; gap: 6px; max-width: 460px; }
.pick .rs-select { height: 48px; font-size: 20px; }
.send { max-width: 460px; }
.sent { max-width: 460px; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; background: var(--rs-tab); border: 2px solid var(--rs-ink); color: var(--rs-ink); font-size: 21px; }
.link { align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: none; color: var(--rs-ink); font-size: 19px; text-decoration: underline; cursor: pointer; }
</style>
