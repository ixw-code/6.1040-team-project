<script setup lang="ts">
// Alpha add/remove screen. Daily and Weekly are mutually exclusive; neither = one time.
import { reactive, ref } from "vue";
import BackLink from "../components/BackLink.vue";
import { addAvailability, removeAvailability } from "../residentApi.ts";
import type { AvailabilityChange, Repeat } from "../types.ts";

const today = new Date().toISOString().slice(0, 10);
const blank = (): AvailabilityChange => ({ date: today, from: "18:00", until: "22:00", repeat: "once" });

const forms = {
  add: { data: reactive(blank()), run: addAvailability, done: "Added." },
  remove: { data: reactive(blank()), run: removeAvailability, done: "Removed." },
};
const message = ref<Record<"add" | "remove", string>>({ add: "", remove: "" });
const busy = ref<"add" | "remove" | null>(null);

function toggle(kind: "add" | "remove", repeat: Repeat) {
  const data = forms[kind].data;
  data.repeat = data.repeat === repeat ? "once" : repeat;
}

async function save(kind: "add" | "remove") {
  const { data, run, done } = forms[kind];
  if (data.until <= data.from) { message.value[kind] = "End time must be after start time."; return; }
  busy.value = kind;
  try {
    await run({ ...data });
    message.value[kind] = done;
  } catch {
    message.value[kind] = "Couldn't save. Try again.";
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <section class="rs-screen">
    <BackLink />
    <form
      v-for="kind in (['add', 'remove'] as const)"
      :key="kind"
      class="rs-paper card"
      :class="kind"
      @submit.prevent="save(kind)"
    >
      <h2 class="rs-heading card-title">{{ kind === "add" ? "Add Time" : "Remove Time" }}</h2>
      <label class="row">
        <span class="rs-heading rs-label">Date:</span>
        <input v-model="forms[kind].data.date" type="date" class="rs-input" required />
      </label>
      <div class="row times">
        <span class="rs-heading rs-label">Time:</span>
        <input v-model="forms[kind].data.from" type="time" class="rs-input" :aria-label="`${kind} from`" required />
        <span>to</span>
        <input v-model="forms[kind].data.until" type="time" class="rs-input" :aria-label="`${kind} until`" required />
      </div>
      <div class="repeat">
        <label><input type="checkbox" class="rs-check" :checked="forms[kind].data.repeat === 'daily'" @change="toggle(kind, 'daily')" /> Daily</label>
        <label><input type="checkbox" class="rs-check" :checked="forms[kind].data.repeat === 'weekly'" @change="toggle(kind, 'weekly')" /> Weekly</label>
      </div>
      <button type="submit" class="rs-pill rs-heading" :class="{ 'rs-pill--light': kind === 'remove' }" :disabled="busy === kind">
        {{ kind === "add" ? "Add" : "Remove" }}
      </button>
      <p v-if="message[kind]" role="status" class="rs-hand msg">{{ message[kind] }}</p>
    </form>
  </section>
</template>

<style scoped>
.card { max-width: 460px; display: flex; flex-direction: column; gap: 10px; }
.card.add { background: var(--rs-approved); }
.card.remove { background: var(--rs-redo); }
.card-title { margin: 0; font-size: 30px; font-weight: 500; }
.row { display: grid; grid-template-columns: 52px 1fr; align-items: center; gap: 8px; }
.times { grid-template-columns: 52px 1fr auto 1fr; }
.repeat { display: flex; gap: 22px; }
.repeat label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.msg { margin: 0; font-size: 20px; }
</style>
