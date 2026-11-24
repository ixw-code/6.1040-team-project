<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../api.ts";
import { checked, useHousehold } from "../../household.ts";
import { useNav } from "../nav.ts";
import { formatDateTime } from "../display.ts";
import { useResidentApi } from "../residentApi.ts";
import type { AvailabilityBlock } from "../types.ts";
const nav = useNav();
const { getAvailability } = useResidentApi();
const { home, person } = useHousehold();
const blocks = ref<AvailabilityBlock[] | null>(null), error = ref(""), busy = ref(false);
async function load() { blocks.value = await getAvailability(); }
async function remove(id: string) {
  busy.value = true; error.value = "";
  try {
    checked(await api.assignments.availability.remove({ household: home.household, person, availability: id }));
    await load();
  } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
onMounted(load);
</script>
<template>
  <section class="rs-screen"><h1 class="rs-title rs-heading">My availability</h1>
    <p>Assignments must fit within the time you have available.</p>
    <button class="rs-pill rs-heading" @click="nav.go({ name: 'availabilityForm' })">Add time</button>
    <button v-if="blocks?.length" class="rs-pill rs-pill--light rs-heading" @click="nav.go({ name: 'availabilityForm', removing: true })">Remove time range</button>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="!blocks">Loading…</p>
    <p v-else-if="!blocks.length">No availability saved.</p>
    <ul v-else class="rs-paper"><li v-for="b in blocks" :key="b.id" class="schedule-row">
      <span>{{ formatDateTime(b.start) }} – {{ formatDateTime(b.end) }}</span>
      <button class="rs-pill rs-pill--light" :disabled="busy" @click="remove(b.id)">Remove</button>
    </li></ul>
  </section>
</template>
