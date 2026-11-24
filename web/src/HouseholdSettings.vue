<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "./api.ts";
import { checked, useHousehold } from "./household.ts";

const emit = defineEmits<{ changed: [] }>();
const { home, catalog, person, refresh } = useHousehold();
const household = home.household;
const manager = home.overseer === person;
const name = ref(home.name), target = ref("");
const error = ref(""), message = ref(""), busy = ref(false);
type ResidentOverview = { person: string; workload: number; availability: { interval: { start: string; end: string } }[] };
const overview = ref<ResidentOverview[]>([]);
const username = (id: string) => catalog.value.people.find(p => p.person === id)?.username ?? id;
onMounted(async () => {
  if (manager) overview.value = checked(await api.assignments.overview({ household })).residents;
});
async function run(action: () => Promise<object>, success: string, changeHome = false) {
  if (busy.value) return;
  busy.value = true; error.value = ""; message.value = "";
  try {
    checked(await action());
    if (changeHome) emit("changed");
    else {
      await refresh();
      overview.value = checked(await api.assignments.overview({ household })).residents;
    }
    message.value = success;
  } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
function removeMember(id: string) {
  if (window.confirm(`Remove ${username(id)} from ${home.name}? Their open assignments will become available again.`)) {
    void run(() => api.households.residents.remove({ household, person: id }), "Membership updated.", id === person);
  }
}
function transfer() {
  if (window.confirm(`Make ${username(target.value)} the overseer of ${home.name}?`)) {
    void run(() => api.households.overseer({ household, person: target.value }), "Oversight transferred.", true);
  }
}
function removeHome() {
  if (window.confirm(`Remove the household ${home.name}?`)) {
    void run(() => api.households.remove({ household }), "Household removed.", true);
  }
}
</script>
<template>
  <section class="panel alpha-card"><h2>Household settings</h2>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
    <fieldset v-if="manager" class="settings-fields" :disabled="busy">
      <form @submit.prevent="run(() => api.households.rename({ household, name }), 'Household renamed.', true)">
        <label>Household name<input v-model="name" required maxlength="100"></label><button class="button button-secondary">Rename household</button>
      </form>
      <label>Member<select v-model="target"><option value="">Choose resident</option>
        <option v-for="p in catalog.people.filter(p => p.person !== person)" :key="p.person" :value="p.person">{{ p.username }}</option></select></label>
      <div class="actions-inline"><button class="button button-secondary" :disabled="!target" @click="transfer">Transfer oversight</button>
        <button class="button button-secondary" :disabled="!target" @click="removeMember(target)">Remove resident</button></div>
      <h3>Availability and workload</h3>
      <ul><li v-for="row in overview" :key="row.person" class="schedule-row">
        <div><strong>{{ username(row.person) }}</strong> · Assigned effort {{ row.workload }}
          <p v-if="!row.availability.length">No availability saved.</p>
          <p v-for="a in row.availability" :key="a.interval.start + a.interval.end">{{ new Date(a.interval.start).toLocaleString() }} – {{ new Date(a.interval.end).toLocaleString() }}</p>
        </div></li></ul>
      <button class="button button-secondary" @click="removeHome">Remove unused household</button>
    </fieldset>
    <button v-else class="button button-secondary" :disabled="busy" @click="removeMember(person)">Leave household</button>
  </section>
</template>
