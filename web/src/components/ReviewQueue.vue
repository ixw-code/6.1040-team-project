<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import EvidencePhoto from "./EvidencePhoto.vue";
import { evidenceUrl, post, useHousehold } from "../household.ts";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type Entry = {
  submission: string;
  title: string;
  person: string;
  baseline?: string;
  criteria: string;
  submittedAt: string;
  reviewedAt?: string;
  status?: ReviewStatus;
  feedback?: string;
};
const statusLabels: Record<ReviewStatus, string> = { PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected" };
const dateTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const formatDate = (value: string) => dateTime.format(new Date(value));
const { home, catalog, refresh } = useHousehold();
const mode = ref<"review-queue" | "reviewed">("review-queue");
const items = ref<Entry[]>([]), selected = ref(""), feedback = ref(""), error = ref(""), message = ref("");
const feedbackError = ref("");
const feedbackField = ref<HTMLTextAreaElement>();
const busy = ref(false);
const pendingCount = ref(0);
const entry = computed(() => items.value.find(item => item.submission === selected.value) ?? items.value[0]);
const status = computed(() => entry.value?.status ?? "PENDING");
const nameOf = (person: string) => catalog.value.people.find(member => member.person === person)?.username ?? person;

watch(() => entry.value?.submission, () => {
  feedback.value = "";
  feedbackError.value = "";
});

async function load() {
  const result = await post<{ queue: { items: Entry[] } }>("completion/" + mode.value, { household: home.household });
  items.value = result.queue.items;
  if (mode.value === "review-queue") pendingCount.value = items.value.length;
}

async function show(next: typeof mode.value) {
  busy.value = true;
  error.value = "";
  message.value = "";
  items.value = [];
  selected.value = "";
  mode.value = next;
  try { await load(); } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}

async function review(decision: "APPROVE" | "REJECT") {
  if (!entry.value || busy.value) return;
  if (decision === "REJECT" && !feedback.value.trim()) {
    feedbackError.value = "Add feedback so the resident knows what to fix.";
    await nextTick();
    feedbackField.value?.focus();
    return;
  }
  busy.value = true;
  error.value = "";
  message.value = "";
  feedbackError.value = "";
  try {
    await post("completion/review", { submission: entry.value.submission, decision, feedback: feedback.value.trim() });
    await load();
    await refresh();
    message.value = decision === "APPROVE" ? "Approved. Completion and credit recorded." : "Rejected. Feedback is available to the resident.";
  } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; }
}

onMounted(() => show(mode.value));
</script>

