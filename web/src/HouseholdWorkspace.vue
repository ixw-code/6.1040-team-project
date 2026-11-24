<script setup lang="ts">
import { onMounted, provide, ref, onErrorCaptured } from "vue";
import { api } from "./api.ts";
import { checked, householdKey, post, type Catalog, type Category, type Home } from "./household.ts";
import HouseholdSettings from "./HouseholdSettings.vue";
import ManageHousehold from "./ManageHousehold.vue";
import ReviewQueue from "./ReviewQueue.vue";
import ResidentApp from "./resident/ResidentApp.vue";
import { useNav } from "./resident/nav.ts";

const emit = defineEmits<{ changed: [] }>();
const props = defineProps<{ home: Home; person: string }>();
const overseer = props.person === props.home.overseer;
const tab = ref(overseer ? "Manage" : "My board");
const catalog = ref<Catalog>({ people: [], ranking: [], chores: [] });
const categories = ref<Category[]>([]);
const ready = ref(false);
const error = ref("");
const version = ref(0);
async function refresh() {
  const input = { household: props.home.household };
  const [data, groups] = await Promise.all([post<Catalog>("catalog/list", input), api.households.categories(input)]);
  categories.value = checked(groups).categories;
  catalog.value = data;
}
async function reload() {
  error.value = "";
  try { await refresh(); ready.value = true; version.value++; }
  catch (e) { error.value = (e as Error).message; }
}
onErrorCaptured(e => { error.value = e.message; return false; });
provide(householdKey, { home: props.home, person: props.person, categories, catalog, refresh });
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
    <button v-for="item in overseer ? ['Manage', 'Review queue', 'My board', 'Settings'] : ['My board', 'Settings']" :key="item" :aria-pressed="tab === item" @click="tab = item">{{ item }}</button>
  </nav>
  <p v-if="!ready && !error">Loading household…</p>
  <template v-if="ready" :key="version">
    <ManageHousehold v-if="overseer && tab === 'Manage'" />
    <ReviewQueue v-else-if="overseer && tab === 'Review queue'" />
    <HouseholdSettings v-else-if="tab === 'Settings'" @changed="emit('changed')" />
    <ResidentApp v-else />
  </template>
</template>
