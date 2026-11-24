<script setup lang="ts">
import { computed, ref } from "vue";
import {
  assignmentWindows, assignmentWindowsOverlap, localAssignmentTime, maxAssignmentOccurrences, mondayOf, type AssignmentDates,
} from "../../../src/shared/assignmentDates.ts";
import { api } from "../api.ts";
import { checked, localDate, post, upload, useHousehold } from "../household.ts";

const emit = defineEmits<{ created: [week: string]; viewAssignments: [] }>();
const { home, catalog, refresh } = useHousehold();
const household = home.household;
const title = ref(""), criteria = ref(""), instructions = ref("");
const difficulty = ref(1), fileInput = ref<HTMLInputElement>(), chore = ref("");
const start = ref("00:00"), due = ref("23:59");
const today = localDate(new Date());
const timing = ref<"day" | "range">("day");
const frequency = ref<"once" | "weekly">("once");
const startsOn = ref(today);
const endsOn = ref("");
const repeatThrough = ref("");
const lastDay = computed(() => timing.value === "range" ? endsOn.value : startsOn.value);
const calendarFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
const formatCalendarDate = (day: string) => calendarFormat.format(new Date(day + "T00:00:00Z"));
const dates = computed(() => assignmentWindows({ startsOn: startsOn.value, endsOn: lastDay.value },
  frequency.value === "weekly" ? repeatThrough.value : undefined));
const dateProblem = computed(() => {
  if (startsOn.value && lastDay.value && lastDay.value < startsOn.value) return "The end date must be on or after the start date.";
  if (frequency.value === "weekly" && repeatThrough.value && lastDay.value && repeatThrough.value < lastDay.value) {
    return "Repeat through the end of the first assignment window or later.";
  }
  if (dates.value.length > maxAssignmentOccurrences) return `Choose a range with up to ${maxAssignmentOccurrences} weekly occurrences.`;
  return "";
});
function formatWindow({ startsOn, endsOn }: AssignmentDates): string {
  return startsOn === endsOn
    ? `on ${formatCalendarDate(startsOn)}`
    : `from ${formatCalendarDate(startsOn)} through ${formatCalendarDate(endsOn)}`;
}
let pendingBatch: { payload: string; batchId: string } | undefined;
const busy = ref(false), message = ref(""), error = ref("");
const assignmentCreated = ref(false);

async function run(action: () => Promise<string>) {
  if (busy.value) return;
  busy.value = true;
  message.value = "";
  error.value = "";
  assignmentCreated.value = false;
  try { message.value = await action(); }
  catch (e) { error.value = (e as Error).message; }
  finally { busy.value = false; }
}
async function addChore() {
  const file = fileInput.value?.files?.[0];
  const result = await post<{ chore: string }>("catalog/create", {
    household, name: title.value, criteria: criteria.value, description: instructions.value,
    difficulty: difficulty.value, ...(file && { photo: await upload(file) }),
  });
  chore.value = result.chore;
  title.value = "";
  criteria.value = "";
  instructions.value = "";
  if (fileInput.value) fileInput.value.value = "";
  await refresh();
  return "Chore saved. Select it in Create assignment whenever the work is due.";
}
function deleteChore(item: { chore: string; name: string }) {
  if (!window.confirm(`Delete “${item.name}” from the chore catalog and resident preferences?`)) return;
  void run(async () => {
    await post("catalog/delete", { household, chore: item.chore });
    if (chore.value === item.chore) chore.value = "";
    await refresh();
    return "Chore deleted from the catalog.";
  });
}

