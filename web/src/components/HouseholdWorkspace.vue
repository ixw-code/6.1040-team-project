<script setup lang="ts">
import { onMounted, provide, ref, onErrorCaptured } from "vue";
import { householdKey, localDate, post, type Catalog, type Home } from "../household.ts";
import HouseholdSettings from "./HouseholdSettings.vue";
import { mondayOf } from "../../../src/shared/assignmentDates.ts";
import ChoreCatalog from "./ChoreCatalog.vue";
import ManageHousehold from "./ManageHousehold.vue";
import ReviewQueue from "./ReviewQueue.vue";
import ResidentApp from "../resident/ResidentApp.vue";
import { useNav } from "../resident/nav.ts";

const emit = defineEmits<{ changed: [] }>();
const props = defineProps<{ home: Home; person: string }>();
const overseer = props.person === props.home.overseer;
const tab = ref(overseer ? "Manage" : "My board");
const assignmentWeek = ref(mondayOf(localDate(new Date())));
const catalog = ref<Catalog>({ people: [], ranking: [], chores: [], choreOrder: [] });
const ready = ref(false);
const error = ref("");
const version = ref(0);
async function refresh() {
  catalog.value = await post<Catalog>("catalog/list", { household: props.home.household });
}
async function reload() {
  error.value = "";
  try { await refresh(); ready.value = true; version.value++; }
  catch (e) { error.value = (e as Error).message; }
}
onErrorCaptured(e => { error.value = e.message; return false; });
provide(householdKey, { home: props.home, person: props.person, catalog, refresh });
useNav().switchTab("tasks");
onMounted(reload);
</script>
<template>
  <div class="page-heading">
    <div><p class="household">{{ overseer ? 'Overseer' : 'Resident' }}</p><h1>{{ home.name }}</h1></div>
    <button class="button button-secondary" @click="reload">Refresh board</button>
  </div>
  <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  <nav class="role-switch board-nav" aria-label="Household sections">
    <button v-for="item in overseer ? ['Manage', 'Chore catalog', 'Review queue', 'My board', 'Settings'] : ['My board', 'Settings']" :key="item" :aria-pressed="tab === item" @click="tab = item">{{ item }}</button>
  </nav>
  <p v-if="!ready && !error">Loading household…</p>
  <div v-if="ready" :key="version">
    <ManageHousehold v-if="overseer && tab === 'Manage'" v-model:week="assignmentWeek" />
    <ChoreCatalog v-else-if="overseer && tab === 'Chore catalog'"
      @created="assignmentWeek = $event" @view-assignments="tab = 'Manage'" />
    <ReviewQueue v-else-if="overseer && tab === 'Review queue'" />
    <HouseholdSettings v-else-if="tab === 'Settings'" @changed="emit('changed')" />
    <ResidentApp v-else />
  </div>
</template>
