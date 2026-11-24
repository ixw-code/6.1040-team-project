<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ScopeToggle from "../components/ScopeToggle.vue";
import WeekGrid from "../components/WeekGrid.vue";
import { startOfDay, timeRange } from "../display.ts";
import { useNav } from "../nav.ts";
import { getAvailability, getPeople } from "../residentApi.ts";
import type { AvailabilityBlock, Person } from "../types.ts";

const nav = useNav();
const onlyMe = ref(false);
const blocks = ref<AvailabilityBlock[]>([]);
const people = ref<Person[]>([]);
const loading = ref(true);

const from = startOfDay(new Date());
const failed = ref(false);

onMounted(async () => {
  const until = new Date(from); until.setDate(until.getDate() + 7);
  try {
    [blocks.value, people.value] = await Promise.all([getAvailability(from, until), getPeople()]);
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
});

/** You first, then everyone else; each person gets a fixed lane. */
const shownPeople = computed(() => {
  const ordered = [...people.value].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  return onlyMe.value ? ordered.filter((p) => p.isMe) : ordered;
});
const items = computed(() => {
  const lanes = shownPeople.value.length;
  return shownPeople.value.flatMap((person, lane) =>
    blocks.value.filter((b) => b.personId === person.id).map((b) => ({ ...b, lane, lanes, person })));
});
</script>

<template>
  <section class="rs-screen">
    <header class="head">
      <h1 class="rs-title rs-heading title">Availability</h1>
      <ScopeToggle v-model="onlyMe" what="availability" />
    </header>

    <!-- Alpha: adding/removing happens on a separate screen rather than by dragging on the grid. -->
    <div class="actions">
      <button type="button" class="rs-pill rs-heading" @click="nav.go({ name: 'availabilityForm' })">+ Add Time</button>
      <button type="button" class="rs-pill rs-pill--light rs-heading" @click="nav.go({ name: 'availabilityForm' })">− Remove Time</button>
    </div>

    <ul class="legend" aria-label="Who's who">
      <li v-for="p in shownPeople" :key="p.id"><span class="swatch" :style="{ background: p.color }" />{{ p.isMe ? "You" : p.name }}</li>
    </ul>

    <p v-if="failed" class="rs-status-line rs-hand rs-error">Couldn't load availability. Try again.</p>
    <p v-else-if="loading" class="rs-status-line rs-hand">Loading…</p>
    <WeekGrid v-else :items="items" :from="from" :hour-px="34">
      <template #item="{ item }">
        <div class="block" role="img" :style="{ background: item.person.color }" :aria-label="`${item.person.name} free ${timeRange(item.start, item.end)}`">
          <span v-if="!onlyMe" class="rs-heading initial">{{ (item.person.isMe ? "You" : item.person.name).charAt(0) }}</span>
          <span v-else class="rs-serif">{{ timeRange(item.start, item.end) }}</span>
        </div>
      </template>
    </WeekGrid>
  </section>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.title { font-size: 2.2rem; }
.actions { display: flex; gap: 10px; max-width: 460px; }
.actions .rs-pill { flex: 1; font-size: 1.2rem; }
.legend { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 14px; }
.legend li { display: flex; align-items: center; gap: 5px; }
.swatch { width: 12px; height: 12px; box-shadow: 0 1px 2px rgba(0, 0, 0, .4); }
.block { padding: 4px 3px; overflow: hidden; text-align: center; color: var(--rs-ink); font-size: 12px; box-shadow: 0 3px 6px rgba(0, 0, 0, .35); }
.initial { display: block; font-size: 15px; line-height: 1; }
</style>
