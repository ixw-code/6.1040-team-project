<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BackLink from "../components/BackLink.vue";
import PhotoBox from "../components/PhotoBox.vue";
import { ATTEMPT_COLOR, ATTEMPT_LABEL, formatDateTime } from "../display.ts";
import { useNav } from "../nav.ts";
import { getTask } from "../residentApi.ts";
import type { Task } from "../types.ts";

const props = defineProps<{ taskId: string; attemptId: string }>();
const nav = useNav();
const task = ref<Task | null>(null);
onMounted(async () => { task.value = await getTask(props.taskId); });
const attempt = computed(() => task.value?.attempts.find((a) => a.id === props.attemptId));
</script>

<template>
  <section class="page" :style="{ background: attempt ? ATTEMPT_COLOR[attempt.status] : undefined }">
    <div class="rs-screen">
      <BackLink :label="task?.title ?? 'Task'" />
      <p v-if="!attempt" class="rs-status-line rs-hand">Loading…</p>
      <template v-else>
        <dl class="facts">
          <dt class="rs-heading">Status:</dt>
          <dd class="rs-hand">{{ ATTEMPT_LABEL[attempt.status] }}</dd>
          <dt class="rs-heading">Submitted:</dt>
          <dd class="rs-hand">{{ formatDateTime(attempt.submittedAt) }}</dd>
          <template v-if="attempt.reviewedAt">
            <dt class="rs-heading">Reviewed:</dt>
            <dd class="rs-hand">{{ formatDateTime(attempt.reviewedAt) }}<template v-if="attempt.reviewer"> · {{ attempt.reviewer }}</template></dd>
          </template>
        </dl>
        <button type="button" class="photo" @click="nav.go({ name: 'image', url: attempt.photoUrl, label: 'Submitted photo' })">
          <PhotoBox :url="attempt.photoUrl" label="Submitted photo, view full screen" text="Submitted photo" />
        </button>
        <section v-if="attempt.comment">
          <h2 class="rs-heading sub">Comments:</h2>
          <p class="rs-body-text">{{ attempt.comment }}</p>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.page { flex: 1; display: flex; color: var(--rs-ink); }
.facts { margin: 0; display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 8px; align-items: baseline; }
.facts dt { font-size: 20px; }
.facts dd { margin: 0; font-size: 21px; }
.photo { display: flex; width: 100%; max-width: 480px; aspect-ratio: 3 / 4; padding: 0; overflow: hidden; border: 2px solid rgba(0, 0, 0, .3); background: none; cursor: pointer; }
.sub { margin: 0 0 4px; font-size: 20px; font-weight: 500; }
</style>
