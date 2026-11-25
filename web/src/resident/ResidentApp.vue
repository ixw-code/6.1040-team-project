<script setup lang="ts">
// The household workspace mounts this board for residents and for the overseer’s own tasks.
import "./resident.css";
import { computed } from "vue";
import TabBar from "./components/TabBar.vue";
import { useNav } from "./nav.ts";
import AttemptScreen from "./screens/AttemptScreen.vue";
import AvailabilityScreen from "./screens/AvailabilityScreen.vue";
import CalendarScreen from "./screens/CalendarScreen.vue";
import ImageViewerScreen from "./screens/ImageViewerScreen.vue";
import MyTasksScreen from "./screens/MyTasksScreen.vue";
import PhotoPreviewScreen from "./screens/PhotoPreviewScreen.vue";
import PreferencesScreen from "./screens/PreferencesScreen.vue";
import TaskDetailScreen from "./screens/TaskDetailScreen.vue";

const nav = useNav();
const screen = computed(() => nav.current.value);
/** Key that changes on every navigation, so screens remount and reload their data. */
const screenKey = computed(() => `${nav.tab.value}:${JSON.stringify(screen.value, (k, v) => (k === "file" ? undefined : v))}`);
</script>

<template>
  <div class="resident rs-cork">
    <div :key="screenKey" class="resident-main">
      <MyTasksScreen v-if="screen.name === 'tasks'" />
      <CalendarScreen v-else-if="screen.name === 'calendar'" />
      <AvailabilityScreen v-else-if="screen.name === 'availability'" />
      <PreferencesScreen v-else-if="screen.name === 'prefs'" />
      <TaskDetailScreen v-else-if="screen.name === 'task'" :task-id="screen.taskId" />
      <PhotoPreviewScreen v-else-if="screen.name === 'photo'" :task-id="screen.taskId" :file="screen.file" />
      <AttemptScreen v-else-if="screen.name === 'attempt'" :task-id="screen.taskId" :attempt-id="screen.attemptId" />
      <ImageViewerScreen v-else-if="screen.name === 'image'" :url="screen.url" :label="screen.label" />
    </div>
    <TabBar v-if="nav.isTabScreen.value" />
  </div>
</template>

<style scoped>
.resident-main { flex: 1; display: flex; flex-direction: column; }
</style>
