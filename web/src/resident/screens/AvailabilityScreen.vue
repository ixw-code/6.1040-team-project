<script setup lang="ts">
import { onMounted, ref } from "vue";
import { mondayFirstWeekdays } from "../../../../src/shared/assignmentDates.ts";
import {
  availabilityLabels, availabilityLevels, type WeekAvailability,
} from "../../../../src/shared/weeklyAvailability.ts";
import { api } from "../../api.ts";
import { checked, useHousehold } from "../../household.ts";

const { home, person } = useHousehold();
const household = home.household;
const days = ref<WeekAvailability>();
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const message = ref("");

onMounted(async () => {
  try {
    const result = checked(await api.assignments.availability.weekly({ household, person }));
    days.value = result.days ?? {
      Monday: "NOT_AVAILABLE", Tuesday: "NOT_AVAILABLE", Wednesday: "NOT_AVAILABLE",
      Thursday: "NOT_AVAILABLE", Friday: "NOT_AVAILABLE", Saturday: "NOT_AVAILABLE", Sunday: "NOT_AVAILABLE",
    };
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

async function save() {
  if (!days.value || busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const { freed } = checked(await api.assignments.availability.weekly.set({ household, days: days.value, timeZone }));
    message.value = freed.length
      ? `Weekly availability saved. ${freed.length} ${freed.length === 1 ? "task is" : "tasks are"} now unassigned.`
      : "Weekly availability saved.";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="rs-screen">
    <h1 class="rs-title rs-heading">My availability</h1>
    <p>Choose your availability for a typical week.</p>
    <dl class="availability-guide">
      <dt>Available</dt><dd>I can take a task on this day every week.</dd>
      <dt>Somewhat available</dt><dd>I can sometimes take a task on this day.</dd>
      <dt>Not available</dt><dd>I’m busy on this day each week.</dd>
    </dl>
    <p v-if="loading">Loading availability…</p>
    <p v-if="error" class="rs-error" role="alert">{{ error }}</p>
    <form v-if="days" class="availability-form" @submit.prevent="save">
      <ul class="rs-paper">
        <li v-for="{ name } in mondayFirstWeekdays" :key="name" class="schedule-row">
          <label :for="`availability-${name}`">{{ name }}</label>
          <select :id="`availability-${name}`" v-model="days[name]" :disabled="busy" @change="message = ''">
            <option v-for="level in availabilityLevels" :key="level" :value="level">{{ availabilityLabels[level] }}</option>
          </select>
        </li>
      </ul>
      <button class="rs-pill rs-heading" :disabled="busy">Save availability</button>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.availability-guide { display: grid; gap: .3rem .8rem; margin: 0; grid-template-columns: max-content minmax(0, 1fr); }
.availability-guide dt { font-weight: bold; }
.availability-guide dd { margin: 0; }
.availability-form { display: grid; gap: 1rem; max-width: 36rem; }
.availability-form > button { justify-self: start; }
</style>
