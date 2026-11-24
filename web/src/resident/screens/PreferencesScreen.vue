<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getPreferences, setPreference } from "../residentApi.ts";
import type { Preference } from "../types.ts";

const prefs = ref<Preference[] | null>(null);
const saved = ref("");
const failed = ref(false);

onMounted(async () => {
  try {
    prefs.value = await getPreferences();
  } catch {
    failed.value = true;
  }
});

async function change(pref: Preference, value: string) {
  pref.rating = value === "" ? null : Number(value);
  await setPreference(pref.choreId, pref.rating);
  saved.value = `Saved ${pref.chore}`;
}
</script>

<template>
  <section class="rs-screen">
    <header>
      <h1 class="rs-title rs-heading">Preferences</h1>
      <p class="rs-body-text">Rate: 1 = least, 10 = most</p>
    </header>

    <p v-if="failed" class="rs-status-line rs-hand rs-error">Couldn't load preferences. Try again.</p>
    <p v-else-if="!prefs" class="rs-status-line rs-hand">Loading…</p>
    <ul v-else class="rs-paper list">
      <li v-for="pref in prefs" :key="pref.choreId" class="row">
        <label :for="`pref-${pref.choreId}`" class="rs-hand chore">{{ pref.chore }}</label>
        <select
          :id="`pref-${pref.choreId}`"
          class="rs-select rs-serif"
          :value="pref.rating ?? ''"
          @change="change(pref, ($event.target as HTMLSelectElement).value)"
        >
          <!-- Unrated shows the house average. -->
          <option value="">Avg {{ pref.average.toFixed(1) }}</option>
          <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
        </select>
      </li>
    </ul>
    <p class="rs-visually-hidden" role="status">{{ saved }}</p>
  </section>
</template>

<style scoped>
.list { max-width: 560px; margin: 0; padding: 6px 16px; list-style: none; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 50px; border-bottom: 1px solid #c9d8ec; }
.row:last-child { border-bottom: 0; }
.chore { font-size: 21px; }
.rs-select { min-width: 96px; font-size: 17px; }
</style>
