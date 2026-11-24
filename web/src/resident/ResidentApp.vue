<script setup lang="ts">
// Entry point for the resident side. App.vue renders this when the role switch is on "Resident view".
import "./resident.css";
import { computed } from "vue";
import TabBar from "./components/TabBar.vue";
import { useNav } from "./nav.ts";
import AttemptScreen from "./screens/AttemptScreen.vue";
import AvailabilityFormScreen from "./screens/AvailabilityFormScreen.vue";
import AvailabilityScreen from "./screens/AvailabilityScreen.vue";
import CalendarScreen from "./screens/CalendarScreen.vue";
import ImageViewerScreen from "./screens/ImageViewerScreen.vue";
import MyTasksScreen from "./screens/MyTasksScreen.vue";
import PhotoPreviewScreen from "./screens/PhotoPreviewScreen.vue";
import PreferencesScreen from "./screens/PreferencesScreen.vue";
import SwapScreen from "./screens/SwapScreen.vue";
import SwapsScreen from "./screens/SwapsScreen.vue";
import TaskDetailScreen from "./screens/TaskDetailScreen.vue";
import { useSession } from "../session.ts";

const { household } = useSession();

const nav = useNav();
const screen = computed(() => nav.current.value);
/** Key that changes on every navigation, so screens remount and reload their data. */
const screenKey = computed(() => `${nav.tab.value}:${JSON.stringify(screen.value, (k, v) => (k === "file" ? undefined : v))}`);
</script>

<template>
  <div class="resident rs-cork">
    <div class="resident rs-cork">
      <section v-if="!household" class="rs-screen">
        <p class="rs-status-line rs-hand">You're not in a household yet.</p>
      </section>
      <main v-else :key="screenKey" class="resident-main">
        <MyTasksScreen v-if="screen.name === 'tasks'" />
        <CalendarScreen v-else-if="screen.name === 'calendar'" />
        <AvailabilityScreen v-else-if="screen.name === 'availability'" />
        <PreferencesScreen v-else-if="screen.name === 'prefs'" />
        <SwapsScreen v-else-if="screen.name === 'swaps'" />
        <TaskDetailScreen v-else-if="screen.name === 'task'" :task-id="screen.taskId" />
        <PhotoPreviewScreen v-else-if="screen.name === 'photo'" :task-id="screen.taskId" :file="screen.file" />
        <AttemptScreen v-else-if="screen.name === 'attempt'" :task-id="screen.taskId" :attempt-id="screen.attemptId" />
        <ImageViewerScreen v-else-if="screen.name === 'image'" :url="screen.url" :label="screen.label" />
        <AvailabilityFormScreen v-else-if="screen.name === 'availabilityForm'" />
        <SwapScreen v-else-if="screen.name === 'swap'" :task-id="screen.taskId" />
      </main>
      <TabBar v-if="household && nav.isTabScreen.value" />
    </div>
  </div>
</template>

<style scoped>
.resident-main { flex: 1; display: flex; flex-direction: column; }
</style>
