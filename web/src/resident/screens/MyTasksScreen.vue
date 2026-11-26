<script setup lang="ts">
import { onMounted, ref } from "vue";
import StickyNote from "../components/StickyNote.vue";
import { STATUS_COLOR, STATUS_LABEL, formatDateTime, isOverdue, tilt } from "../display.ts";
import { useNav } from "../nav.ts";
import { getMyTasks } from "../residentApi.ts";
import type { Task } from "../types.ts";
import { api } from "../../api.ts";
import { useSession } from "../../session.ts";

const nav = useNav();
const tasks = ref<Task[] | null>(null);
const failed = ref(false);
const householdName = ref("Your household");

onMounted(async () => {
  const result = await api.households.get({ household: useSession().household.value });
  if (!("error" in result)) householdName.value = result.household.name;
});

onMounted(async () => {
  try {
    const list = await getMyTasks();
    // Open work first, then by deadline.
    const rank = { redo: 0, todo: 1, submitted: 2, approved: 3 } as const;
    tasks.value = list.sort((a, b) => rank[a.status] - rank[b.status] || a.due.localeCompare(b.due));
  } catch {
    failed.value = true;
  }
});
</script>

<template>
  <section class="rs-screen">
    <header>
      <h1 class="rs-title rs-heading">My Tasks</h1>
      <p class="rs-body-text">{{ householdName }} · this week</p>
    </header>

    <p v-if="failed" class="rs-status-line rs-hand rs-error">Couldn't load your tasks. Try again.</p>
    <p v-else-if="!tasks" class="rs-status-line rs-hand">Loading…</p>
    <p v-else-if="tasks.length === 0" class="empty rs-hand">No tasks yet</p>

    <ul v-else class="board">
      <li v-for="task in tasks" :key="task.id">
        <StickyNote
          square
          clickable
          :color="STATUS_COLOR[task.status]"
          :tilt="tilt(task.id)"
          @open="nav.go({ name: 'task', taskId: task.id })"
        >
          <span>{{ task.title }}</span>
          <span :class="{ overdue: isOverdue(task) }">
            <span class="rs-heading label">{{ isOverdue(task) ? "Overdue:" : "Due:" }}</span> {{ formatDateTime(task.due) }}
          </span>
          <span><span class="rs-heading label">Status:</span> {{ STATUS_LABEL[task.status] }}</span>
        </StickyNote>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.board { margin: 0; padding: 14px 2px 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 22px 18px; }
.label { font-size: 17px; }
.overdue { color: var(--rs-overdue); }
.empty { margin: 40px 0 0; text-align: center; font-size: 28px; }
</style>