async function addTask() {
  const selectedDates = dates.value;
  if (dateProblem.value || !selectedDates.length) throw new Error(dateProblem.value || "Choose when to create the assignment.");
  if (!start.value || !due.value || (startsOn.value === lastDay.value && start.value >= due.value)) {
    throw new Error("The deadline must come after the start.");
  }
  const windows = selectedDates.map(({ startsOn, endsOn }) => ({
    start: localAssignmentTime(startsOn, start.value).toISOString(),
    end: localAssignmentTime(endsOn, due.value).toISOString(),
  }));
  const repeatWeekly = frequency.value === "weekly";
  if (repeatWeekly && assignmentWindowsOverlap(windows)) throw new Error("Choose a range whose weekly occurrences do not overlap.");
  const flexibleDays = startsOn.value !== lastDay.value;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const input = { household, chore: chore.value, windows, repeatWeekly, flexibleDays, timeZone };
  const payload = JSON.stringify(input);
  if (pendingBatch?.payload !== payload) pendingBatch = { payload, batchId: crypto.randomUUID() };
  const result = checked(await api.assignments.tasks["create-batch"]({ ...input, batchId: pendingBatch.batchId }));
  pendingBatch = undefined;
  assignmentCreated.value = true;
  emit("created", mondayOf(selectedDates[0].startsOn));
  return repeatWeekly
    ? `Weekly assignment created with ${result.tasks.length} ${result.tasks.length === 1 ? "occurrence" : "occurrences"}.`
    : "Assignment created.";
}
</script>
<template>
  <div class="management">
    <div v-if="message" class="notice notice-visible actions-inline">
      <p role="status">{{ message }}</p>
      <button v-if="assignmentCreated" class="button button-secondary" type="button" @click="emit('viewAssignments')">
        View assignments in Manage
      </button>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div class="alpha-grid">
      <section class="panel alpha-card" aria-labelledby="chore-catalog">
        <h2 id="chore-catalog">Chore catalog</h2>
        <p>Save each responsibility once. Residents rank the chores in this catalog.</p>
        <form @submit.prevent="run(addChore)">
          <label>Chore name<input v-model="title" required maxlength="150"></label>
          <label>Description and photo instructions<textarea v-model="instructions" required maxlength="4000"></textarea></label>
          <label>Effort (1–10)<input v-model.number="difficulty" type="number" required min="1" max="10"></label>
          <label>Completion criteria<textarea v-model="criteria" required maxlength="4000"></textarea></label>
          <label>Baseline photo (optional, JPG, PNG or WebP up to 10 MB)
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp">
          </label>
          <button class="button button-primary" :disabled="busy">Save chore</button>
        </form>
        <ul v-if="catalog.chores.length" class="catalog-chores">
          <li v-for="item in catalog.chores" :key="item.chore">
            <div>
              <strong>{{ item.name }}</strong>
              <p>{{ item.description }}</p>
            </div>
            <button type="button" class="button button-delete" :disabled="busy"
              :aria-label="`Delete chore ${item.name}`" @click="deleteChore(item)">Delete chore</button>
          </li>
        </ul>
        <p v-else>No chores yet.</p>
      </section>
      <form class="panel alpha-card" @submit.prevent="run(addTask)"><h2>Create assignment</h2>
        <p>Create an assignment from a catalog chore, then choose the resident in Manage.</p>
        <label>Catalog chore<select v-model="chore" required><option disabled value="">Choose chore</option><option v-for="c in catalog.chores" :key="c.chore" :value="c.chore">{{ c.name }}</option></select></label>
        <fieldset class="assignment-timing" :disabled="busy">
          <div class="assignment-field">
            <label for="assignment-timing">When can it be done?</label>
            <select id="assignment-timing" v-model="timing">
              <option value="day">Specific day</option>
              <option value="range">Date range</option>
            </select>
          </div>
          <label v-if="timing === 'day'">Task date<input v-model="startsOn" type="date" required></label>
          <div v-else class="assignment-pair">
            <label>Start date<input v-model="startsOn" type="date" required></label>
            <label>End date<input v-model="endsOn" type="date" :min="startsOn" required></label>
          </div>
          <div class="assignment-pair">
            <label>Start time<input v-model="start" type="time" required></label>
            <label>Deadline time<input v-model="due" type="time" required></label>
          </div>
          <div class="assignment-field">
            <label for="assignment-frequency">Schedule</label>
            <select id="assignment-frequency" v-model="frequency">
              <option value="once">Once</option>
              <option value="weekly">Repeat weekly</option>
            </select>
          </div>
          <label v-if="frequency === 'weekly'">
            Repeat through<input v-model="repeatThrough" type="date" :min="lastDay" required>
          </label>
        </fieldset>
        <p v-if="dateProblem" class="field-error" role="status">{{ dateProblem }}</p>
        <p v-else-if="dates.length" class="assignment-hint" role="status">
          {{ frequency === 'once' ? `1 assignment ${formatWindow(dates[0])}`
            : `1 weekly assignment · first occurrence ${formatWindow(dates[0])} · ${dates.length} ${dates.length === 1 ? 'occurrence' : 'occurrences'} ending ${formatCalendarDate(dates[dates.length - 1].endsOn)}` }}
        </p>
        <button class="button button-primary" :disabled="busy || !catalog.chores.length || !dates.length || !!dateProblem">Create assignment</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.assignment-timing { min-width: 0; margin: 0; padding: 0; border: 0; display: grid; gap: 1rem; }
.assignment-field { display: grid; gap: .3rem; }
.assignment-pair { display: grid; gap: .8rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr)); }
.assignment-hint { color: var(--muted); font-size: .875rem; }
.catalog-chores { display: grid; gap: .5rem; }
.catalog-chores li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: start; gap: .5rem; border-bottom: 1px solid var(--line); padding-bottom: .5rem; overflow-wrap: anywhere; }
.catalog-chores p { color: var(--muted); white-space: pre-wrap; }
</style>
