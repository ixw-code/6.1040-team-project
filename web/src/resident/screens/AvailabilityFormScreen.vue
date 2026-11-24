<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api.ts";
import { checked, localDate, useHousehold } from "../../household.ts";
import BackLink from "../components/BackLink.vue";
import { useNav } from "../nav.ts";
const props = defineProps<{ removing?: boolean }>();
const { home } = useHousehold();
const nav = useNav();
const day = ref(localDate(new Date())), from = ref("18:00"), until = ref("22:00");
const error = ref(""), busy = ref(false);
const repeat = ref<"once" | "daily" | "weekly">("once");
async function save() {
  error.value = "";
  if (until.value <= from.value) { error.value = "End time must come after start time."; return; }
  busy.value = true;
  try {
    const count = repeat.value === "daily" ? 7 : repeat.value === "weekly" ? 4 : 1;
    const step = repeat.value === "weekly" ? 7 : 1;
    const windows = Array.from({ length: count }, (_, i) => {
      const start = new Date(day.value + "T" + from.value);
      const end = new Date(day.value + "T" + until.value);
      start.setDate(start.getDate() + i * step);
      end.setDate(end.getDate() + i * step);
      return { start: start.toISOString(), end: end.toISOString() };
    });
    checked(await api.assignments.availability.edit({ household: home.household, windows, adding: !props.removing }));
    nav.back();
  } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
</script>
<template>
  <section class="rs-screen"><BackLink />
    <form class="rs-paper alpha-card" @submit.prevent="save"><h1 class="rs-heading">{{ removing ? 'Remove availability' : 'Add availability' }}</h1>
      <label>Date<input v-model="day" required type="date"></label><label>From<input v-model="from" required type="time"></label>
      <label>Until<input v-model="until" required type="time"></label>
      <label>Repeat<select v-model="repeat"><option value="once">Once</option><option value="daily">Daily for 7 days</option><option value="weekly">Weekly for 4 weeks</option></select></label>
      <p v-if="error" role="alert">{{ error }}</p><button class="rs-pill rs-heading" :disabled="busy">Save availability</button>
    </form>
  </section>
</template>
