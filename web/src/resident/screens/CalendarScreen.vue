<script setup lang="ts">
import { computed, watch, ref } from "vue";
import ScopeToggle from "../components/ScopeToggle.vue";
import StickyNote from "../components/StickyNote.vue";
import WeekGrid from "../components/WeekGrid.vue";
import { formatDate, noteColor, statusText, tilt, timeRange } from "../display.ts";
import { useNav } from "../nav.ts";
import { useResidentApi } from "../residentApi.ts";
import { localDate } from "../../household.ts";
import type { Person, Task } from "../types.ts";

const nav = useNav();
const { getPeople, getSchedule } = useResidentApi();
const onlyMe = ref(false);
const tasks = ref<Task[]>([]);
const people = ref<Person[]>([]);
const loading = ref(true);

const day = ref(localDate(new Date()));
const from = computed(() => new Date(day.value + "T00:00"));
watch(day, async (_, __, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  if (!day.value) return;
  loading.value = true;
  const until = new Date(from.value);
  until.setDate(until.getDate() + 7);
  const list = await getSchedule(from.value, until);
  if (current) {
    tasks.value = list; people.value = getPeople(); loading.value = false;
  }
}, { immediate: true });

const byId = computed(() => new Map(people.value.map((p) => [p.id, p])));
const others = computed(() => people.value.filter((p) => !p.isMe));
const shown = computed(() => tasks.value
  .filter((t) => !onlyMe.value || byId.value.get(t.ownerId)?.isMe)
  .map((task) => {
    const end = task.end ?? task.due;
    const time = task.flexibleDays ? `${formatDate(task.start)} – ${formatDate(end)}` : timeRange(task.start, end);
    return { ...task, end, time };
  }));
</script>

<template>
  <section class="rs-screen">
    <header class="head">
      <h1 class="rs-title rs-heading">Calendar</h1>
      <ScopeToggle v-model="onlyMe" what="tasks" />
    </header>

    <label>Starting date <input v-model="day" type="date" required></label>
    <ul v-if="!onlyMe" class="legend" aria-label="Who's who">
      <li v-for="p in others" :key="p.id"><span class="swatch" :style="{ background: p.color }" />{{ p.name }}</li>
    </ul>

    <p v-if="loading" class="rs-status-line rs-hand">Loading…</p>
    <WeekGrid v-else-if="day" :items="shown" :from="from" :start-hour="0">
      <template #item="{ item }">
        <StickyNote
          clickable
          :pin="false"
          :color="noteColor(item.status, byId.get(item.ownerId))"
          :tilt="tilt(item.id)"
          :label="`${item.title}, ${byId.get(item.ownerId)?.isMe ? 'you' : byId.get(item.ownerId)?.name ?? 'Unassigned'}, ${item.time}, ${statusText(item.status, byId.get(item.ownerId))}`"
          class="cal-note"
          @open="nav.go({ name: 'task', taskId: item.id })"
        >
          <span>{{ item.title }}</span>
          <span>{{ item.time }}</span>
          <span>{{ byId.get(item.ownerId)?.isMe ? "Me" : byId.get(item.ownerId)?.name ?? 'Unassigned' }}</span>
          <span>{{ statusText(item.status, byId.get(item.ownerId)) }}</span>
        </StickyNote>
      </template>
    </WeekGrid>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.legend { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 14px; }
.legend li { display: flex; align-items: center; gap: 5px; }
.swatch { width: 12px; height: 12px; box-shadow: 0 1px 2px rgba(0, 0, 0, .4); }
.cal-note { overflow: hidden; padding: 5px 6px; gap: 1px; font-size: 15px; line-height: 1.1; box-shadow: 0 4px 7px rgba(0, 0, 0, .35); }
</style>
