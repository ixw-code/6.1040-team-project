<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api.ts";
import { mondayFirstWeekdays } from "../../../src/shared/assignmentDates.ts";
import {
  availabilityLabels, availabilityLevels, type AvailabilityLevel, type WeekAvailability,
} from "../../../src/shared/weeklyAvailability.ts";
import { checked, useHousehold } from "../household.ts";

const emit = defineEmits<{ changed: [] }>();
const { home, catalog, person, refresh } = useHousehold();
const household = home.household;
const manager = home.overseer === person;
const name = ref(home.name), target = ref("");
const error = ref(""), message = ref(""), busy = ref(false);
type ResidentOverview = {
  person: string;
  workload: number;
  weeklyAvailability: WeekAvailability | null;
  availability: { interval: { start: string; end: string } }[];
};
const overview = ref<ResidentOverview[]>([]);
function daysWith(weekly: WeekAvailability, level: AvailabilityLevel) {
  return mondayFirstWeekdays.filter(({ name }) => weekly[name] === level).map(({ name }) => name).join(", ") || "None";
}
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
  <p v-if="message" class="notice notice-visible" role="status">{{ message }}</p>
  <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  <fieldset v-if="manager" class="settings-fields alpha-grid" :disabled="busy">
    <section class="panel alpha-card" aria-labelledby="household-details">
      <h2 id="household-details" class="panel-title">Household details</h2>
      <form @submit.prevent="run(() => api.households.rename({ household, name }), 'Household renamed.', true)">
        <label>Household name<input v-model="name" required maxlength="100"></label>
        <button class="button button-secondary">Rename household</button>
      </form>
      <div class="panel-section">
        <label>Member
          <select v-model="target">
            <option value="">Choose resident</option>
            <option v-for="p in catalog.people.filter(p => p.person !== person)" :key="p.person" :value="p.person">{{ p.username }}</option>
          </select>
        </label>
        <div class="actions-inline">
          <button type="button" class="button button-secondary" :disabled="!target" @click="transfer">Transfer oversight</button>
          <button type="button" class="button button-danger" :disabled="!target" @click="removeMember(target)">Remove resident</button>
        </div>
      </div>
      <div class="panel-section">
        <button type="button" class="button button-danger" @click="removeHome">Remove unused household</button>
      </div>
    </section>

    <section class="panel alpha-card" aria-labelledby="availability-heading">
      <h2 id="availability-heading" class="panel-title">Availability and workload</h2>
      <ul class="panel-list">
        <li v-for="row in overview" :key="row.person" class="workload-entry">
          <div class="actions-inline">
            <strong>{{ username(row.person) }}</strong>
            <span class="status-badge">Assigned effort {{ row.workload }}</span>
          </div>
          <dl v-if="row.weeklyAvailability" class="availability-summary">
            <template v-for="level in availabilityLevels" :key="level">
              <dt>{{ availabilityLabels[level] }}</dt>
              <dd>{{ daysWith(row.weeklyAvailability, level) }}</dd>
            </template>
          </dl>
          <p v-else class="panel-copy">{{ row.availability.length ? 'Using saved time blocks until weekly availability is set.' : 'No availability saved.' }}</p>
        </li>
      </ul>
    </section>
  </fieldset>
  <section v-else class="panel alpha-card household-form">
    <h2 class="panel-title">Membership</h2>
    <button type="button" class="button button-danger" :disabled="busy" @click="removeMember(person)">Leave household</button>
  </section>
</template>
