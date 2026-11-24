<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../api.ts";
import { checked, type Home } from "../household.ts";
import { useSession } from "../session.ts";
import HouseholdWorkspace from "./HouseholdWorkspace.vue";

defineProps<{ person: string; username: string }>();
const homes = ref<Home[]>([]);
const selected = ref("");
const home = computed(() => homes.value.find(h => h.household === selected.value));
const name = ref("");
const creating = ref(false);
const busy = ref(false);
const error = ref("");
async function load(select?: string) {
  homes.value = checked(await api.households.mine()).households;
  selected.value = select ?? homes.value.find(h => h.household === selected.value)?.household ?? homes.value[0]?.household ?? "";
}
async function run(action: () => Promise<void>) {
  busy.value = true; error.value = "";
  try { await action(); } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
async function create() {
  const result = checked(await api.households.create({ name: name.value.trim() }));
  await load(result.household);
  creating.value = false; name.value = "";
}
const { signOut } = useSession();
onMounted(() => run(load));
</script>
<template>
  <header class="site-header"><div class="topbar alpha-bar">
    <div class="brand"><span class="brand-mark"><span class="check-icon"></span></span>Shift Happens</div>
    <select v-if="homes.length" v-model="selected" aria-label="Household"><option v-for="h in homes" :key="h.household" :value="h.household">{{ h.name }}</option></select>
    <div class="profile"><strong>{{ username }}</strong><button class="button button-secondary" @click="run(signOut)">Sign out</button></div>
  </div></header>
  <main class="workspace">
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div class="actions-inline">
      <button v-if="homes.length" class="button button-link" @click="creating = !creating">{{ creating ? 'Cancel' : 'New household' }}</button>
      <button class="button button-link" :disabled="busy" @click="run(load)">Refresh households</button>
    </div>
    <form v-if="creating || !home" class="panel alpha-card" @submit.prevent="run(create)">
      <h1>{{ home ? 'New household' : 'Your households' }}</h1>
      <p v-if="!home">Create a household to be its overseer, or give your username to your overseer and refresh after they add you.</p>
      <label>Household name<input v-model="name" required maxlength="100"></label>
      <button class="button button-primary" :disabled="busy">Create household</button>
    </form>
    <HouseholdWorkspace v-if="home && !creating" :key="home.household + home.overseer + home.name" :home="home" :person="person" @changed="run(load)" />
  </main>
</template>
