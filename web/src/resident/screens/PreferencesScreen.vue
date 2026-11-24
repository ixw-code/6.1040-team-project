<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../api.ts";
import { checked, useHousehold } from "../../household.ts";
const { home, person, categories } = useHousehold();
const input = { household: home.household, person };
const prefs = ref<Record<string, string>>({});
const message = ref(""), busy = ref(true);
async function load() {
  const result = checked(await api.households.preferences(input));
  prefs.value = Object.fromEntries(result.preferences.map(p => [p.category, p.preferenceLevel]));
}
onMounted(async () => { try { await load(); } finally { busy.value = false; } });
async function save(category: string, select: HTMLSelectElement) {
  const preferenceLevel = select.value as "PREFER" | "NEUTRAL" | "AVOID";
  select.value = prefs.value[category] ?? "NEUTRAL";
  busy.value = true;
  try {
    checked(await api.households.preferences.set({ ...input, category, preferenceLevel }));
    prefs.value[category] = preferenceLevel; message.value = "Preference saved.";
  } catch (e) { message.value = (e as Error).message; } finally { busy.value = false; }
}
</script>
<template>
  <section class="rs-screen"><h1 class="rs-title rs-heading">Chore preferences</h1>
    <p>The scheduler uses your preference for each work category.</p>
    <p v-if="!categories.length">Your overseer can add work categories.</p>
    <ul v-else class="rs-paper"><li v-for="c in categories" :key="c.category" class="schedule-row">
      <label :for="c.category">{{ c.name }}</label>
      <select :id="c.category" :value="prefs[c.category] ?? 'NEUTRAL'" :disabled="busy" @change="save(c.category, $event.target as HTMLSelectElement)">
        <option value="PREFER">Prefer</option><option value="NEUTRAL">Neutral</option><option value="AVOID">Avoid</option>
      </select>
    </li></ul><p role="status">{{ message }}</p>
  </section>
</template>
