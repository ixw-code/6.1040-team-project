<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api } from "../api.ts";
import { checked, post, useHousehold, weekWindow, type AssignmentRow } from "../household.ts";

const week = defineModel<string>("week", { required: true });
const { home, catalog, refresh } = useHousehold();
const household = home.household;
const username = ref("");
const assignments = ref<AssignmentRow[]>([]);
const waiting = computed(() => assignments.value.filter(row => row.remaining > 0 && !row.assignee).length);
const scores = computed(() => new Map(catalog.value.ranking.map(({ person, score }) => [person, score])));
const busy = ref(false);
const message = ref("");
const error = ref("");

const calendarDate = (date: string, timeZone: string | null) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: timeZone ?? undefined }).format(new Date(date));
function weeklyDays(row: AssignmentRow) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: row.timeZone ?? undefined });
  const first = weekday.format(new Date(row.startsAt));
  if (!row.flexibleDays) return first;
  const last = weekday.format(new Date(new Date(row.firstWindowEndsAt).getTime() - 1));
  return first === last ? first : `${first}–${last}`;
}
const dueDate = (row: AssignmentRow) => new Date(row.endsAt).toLocaleString();
const nameOf = (id: string | null) => catalog.value.people.find(p => p.person === id)?.username ?? "Former resident";
function points(person: string) {
  const score = scores.value.get(person) ?? 0;
  return `${score} ${score === 1 ? "point" : "points"}`;
}

function assignmentStatus(row: AssignmentRow) {
  if (!row.remaining) return "Completed";
  if (new Date(row.endsAt) < new Date()) return "Overdue";
  return "Pending";
}

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
  return `${scheduled.length} assigned. ${unassigned.length} still need a resident available for each occurrence.`;
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
watch(week, loadWeek, { immediate: true });
</script>

<template>
  <div class="management">
    <p v-if="message" class="notice notice-visible" role="status">{{ message }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <div class="review-layout">
      <section class="panel alpha-card" aria-labelledby="members-heading">
        <h2 id="members-heading" class="panel-title">Household members</h2>
        <ul class="member-list">
          <li v-for="p in catalog.people" :key="p.person" class="byline">
            <span class="avatar byline-avatar" aria-hidden="true">{{ p.username.slice(0, 2).toUpperCase() }}</span>
            <span>{{ p.username }} · {{ points(p.person) }}</span>
          </li>
        </ul>
        <form class="panel-section" @submit.prevent="run(addResident)">
          <label>Registered username<input v-model="username" required></label>
          <button class="button button-secondary" :disabled="busy">Add resident</button>
        </form>
      </section>

      <section class="panel alpha-card" aria-labelledby="schedule-heading">
        <h2 id="schedule-heading" class="panel-title">Assignment schedule</h2>
        <div class="actions-inline assignment-toolbar">
          <label>Week starting<input v-model="week" type="date" required :disabled="busy"></label>
          <button type="button" class="button button-primary" :disabled="busy || !week" @click="run(autoSchedule)">Assign available residents</button>
        </div>
        <p v-if="!assignments.length && !busy" class="panel-copy">No assignments in this week.</p>
        <template v-else-if="assignments.length">
          <p class="panel-copy">{{ assignments.length }} {{ assignments.length === 1 ? 'assignment' : 'assignments' }} · {{ waiting }} to assign</p>
          <ul class="panel-list">
            <li v-for="row in assignments" :key="row.task" class="schedule-row">
              <div>
                <div class="actions-inline">
                  <strong>{{ row.chore?.name ?? 'Chore' }}</strong>
                  <span v-if="!row.weekly" class="status-badge" :data-status="assignmentStatus(row).toLowerCase()">{{ assignmentStatus(row) }}</span>
                </div>
                <template v-if="row.weekly">
                  <p class="panel-copy">Weekly{{ row.flexibleDays ? '' : ' on' }} {{ weeklyDays(row) }} · {{ calendarDate(row.startsAt, row.timeZone) }} through {{ calendarDate(row.endsAt, row.timeZone) }}</p>
                  <p class="panel-copy">{{ row.occurrences - row.remaining }} of {{ row.occurrences }} dates completed</p>
                </template>
                <p v-else class="panel-copy"><template v-if="row.flexibleDays">Opens {{ new Date(row.startsAt).toLocaleString() }} · </template>Due {{ dueDate(row) }}</p>
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
                <button type="button" class="button button-danger" :disabled="busy"
                  :aria-label="`Delete ${row.weekly ? 'weekly assignment' : 'task'} for ${row.chore?.name ?? 'chore'} through ${dueDate(row)}`"
                  @click="deleteAssignment(row)">{{ row.weekly ? 'Delete series' : 'Delete task' }}</button>
              </div>
            </li>
          </ul>
        </template>
      </section>
    </div>
  </div>
</template>
