<script setup lang="ts">
// First screen for someone who isn't in a household yet: start one, or get added to one.
import { ref } from "vue";
import { api } from "../../api.ts";
import { useSession } from "../../session.ts";

const { me, household } = useSession();

const name = ref("");
const creating = ref(false);
const checking = ref(false);
const copied = ref(false);
const message = ref("");

async function start() {
  const trimmed = name.value.trim();
  if (!trimmed) { message.value = "Give your household a name."; return; }
  creating.value = true;
  message.value = "";
  const result = await api.households.create({ name: trimmed });
  creating.value = false;
  if ("error" in result) { message.value = "Couldn't create the household. Try again."; return; }
  household.value = result.household; // Selecting it swaps this screen for My Tasks.
}

async function checkAgain() {
  checking.value = true;
  message.value = "";
  const result = await api.households.mine();
  checking.value = false;
  if ("error" in result) { message.value = "Couldn't check. Try again."; return; }
  household.value = result.households[0]?.household ?? "";
  if (!household.value) message.value = "Not added yet. Ask your overseer, then check again.";
}

async function copyId() {
  await navigator.clipboard?.writeText(me.value?.user ?? "");
  copied.value = true;
}
</script>

<template>
  <section class="rs-screen">
    <h1 class="rs-title rs-heading">Welcome</h1>

    <form class="rs-paper card start" @submit.prevent="start">
      <h2 class="rs-heading card-title">Start a Household</h2>
      <label class="field">
        <span class="rs-heading rs-label">Name:</span>
        <input v-model="name" class="rs-input" maxlength="60" placeholder="Maple House" autocomplete="off" />
      </label>
      <button type="submit" class="rs-pill rs-heading" :disabled="creating">
        {{ creating ? "Creating…" : "Create Household" }}
      </button>
    </form>

    <section class="rs-paper card join">
      <h2 class="rs-heading card-title">Join a Household</h2>
      <p class="rs-body-text">Ask your household's overseer to add you with your ID:</p>
      <p class="id rs-serif">{{ me?.user }}</p>
      <div class="buttons">
        <button type="button" class="rs-pill rs-pill--light rs-heading" @click="copyId">{{ copied ? "Copied" : "Copy ID" }}</button>
        <button type="button" class="rs-pill rs-pill--light rs-heading" :disabled="checking" @click="checkAgain">
          {{ checking ? "Checking…" : "Check Again" }}
        </button>
      </div>
    </section>

    <p v-if="message" role="status" class="rs-status-line rs-hand">{{ message }}</p>
  </section>
</template>

<style scoped>
.card { max-width: 460px; display: flex; flex-direction: column; gap: 12px; }
.start { background: var(--rs-approved); transform: rotate(-.5deg); }
.join { background: var(--rs-todo); transform: rotate(.5deg); }
.card-title { margin: 0; font-size: 30px; font-weight: 500; }
.field { display: grid; grid-template-columns: 60px 1fr; align-items: center; gap: 8px; }
.id { margin: 0; padding: 8px 10px; background: var(--rs-paper); border: 2px dashed var(--rs-ink); font-size: 15px; word-break: break-all; user-select: all; }
.buttons { display: flex; gap: 10px; }
.buttons .rs-pill { flex: 1; padding: 0 12px; font-size: 1.15rem; white-space: nowrap; }
</style>