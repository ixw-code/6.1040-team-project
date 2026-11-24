<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "./api.ts";
import { checked, post, useHousehold, weekWindow, type AssignmentRow } from "./household.ts";

const week = defineModel<string>("week", { required: true });
const { home, catalog, refresh } = useHousehold();
const household = home.household;
const username = ref("");
const assignments = ref<AssignmentRow[]>([]);
const waiting = computed(() => assignments.value.filter(row => row.remaining > 0 && !row.assignee).length);
const busy = ref(false);
const message = ref("");
const error = ref("");

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const calendarDate = (date: string) => dateFormat.format(new Date(date));
const dueDate = (row: AssignmentRow) => new Date(row.endsAt).toLocaleString();
const nameOf = (id: string | null) => catalog.value.people.find(p => p.person === id)?.username ?? "Former resident";

async function loadAssignments() {
  assignments.value = checked(await api.assignments.list({ household, ...weekWindow(week.value) })).assignments;
}

async function run(action: () => Promise<string>) {
  if (busy.value) return;
  busy.value = true;
  message.value = "";
  error.value = "";
  try {
    message.value = await action();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function addResident() {
  await post("catalog/add-resident", { household, username: username.value.trim() });
  username.value = "";
  await refresh();
  return "Resident added.";
}

async function autoSchedule() {
  const { scheduled, unassigned } = checked(await api.assignments.weekly({ household, ...weekWindow(week.value) }));
  await loadAssignments();
  return `${scheduled.length} assigned. ${unassigned.length} still need a resident available for all their dates.`;
}

async function assign(row: AssignmentRow, select: HTMLSelectElement) {
  const assignee = select.value;
  select.value = row.mixed ? "mixed" : row.assignee ?? "";
  await run(async () => {
    checked(await api.assignments.set({ household, entries: [{ task: row.task, ...(assignee && { assignee }) }] }));
    await loadAssignments();
    return row.weekly ? "Weekly assignment updated." : "Assignment updated.";
  });
}

function deleteAssignment(row: AssignmentRow) {
  const chore = row.chore?.name ?? "this chore";
  const question = row.weekly
    ? `Delete all dates in the weekly assignment for “${chore}”?`
    : `Delete the task for “${chore}” due ${dueDate(row)}?`;
  if (!window.confirm(question)) return;
  void run(async () => {
    checked(await api.assignments.tasks.delete({ household, task: row.task }));
    await loadAssignments();
    return row.weekly ? "Weekly assignment deleted." : "Task deleted.";
  });
}

function loadWeek() {
  if (week.value) void run(async () => { await loadAssignments(); return ""; });
}
onMounted(loadWeek);
</script>

<template>
  <div class="management">
    <p v-if="message" class="notice notice-visible" role="status">{{ message }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <section class="panel alpha-card">
      <h2>Household members</h2>
      <ul>
        <li v-for="p in catalog.people" :key="p.person">
          {{ p.username }} · {{ catalog.ranking.find(r => r.person === p.person)?.score ?? 0 }}
          {{ catalog.ranking.find(r => r.person === p.person)?.score === 1 ? 'point' : 'points' }}
        </li>
      </ul>
      <form @submit.prevent="run(addResident)">
        <label>Registered username<input v-model="username" required></label>
        <button class="button button-secondary" :disabled="busy">Add resident</button>
      </form>
    </section>

    <section class="panel alpha-card">
      <h2>Assignment schedule</h2>
      <label>Week starting<input v-model="week" type="date" required :disabled="busy" @change="loadWeek"></label>
      <button class="button button-primary" :disabled="busy || !week" @click="run(autoSchedule)">Assign available residents</button>
      <p v-if="!assignments.length && !busy">No assignments in this week.</p>
      <template v-else-if="assignments.length">
        <p>{{ assignments.length }} {{ assignments.length === 1 ? 'assignment' : 'assignments' }} · {{ waiting }} to assign</p>
        <ul>
          <li v-for="row in assignments" :key="row.task" class="schedule-row">
            <div>
              <strong>{{ row.chore?.name ?? 'Chore' }}</strong>
              <template v-if="row.weekly">
                <p>Weekly on {{ weekdayFormat.format(new Date(row.startsAt)) }} · {{ calendarDate(row.startsAt) }} through {{ calendarDate(row.endsAt) }}</p>
                <p>{{ row.occurrences - row.remaining }} of {{ row.occurrences }} dates completed</p>
              </template>
              <p v-else>Due {{ dueDate(row) }} · {{ !row.remaining ? 'completed' : new Date(row.endsAt) < new Date() ? 'overdue' : 'pending' }}</p>
            </div>
            <div class="actions-inline">
              <span v-if="!row.remaining">{{ nameOf(row.assignee) }}</span>
              <select v-else :value="row.mixed ? 'mixed' : row.assignee ?? ''" :disabled="busy"
                :aria-label="`Assignee for ${row.chore?.name ?? 'chore'} ${row.weekly ? 'weekly through' : 'due'} ${dueDate(row)}`"
                @change="assign(row, $event.target as HTMLSelectElement)">
                <option v-if="row.mixed" value="mixed" disabled>Mixed assignees</option>
                <option value="">Unassigned</option>
                <option v-for="p in catalog.people" :key="p.person" :value="p.person">{{ p.username }}</option>
              </select>
              <button type="button" class="button button-delete" :disabled="busy"
                :aria-label="`Delete ${row.weekly ? 'weekly assignment' : 'task'} for ${row.chore?.name ?? 'chore'} through ${dueDate(row)}`"
                @click="deleteAssignment(row)">{{ row.weekly ? 'Delete series' : 'Delete task' }}</button>
            </div>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
