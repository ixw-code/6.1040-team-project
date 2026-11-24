<script setup lang="ts">
// Opened from My Tasks (your task) or Calendar (anyone's task, shown for transparency).
// Your open task → Take Photo. Someone else's open task → Swap Task.
import { computed, onMounted, ref } from "vue";
import BackLink from "../components/BackLink.vue";
import PhotoBox from "../components/PhotoBox.vue";
import { ATTEMPT_BORDER, ATTEMPT_LABEL, formatDate, formatDateTime, isOpen, noteColor, statusText } from "../display.ts";
import { useNav } from "../nav.ts";
import { useResidentApi } from "../residentApi.ts";
const { getPeople, getTask } = useResidentApi();
import type { Person, Task } from "../types.ts";

const props = defineProps<{ taskId: string }>();
const nav = useNav();
const task = ref<Task | null>(null);
const people = ref<Person[]>([]);
const loaded = ref(false);
const camera = ref<HTMLInputElement>();

onMounted(async () => {
  [task.value, people.value] = await Promise.all([getTask(props.taskId), getPeople()]);
  loaded.value = true;
});

const owner = computed(() => people.value.find((p) => p.id === task.value?.ownerId));
const mine = computed(() => owner.value?.isMe ?? false);
const open = computed(() => (task.value ? isOpen(task.value.status) : false));
const color = computed(() => (task.value ? noteColor(task.value.status, owner.value) : "var(--rs-paper)"));

function onPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file && task.value) nav.go({ name: "photo", taskId: task.value.id, file });
}
</script>

<template>
  <section class="rs-screen">
    <BackLink />

    <p v-if="!loaded" class="rs-status-line rs-hand">Loading…</p>
    <p v-else-if="!task" class="rs-status-line rs-hand rs-error">This task no longer exists.</p>

    <article v-else class="card" :style="{ background: color }">
      <svg class="pin" width="22" height="22" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="var(--rs-pin)" /><circle cx="7" cy="7" r="2.4" fill="#f3a093" /></svg>

      <dl class="facts">
        <dt class="rs-heading">Task:</dt>
        <dd class="rs-hand"><h1 class="task-title">{{ task.title }}</h1></dd>
        <dt class="rs-heading">Due:</dt>
        <dd class="rs-hand">{{ formatDateTime(task.due) }}</dd>
        <dt class="rs-heading">Status:</dt>
        <dd class="rs-hand">{{ statusText(task.status, owner) }}</dd>
        <dt class="rs-heading nowrap">Assigned to:</dt>
        <dd class="rs-hand">{{ mine ? `${owner?.name} (you)` : owner?.name ?? 'Unassigned' }}</dd>
      </dl>

      <template v-if="open">
        <!-- Camera only: `capture` opens the rear camera on phones. Desktop browsers ignore it and show a
             file picker. TODO: decide whether desktop should get getUserMedia capture instead. -->
        <template v-if="mine">
          <button type="button" class="rs-pill rs-pill--big rs-heading" @click="camera?.click()">
            Take Photo
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </button>
          <input ref="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden @change="onPhoto" />
        </template>
      </template>

      <section>
        <h2 class="rs-heading sub">Instructions:</h2>
        <p class="rs-body-text">{{ task.instructions }}</p>
      </section>
      <section>
        <h2 class="rs-heading sub">Criteria:</h2>
        <p class="rs-body-text">{{ task.criteria }}</p>
      </section>
      <section>
        <h2 class="rs-heading sub">Reference Images:</h2>
        <div class="thumbs">
          <button
            v-for="(url, i) in task.references"
            :key="i"
            type="button"
            class="thumb"
            :aria-label="`Reference image ${i + 1}, view full screen`"
            @click="nav.go({ name: 'image', url, label: `Reference image ${i + 1} of ${task.references.length}` })"
          >
            <PhotoBox :url="url" :label="`Reference image ${i + 1}`" :text="`Ref ${i + 1}`" />
          </button>
        </div>
      </section>
      <section v-if="task.attempts.length">
        <h2 class="rs-heading sub">Past Attempts:</h2>
        <div class="thumbs">
          <button
            v-for="a in task.attempts"
            :key="a.id"
            type="button"
            class="attempt"
            @click="nav.go({ name: 'attempt', taskId: task.id, attemptId: a.id })"
          >
            <span class="thumb" :style="{ borderColor: ATTEMPT_BORDER[a.status], borderWidth: '5px' }">
              <PhotoBox :url="a.photoUrl" :label="`Attempt from ${formatDate(a.submittedAt)}`" text="" />
            </span>
            <span class="rs-hand">{{ formatDate(a.submittedAt) }} · {{ ATTEMPT_LABEL[a.status] }}</span>
          </button>
        </div>
      </section>
    </article>
  </section>
</template>

<style scoped>
.card { position: relative; max-width: 640px; padding: 26px 20px 24px; display: flex; flex-direction: column; gap: 16px; color: var(--rs-ink); box-shadow: 0 8px 16px rgba(0, 0, 0, .3); }
.pin { position: absolute; top: -8px; left: 50%; margin-left: -11px; }
.facts { margin: 0; display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 6px; align-items: baseline; }
.facts dt { font-size: 19px; }
.facts dd { margin: 0; font-size: 21px; line-height: 1.15; }
.task-title { margin: 0; font: inherit; }
.nowrap { white-space: nowrap; }
.sub { margin: 0 0 4px; font-size: 21px; font-weight: 500; }
.thumbs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 420px; }
.thumb { display: flex; aspect-ratio: 1; padding: 0; overflow: hidden; border: 2px solid rgba(0, 0, 0, .25); background: none; cursor: pointer; }
.attempt { display: flex; flex-direction: column; gap: 4px; padding: 0; border: 0; background: none; color: var(--rs-ink); text-align: left; font-size: 15px; cursor: pointer; }
</style>
