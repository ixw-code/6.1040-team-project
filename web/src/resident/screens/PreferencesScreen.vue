<script setup lang="ts">
import { computed, ref } from "vue";
import { post, useHousehold } from "../../household.ts";

const { home, catalog } = useHousehold();
const saved = computed(() => catalog.value.choreOrder);
const choresById = computed(() => new Map(catalog.value.chores.map(chore => [chore.chore, chore])));
const alreadyRanked = new Set(saved.value);
const order = ref([
  ...saved.value,
  ...catalog.value.chores.filter(({ chore }) => !alreadyRanked.has(chore)).map(({ chore }) => chore),
]);
const changed = computed(() => order.value.length !== saved.value.length
  || order.value.some((chore, index) => chore !== saved.value[index]));
const message = ref("");
const error = ref("");
const busy = ref(false);

function move(index: number, direction: number) {
  const next = index + direction;
  if (next < 0 || next >= order.value.length) return;
  const revised = [...order.value];
  [revised[index], revised[next]] = [revised[next], revised[index]];
  order.value = revised;
  message.value = "";
  error.value = "";
}

async function save() {
  busy.value = true;
  message.value = "";
  error.value = "";
  try {
    const result = await post<{ order: string[] }>("catalog/preferences", { household: home.household, order: order.value });
    catalog.value.choreOrder = result.order;
    message.value = "Chore preferences saved.";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="rs-screen">
    <h1 class="rs-title rs-heading">Chore preferences</h1>
    <p v-if="!order.length">Your overseer can add chores to the catalog.</p>
    <form v-else class="ranking-form" @submit.prevent="save">
      <p>Put the chores you most want to do at the top, then save. This order is used when the overseer assigns tasks automatically.</p>
      <ol class="rs-paper" aria-label="Chore preference order">
        <li v-for="(id, index) in order" :key="id" class="schedule-row">
          <span>{{ index + 1 }}. {{ choresById.get(id)?.name }}</span>
          <div class="actions-inline">
            <button type="button" class="button button-secondary" :disabled="busy || index === 0"
              :aria-label="`Move ${choresById.get(id)?.name} up`" @click="move(index, -1)">Move up</button>
            <button type="button" class="button button-secondary" :disabled="busy || index === order.length - 1"
              :aria-label="`Move ${choresById.get(id)?.name} down`" @click="move(index, 1)">Move down</button>
          </div>
        </li>
      </ol>
      <button class="rs-pill rs-heading" :disabled="busy || !changed">Save preferences</button>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="error" class="rs-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.ranking-form { display: grid; gap: 1rem; }
.ranking-form > button { justify-self: start; }
</style>