<template>
  <p class="notice" :class="{ 'notice-visible': message }" role="status">{{ message }}</p>
  <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  <div class="review-layout">
    <aside class="panel queue-panel" aria-labelledby="submissions-heading">
      <div class="queue-heading">
        <h2 id="submissions-heading">Submissions</h2>
        <div class="queue-filters" aria-label="Filter submissions">
          <button type="button" :disabled="busy" :aria-pressed="mode === 'review-queue'" @click="show('review-queue')">
            Pending <span class="queue-count" aria-hidden="true">{{ pendingCount }}</span>
          </button>
          <button type="button" :disabled="busy" :aria-pressed="mode === 'reviewed'" @click="show('reviewed')">Reviewed</button>
        </div>
      </div>

      <ul v-if="items.length" class="queue-list">
        <li v-for="item in items" :key="item.submission">
          <button type="button" class="queue-item" :disabled="busy" :aria-pressed="item.submission === entry?.submission"
            @click="selected = item.submission">
            <span class="thumbnail" aria-hidden="true">
              <EvidencePhoto :photo="{ url: evidenceUrl(item.submission), alt: '' }" />
            </span>
            <span class="queue-item-info">
              <strong>{{ item.title }}</strong>
              <span>{{ nameOf(item.person) }}</span>
              <span v-if="item.status" class="queue-item-status" :data-status="item.status.toLowerCase()">{{ statusLabels[item.status] }}</span>
              <time v-else :datetime="item.submittedAt">{{ formatDate(item.submittedAt) }}</time>
            </span>
          </button>
        </li>
      </ul>
      <p v-else-if="!busy && !error" class="queue-empty">{{ mode === 'review-queue' ? 'No pending submissions.' : 'No reviewed submissions yet.' }}</p>
    </aside>

    <article v-if="entry" class="panel detail-card" aria-labelledby="review-title">
      <div class="detail-heading">
        <div>
          <h2 id="review-title">{{ entry.title }}</h2>
          <div class="byline">
            <span class="avatar byline-avatar" aria-hidden="true">{{ nameOf(entry.person).slice(0, 2).toUpperCase() }}</span>
            <span>{{ nameOf(entry.person) }}</span>
            <time :datetime="entry.submittedAt">{{ formatDate(entry.submittedAt) }}</time>
          </div>
        </div>
        <span class="status-badge" :data-status="status.toLowerCase()">{{ statusLabels[status] }}</span>
      </div>

      <div class="photo-grid" :class="{ 'photo-grid-single': !entry.baseline }">
        <figure>
          <figcaption>Submitted photo</figcaption>
          <EvidencePhoto :photo="{ url: evidenceUrl(entry.submission), alt: 'Submitted photo' }" />
        </figure>
        <figure v-if="entry.baseline">
          <figcaption>Baseline photo</figcaption>
          <EvidencePhoto :photo="{ url: evidenceUrl(entry.submission, 'baseline'), alt: 'Baseline photo' }" />
        </figure>
      </div>

      <section class="criteria-card" aria-label="Completion criteria">
        <span class="criteria-icon" aria-hidden="true"><span class="check-icon"></span></span>
        <div><h3>Completion criteria</h3><p>{{ entry.criteria }}</p></div>
      </section>

      <form v-if="mode === 'review-queue'" class="review-form" @submit.prevent="review('APPROVE')">
        <div class="feedback-label">
          <label for="feedback">Feedback<span class="visually-hidden"> (required for rejection)</span></label>
          <span id="feedback-hint">Required if rejecting</span>
        </div>
        <textarea id="feedback" ref="feedbackField" v-model="feedback" maxlength="2000" rows="2" :disabled="busy"
          placeholder="Add a note for the resident…" :aria-invalid="Boolean(feedbackError)"
          :aria-describedby="feedbackError ? 'feedback-error feedback-hint' : 'feedback-hint'" @input="feedbackError = ''"></textarea>
        <p v-if="feedbackError" id="feedback-error" class="field-error" role="alert">{{ feedbackError }}</p>
        <div class="form-actions">
          <button type="button" class="button button-danger" :disabled="busy" @click="review('REJECT')"><span aria-hidden="true">×</span> Reject</button>
          <button type="submit" class="button button-primary" :disabled="busy"><span class="check-icon" aria-hidden="true"></span> Approve</button>
        </div>
      </form>

      <section v-else class="review-summary" aria-label="Review decision">
        <h3>Review decision</h3>
        <p>{{ entry.feedback || statusLabels[status] }}</p>
        <time v-if="entry.reviewedAt" :datetime="entry.reviewedAt">{{ formatDate(entry.reviewedAt) }}</time>
        <button v-if="entry.status === 'APPROVED'" type="button" class="button button-link" :disabled="busy" @click="review('APPROVE')">Sync completion and credit</button>
      </section>
    </article>

    <section v-else class="panel empty-state">
      <p v-if="busy" role="status">Loading submissions…</p>
      <template v-else-if="!error">
        <span class="criteria-icon" aria-hidden="true"><span class="check-icon"></span></span>
        <h2>{{ mode === 'review-queue' ? 'You’re all caught up' : 'No reviews yet' }}</h2>
        <p>{{ mode === 'review-queue' ? 'New resident submissions will appear here.' : 'Approved and rejected submissions will appear here.' }}</p>
        <button v-if="mode === 'review-queue'" type="button" class="button button-secondary" @click="show('reviewed')">See reviewed submissions</button>
      </template>
      <button v-else type="button" class="button button-secondary" @click="show(mode)">Try again</button>
    </section>
  </div>
</template>
