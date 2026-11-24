<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import EvidencePhoto from "./EvidencePhoto.vue";
import { evidenceUrl, post, useHousehold } from "../household.ts";

type Entry = {
  submission: string; task: string; title: string; person: string; baseline?: string; criteria: string;
  submittedAt: string; status?: string; feedback?: string;
};
const { home, catalog, refresh } = useHousehold();
const mode = ref<"review-queue" | "reviewed">("review-queue");
const items = ref<Entry[]>([]), selected = ref(""), feedback = ref(""), error = ref(""), message = ref("");
const busy = ref(false);
const entry = computed(() => items.value.find(i => i.submission === selected.value) ?? items.value[0]);
const nameOf = (person: string) => catalog.value.people.find(p => p.person === person)?.username ?? person;
watch(() => entry.value?.submission, () => { feedback.value = ""; });
async function load() {
  const result = await post<{ queue: { items: Entry[] } }>("completion/" + mode.value, { household: home.household });
  items.value = result.queue.items;
}
async function show(next: typeof mode.value) {
  busy.value = true; error.value = ""; message.value = ""; items.value = []; mode.value = next;
  try { await load(); } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
async function review(decision: "APPROVE" | "REJECT") {
  if (!entry.value || busy.value) return;
  if (decision === "REJECT" && !feedback.value.trim()) { error.value = "Add feedback so the resident knows what to fix."; return; }
  busy.value = true; error.value = "";
  try {
    await post("completion/review", { submission: entry.value.submission, decision, feedback: feedback.value.trim() });
    await load(); await refresh(); message.value = decision === "APPROVE" ? "Approved. Completion and credit recorded." : "Rejected. Feedback is available to the resident.";
  } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
onMounted(() => show(mode.value));
</script>
<template>
  <h2>Review queue</h2>
  <p v-if="message" class="notice notice-visible" role="status">{{ message }}</p><p v-if="error" class="field-error" role="alert">{{ error }}</p>
  <div class="review-layout">
    <aside class="panel queue-panel"><div class="queue-heading"><h2>Submissions</h2><div class="queue-filters">
      <button :disabled="busy" :aria-pressed="mode === 'review-queue'" @click="show('review-queue')">Pending</button>
      <button :disabled="busy" :aria-pressed="mode === 'reviewed'" @click="show('reviewed')">Reviewed</button>
    </div></div>
    <ul class="queue-list"><li v-for="i in items" :key="i.submission">
      <button :disabled="busy" class="queue-item" :aria-pressed="i.submission === entry?.submission" @click="selected = i.submission">
        <span class="queue-item-info"><strong>{{ i.title }}</strong><span>{{ nameOf(i.person) }}</span><time>{{ new Date(i.submittedAt).toLocaleString() }}</time></span>
      </button></li></ul>
    </aside>
    <article v-if="entry" class="panel detail-card"><h2>{{ entry.title }}</h2><p>{{ nameOf(entry.person) }}</p>
      <div class="photo-grid"><figure><figcaption>Submitted photo</figcaption><EvidencePhoto :photo="{ url: evidenceUrl(entry.submission), alt: 'Submitted photo' }" /></figure>
        <figure v-if="entry.baseline"><figcaption>Baseline photo</figcaption><EvidencePhoto :photo="{ url: evidenceUrl(entry.submission, 'baseline'), alt: 'Baseline photo' }" /></figure></div>
      <section class="criteria-card"><div><h3>Completion criteria</h3><p>{{ entry.criteria }}</p></div></section>
      <form v-if="mode === 'review-queue'" class="review-form" @submit.prevent="review('APPROVE')">
        <label for="feedback">Feedback (required for rejection)</label><textarea id="feedback" v-model="feedback" maxlength="2000" rows="3"></textarea>
        <div class="actions-inline"><button type="button" class="button button-secondary" :disabled="busy" @click="review('REJECT')">Reject</button>
          <button class="button button-primary" :disabled="busy">Approve</button></div>
      </form>
      <div v-else><strong>{{ entry.status }}</strong> {{ entry.feedback }}
        <button v-if="entry.status === 'APPROVED'" class="button button-link" :disabled="busy" @click="review('APPROVE')">Sync completion and credit</button>
      </div>
    </article>
    <p v-else class="panel alpha-card">{{ busy ? 'Loading submissions…' : 'No submissions in this queue.' }}</p>
  </div>
</template>
