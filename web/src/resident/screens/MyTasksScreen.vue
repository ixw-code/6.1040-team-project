<script setup lang="ts">
import { onMounted, ref } from "vue";
import StickyNote from "../components/StickyNote.vue";
import { STATUS_COLOR, STATUS_LABEL, formatDateTime, isOverdue, tilt } from "../display.ts";
import { useNav } from "../nav.ts";
import { getMyTasks } from "../residentApi.ts";
import { useSession } from "../../session.ts";
import type { Task } from "../types.ts";

const nav = useNav();
const { me, signOut } = useSession();
const tasks = ref<Task[] | null>(null);
const failed = ref(false);

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
      <div class="top">
        <h1 class="rs-title rs-heading">My Tasks</h1>
        <button type="button" class="signout rs-heading" @click="signOut">Sign Out</button>
      </div>
      <!-- TODO(backend): household name from HouseholdManaging._householdsByPerson(me). -->
      <p class="rs-body-text">{{ me?.username ? `Hi ${me.username} · ` : "" }}Maple House · this week</p>
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
.top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.signout { min-height: 44px; padding: 0; border: 0; background: none; color: var(--rs-ink); font-size: 1.15rem; text-decoration: underline; cursor: pointer; }
.board { margin: 0; padding: 14px 2px 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 22px 18px; }
.label { font-size: 17px; }
.overdue { color: var(--rs-overdue); }
.empty { margin: 40px 0 0; text-align: center; font-size: 28px; }
</style>