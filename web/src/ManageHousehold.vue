<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "./api.ts";
import { checked, localDate, post, upload, useHousehold, weekWindow, type ScheduleRow } from "./household.ts";

const { home, catalog, categories, refresh } = useHousehold();
const household = home.household;
const username = ref(""), categoryName = ref(""), category = ref(""), title = ref(""), criteria = ref(""), instructions = ref("");
const difficulty = ref(1), file = ref<File>(), chore = ref(""), start = ref(""), due = ref("");
const week = ref(localDate(new Date()));
const schedule = ref<ScheduleRow[]>([]);
const busy = ref(false), message = ref(""), error = ref("");
const nameOf = (id: string) => catalog.value.people.find(p => p.person === id)?.username ?? id;

async function loadSchedule() {
  schedule.value = checked(await api.assignments.schedule({ household, ...weekWindow(week.value) })).tasks;
}
async function run(action: () => Promise<string>) {
  if (busy.value) return;
  busy.value = true; message.value = ""; error.value = "";
  try { message.value = await action(); }
  catch (e) { error.value = (e as Error).message; }
  finally { busy.value = false; }
}
async function addResident() {
  await post("catalog/add-resident", { household, username: username.value.trim() });
  username.value = ""; await refresh(); return "Resident added.";
}
async function addCategory() {
  const result = checked(await api.households.categories.add({ household, name: categoryName.value.trim() }));
  categoryName.value = ""; await refresh(); category.value = result.category; return "Category added.";
}
async function addChore() {
  if (!file.value) throw new Error("Choose a baseline photo.");
  const photo = await upload(file.value);
  const result = await post<{ chore: string }>("catalog/create", {
    household, category: category.value, name: title.value, criteria: criteria.value, description: instructions.value,
    difficulty: difficulty.value, photo,
  });
  await refresh(); chore.value = result.chore; title.value = ""; criteria.value = ""; instructions.value = "";
  return "Chore saved. Choose its time below to create an assignment.";
}
async function addTask() {
  const from = new Date(start.value), end = new Date(due.value);
  if (from >= end) throw new Error("The deadline must come after the start.");
  checked(await api.assignments.tasks.create({ household, chore: chore.value, deadline: end.toISOString(),
    interval: { start: from.toISOString(), end: end.toISOString() } }));
  week.value = localDate(from); await loadSchedule(); return "Assignment created.";
}
async function autoSchedule() {
  const result = checked(await api.assignments.weekly({ household, ...weekWindow(week.value) }));
  await loadSchedule();
  return `${result.scheduled.length} assigned. ${result.unassigned.length} still need availability covering the full time slot.`;
}
async function assign(row: ScheduleRow, select: HTMLSelectElement) {
  const id = select.value;
  select.value = row.assignee ?? "";
  await run(async () => {
    checked(await api.assignments.set({ household, entries: [{ task: row.task, ...(id && { assignee: id }) }] }));
    await loadSchedule(); return "Assignment updated.";
  });
}
onMounted(loadSchedule);
</script>
<template>
  <div class="management">
    <p v-if="message" class="notice notice-visible" role="status">{{ message }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div class="alpha-grid">
      <section class="panel alpha-card"><h2>Household members</h2>
        <ul><li v-for="p in catalog.people" :key="p.person">{{ p.username }} · {{ catalog.ranking.find(r => r.person === p.person)?.score ?? 0 }} {{ catalog.ranking.find(r => r.person === p.person)?.score === 1 ? 'point' : 'points' }}</li></ul>
        <form @submit.prevent="run(addResident)"><label>Registered username<input v-model="username" required></label>
          <button class="button button-secondary" :disabled="busy">Add resident</button></form>
      </section>
      <section class="panel alpha-card"><h2>Work categories</h2>
        <p>{{ categories.map(c => c.name).join(', ') || 'Add a category so residents can set their preferences.' }}</p>
        <form @submit.prevent="run(addCategory)"><label>Category name<input v-model="categoryName" required maxlength="100"></label>
          <button class="button button-secondary" :disabled="busy">Add category</button></form>
      </section>
      <form class="panel alpha-card" @submit.prevent="run(addChore)"><h2>Chore catalog</h2>
        <label>Chore name<input v-model="title" required maxlength="150"></label>
        <label>Category<select v-model="category" required><option disabled value="">Choose category</option><option v-for="c in categories" :key="c.category" :value="c.category">{{ c.name }}</option></select></label>
        <label>Effort (1–10)<input v-model.number="difficulty" type="number" required min="1" max="10"></label>
        <label>Photo instructions<textarea v-model="instructions" required maxlength="4000"></textarea></label>
        <label>Completion criteria<textarea v-model="criteria" required maxlength="4000"></textarea></label>
        <label>Baseline photo (JPG, PNG or WebP, up to 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp" required @change="file = ($event.target as HTMLInputElement).files?.[0]"></label>
        <button class="button button-primary" :disabled="busy || !categories.length">Save chore</button>
      </form>
      <form class="panel alpha-card" @submit.prevent="run(addTask)"><h2>Create assignment</h2>
        <label>Catalog chore<select v-model="chore" required><option disabled value="">Choose chore</option><option v-for="c in catalog.chores" :key="c.chore" :value="c.chore">{{ c.name }}</option></select></label>
        <label>Starts<input v-model="start" type="datetime-local" required></label>
        <label>Deadline<input v-model="due" type="datetime-local" required></label>
        <button class="button button-primary" :disabled="busy || !catalog.chores.length">Create assignment</button>
      </form>
    </div>
    <section class="panel alpha-card"><h2>Assignment schedule</h2>
      <label>Week starting<input v-model="week" type="date" required :disabled="busy" @change="week && run(async () => { await loadSchedule(); return ''; })"></label>
      <button class="button button-primary" :disabled="busy || !week" @click="run(autoSchedule)">Assign available residents</button>
      <p v-if="!schedule.length">No assignments in this week.</p>
      <div v-for="t in schedule" :key="t.task" class="schedule-row">
        <div><strong>{{ t.chore?.name ?? 'Chore' }}</strong><p>Due {{ new Date(t.deadline ?? t.interval!.end).toLocaleString() }} · {{ t.status.toLowerCase().replace('_',' ') }}</p></div>
        <span v-if="t.completedAt">{{ nameOf(t.completedBy!) }}</span>
        <select v-else :value="t.assignee ?? ''" :disabled="busy" :aria-label="'Assignee for ' + t.chore?.name" @change="assign(t, $event.target as HTMLSelectElement)">
          <option value="">Unassigned</option><option v-for="p in catalog.people" :key="p.person" :value="p.person">{{ p.username }}</option>
        </select>
      </div>
    </section>
  </div>
</template>
