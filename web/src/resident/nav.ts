// In-app navigation for the resident screens: a stack of screens under the current tab.
// Kept dependency-free on purpose (no vue-router) so it drops into App.vue without touching main.ts.
import { computed, ref } from "vue";
import type { TaskDetail } from "./types.ts";

export type Tab = "tasks" | "calendar" | "availability" | "prefs" | "swaps";
export const TABS: Tab[] = ["tasks", "calendar", "availability", "prefs", "swaps"];

export type Screen =
  | { name: Tab }
  | { name: "task"; taskId: string; calendarPreview?: TaskDetail }
  | { name: "photo"; taskId: string; file: File; baseline: string | null; criteria: string }
  | { name: "attempt"; taskId: string; attemptId: string }
  | { name: "image"; url: string | null; label: string }
  | { name: "availabilityForm" }
  | { name: "swap"; taskId: string };

const BACK_LABEL: Record<Screen["name"], string> = {
  tasks: "My Tasks",
  calendar: "Calendar",
  availability: "Availability",
  prefs: "Prefs",
  swaps: "Swaps",
  task: "Task",
  photo: "Photo",
  attempt: "Attempt",
  image: "Back",
  availabilityForm: "Availability",
  swap: "Swap",
};

const stack = ref<Screen[]>([{ name: "tasks" }]);

export function useNav() {
  const current = computed(() => stack.value[stack.value.length - 1]!);
  const previous = computed(() => stack.value[stack.value.length - 2]);
  const tab = computed(() => stack.value[0]!.name as Tab);
  const isTabScreen = computed(() => stack.value.length === 1);

  function go(screen: Screen) {
    stack.value = [...stack.value, screen];
    window.scrollTo(0, 0);
  }
  function back() {
    if (stack.value.length > 1) stack.value = stack.value.slice(0, -1);
  }
  function switchTab(next: Tab) {
    stack.value = [{ name: next }];
    window.scrollTo(0, 0);
  }
  /** Label for the "‹ …" link: the name of the screen you'd go back to. */
  const backLabel = computed(() => (previous.value ? BACK_LABEL[previous.value.name] : ""));

  return { current, previous, tab, isTabScreen, go, back, switchTab, backLabel };
}
