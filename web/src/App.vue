<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, onMounted } from "vue";
import EvidencePhoto from "./EvidencePhoto.vue";
import {
  choresById, createPreviewAttempts, residentChore, reviewAttempt, statusOf, submitPhoto,
  type Decision, type Photo, type ReviewStatus,
} from "./review-preview.ts";
import PasswordForm from "./PasswordForm.vue";
import SignIn from "./SignIn.vue";
import { useSession } from "./session.ts";

const { me, checked, load } = useSession();
onMounted(load);

const role = ref<"overseer" | "resident">("overseer");
const filter = ref<"pending" | "reviewed">("pending");
const attempts = ref(createPreviewAttempts());
const selectedId = ref("");
const note = ref("");
const noteError = ref("");
const noteField = ref<HTMLTextAreaElement>();
const announcement = ref("");
const chosenPhoto = ref<{ photo: Photo; name: string }>();
const fileProblem = ref("");
const fileInput = ref<HTMLInputElement>();
const localPhotos = new Set<string>();

const pending = computed(() => attempts.value.filter((attempt) => !attempt.review));
const reviewed = computed(() => attempts.value.filter((attempt) => attempt.review).toReversed());
const queue = computed(() => filter.value === "pending" ? pending.value : reviewed.value);
const selected = computed(() => queue.value.find((attempt) => attempt.id === selectedId.value) ?? queue.value[0]);
const chore = computed(() => selected.value && choresById[selected.value.taskId]);
const residentAttempts = computed(() => attempts.value.filter((attempt) => attempt.taskId === residentChore.id));
const residentSubmission = computed(() => residentAttempts.value.at(-1));
const residentPhoto = computed(() => chosenPhoto.value?.photo ?? residentSubmission.value?.photo);
const residentStatus = computed(() => statusOf(residentSubmission.value));
const canSubmit = computed(() => residentStatus.value === "unsubmitted" || residentStatus.value === "rejected");

const statusLabels: Record<ReviewStatus | "unsubmitted", string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  unsubmitted: "Ready to submit",
};

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

function setRole(nextRole: "overseer" | "resident") {
  if (role.value !== nextRole) announcement.value = "";
  role.value = nextRole;
}

function selectAttempt(id: string) {
  selectedId.value = id;
  note.value = "";
  noteError.value = "";
}

function showQueue(nextFilter: "pending" | "reviewed") {
  if (filter.value === nextFilter) return;
  filter.value = nextFilter;
  selectAttempt("");
}

async function saveReview(decision: Decision) {
  if (!selected.value || !chore.value) return;
  const result = reviewAttempt(selected.value, decision, note.value);
  if (result === "missing-feedback") {
    noteError.value = "Add feedback so the resident knows what to fix.";
    await nextTick();
    noteField.value?.focus();
    return;
  }
  if (result === "saved") {
    announcement.value = decision === "approved" ? "Submission approved." : "Submission rejected and feedback shared.";
    selectAttempt("");
  }
}

function clearDraftPhoto() {
  const photo = chosenPhoto.value?.photo;
  if (photo && "url" in photo) {
    URL.revokeObjectURL(photo.url);
    localPhotos.delete(photo.url);
  }
  chosenPhoto.value = undefined;
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    fileProblem.value = "Choose a JPG, PNG, or WebP photo up to 10 MB.";
    return;
  }
  clearDraftPhoto();
  fileProblem.value = "";
  const url = URL.createObjectURL(file);
  localPhotos.add(url);
  chosenPhoto.value = { photo: { url, alt: "Resident's chore photo" }, name: file.name };
}

function useSample() {
  clearDraftPhoto();
  fileProblem.value = "";
  chosenPhoto.value = { photo: residentChore.baseline, name: "Sample kitchen photo" };
}

function sendPhoto() {
  if (!chosenPhoto.value || !canSubmit.value) return;
  if (submitPhoto(attempts.value, residentChore.id, chosenPhoto.value.photo)) {
    // The submission now owns the photo URL so it remains visible in the review queue.
    chosenPhoto.value = undefined;
    fileProblem.value = "";
    announcement.value = "Photo sent for review.";
  }
}

onUnmounted(() => {
  for (const url of localPhotos) URL.revokeObjectURL(url);
});
</script>

<template>
  <p v-if="!checked">Loading…</p>

  <SignIn v-else-if="!me" lead="Sign in to see your chores.">
    <PasswordForm />
  </SignIn>

  <template v-else>
    <header class="site-header">
      <div class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"><span class="check-icon"></span></span>
          <span>Shift Happens</span>
        </div>

        <nav class="role-switch" aria-label="Preview as">
          <button type="button" :aria-pressed="role === 'overseer'" @click="setRole('overseer')">Overseer view</button>
          <button type="button" :aria-pressed="role === 'resident'" @click="setRole('resident')">Resident view</button>
        </nav>

        <div class="profile">
          <div class="profile-name">{{ role === 'overseer' ? 'Jim Brooks' : 'Alice Chen' }}</div>
          <span class="avatar profile-avatar" aria-hidden="true">{{ role === 'overseer' ? 'JB' : 'AC' }}</span>
        </div>
      </div>
    </header>

    <main class="workspace">
      <div class="page-heading">
        <div>
          <p class="household"><span class="house-icon" aria-hidden="true"></span> Maple House</p>
          <h1>{{ role === 'overseer' ? 'Review queue' : 'My chores' }}</h1>
          <p class="page-description">
            {{ role === 'overseer' ? 'Compare resident photos with the baseline before making a decision.'
              : 'Check your assignment and submit a photo when the work is done.' }}
          </p>
        </div>
        <span class="preview-label">Local preview</span>
      </div>

      <div class="notice" :class="{ 'notice-visible': announcement }" role="status">{{ announcement }}</div>

      <div v-if="role === 'overseer'" class="review-layout">
        <aside class="panel queue-panel" aria-labelledby="submissions-heading">
          <div class="queue-heading">
            <h2 id="submissions-heading">Submissions</h2>
            <div class="queue-filters" aria-label="Filter submissions">
              <button type="button" :aria-pressed="filter === 'pending'" @click="showQueue('pending')">
                Pending <span class="queue-count">{{ pending.length }}</span>
              </button>
              <button type="button" :aria-pressed="filter === 'reviewed'" @click="showQueue('reviewed')">Reviewed</button>
            </div>
          </div>

          <ul v-if="queue.length" class="queue-list">
            <li v-for="attempt in queue" :key="attempt.id">
              <button type="button" class="queue-item" :aria-pressed="selected?.id === attempt.id" @click="selectAttempt(attempt.id)">
                <span class="thumbnail"><EvidencePhoto :photo="attempt.photo" /></span>
                <span class="queue-item-info">
                  <strong>{{ choresById[attempt.taskId].title }}</strong>
                  <span>{{ choresById[attempt.taskId].resident }}</span>
                  <span v-if="attempt.review" class="queue-item-status" :data-status="attempt.review.decision">
                    {{ statusLabels[attempt.review.decision] }}
                  </span>
                  <time v-else :datetime="attempt.submittedAt.toISOString()">{{ dateTime.format(attempt.submittedAt) }}</time>
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="queue-empty">{{ filter === 'pending' ? 'No pending submissions.' : 'No reviewed submissions yet.' }}</p>
        </aside>

        <article v-if="selected && chore" class="panel detail-card" aria-labelledby="review-title">
          <div class="detail-heading">
            <div>
              <h2 id="review-title">{{ chore.title }}</h2>
              <div class="byline">
                <span class="avatar byline-avatar" aria-hidden="true">{{ chore.initials }}</span>
                <span>{{ chore.resident }}</span>
                <time :datetime="selected.submittedAt.toISOString()">{{ dateTime.format(selected.submittedAt) }}</time>
              </div>
            </div>
            <span class="status-badge" :data-status="statusOf(selected)">{{ statusLabels[statusOf(selected)] }}</span>
          </div>

          <div class="photo-grid">
            <figure>
              <figcaption>Submitted photo</figcaption>
              <EvidencePhoto :photo="selected.photo" />
            </figure>
            <figure>
              <figcaption>Baseline photo</figcaption>
              <EvidencePhoto :photo="chore.baseline" />
            </figure>
          </div>

          <section class="criteria-card" aria-label="Completion criteria">
            <span class="criteria-icon" aria-hidden="true"><span class="check-icon"></span></span>
            <div><h3>Completion criteria</h3><p>{{ chore.criteria }}</p></div>
          </section>

          <form v-if="!selected.review" class="review-form" @submit.prevent="saveReview('approved')">
            <div class="feedback-label">
              <label for="review-note">Feedback</label>
              <span id="feedback-hint">Required if rejecting</span>
            </div>
            <textarea
              id="review-note" ref="noteField" v-model="note" rows="2" maxlength="2000"
              placeholder="Add a note for the resident…"
              :aria-invalid="Boolean(noteError)" :aria-describedby="noteError ? 'feedback-error feedback-hint' : 'feedback-hint'"
              @input="noteError = ''"
            ></textarea>
            <p v-if="noteError" id="feedback-error" class="field-error" role="alert">{{ noteError }}</p>
            <div class="form-actions">
              <button class="button button-danger" type="button" @click="saveReview('rejected')"><span aria-hidden="true">×</span> Reject</button>
              <button class="button button-primary" type="submit"><span class="check-icon" aria-hidden="true"></span> Approve</button>
            </div>
          </form>

          <section v-else class="review-summary" aria-label="Review decision">
            <h3>Review decision</h3>
            <p>{{ selected.review.feedback || statusLabels[selected.review.decision] }}</p>
            <time :datetime="selected.review.reviewedAt.toISOString()">{{ dateTime.format(selected.review.reviewedAt) }}</time>
          </section>
        </article>

        <section v-else class="panel empty-state">
          <span class="criteria-icon" aria-hidden="true"><span class="check-icon"></span></span>
          <h2>{{ filter === 'pending' ? 'You’re all caught up' : 'No reviews yet' }}</h2>
          <p>{{ filter === 'pending' ? 'New resident submissions will appear here.' : 'Approved and rejected submissions will appear here.' }}</p>
          <button v-if="filter === 'pending' && reviewed.length" type="button" class="button button-secondary" @click="showQueue('reviewed')">See reviewed submissions</button>
        </section>
      </div>

      <div v-else class="resident-layout">
        <article class="panel detail-card" aria-labelledby="resident-task">
          <div class="detail-heading">
            <div>
              <h2 id="resident-task">{{ residentChore.title }}</h2>
              <p class="resident-assignee">Assigned to {{ residentChore.resident }}</p>
            </div>
            <span class="status-badge" :data-status="residentStatus">{{ residentStatus === 'rejected' ? 'Changes requested' : statusLabels[residentStatus] }}</span>
          </div>

          <section v-if="residentSubmission?.review?.feedback" class="resident-feedback" :data-status="residentStatus">
            <h3>Overseer feedback</h3>
            <p>{{ residentSubmission.review.feedback }}</p>
          </section>

          <div class="photo-grid resident-photos">
            <figure>
              <figcaption>Baseline photo</figcaption>
              <EvidencePhoto :photo="residentChore.baseline" />
            </figure>
            <figure v-if="residentPhoto">
              <figcaption>{{ chosenPhoto ? 'Photo preview' : 'Your last submission' }}</figcaption>
              <EvidencePhoto :photo="residentPhoto" />
            </figure>
          </div>

          <section class="criteria-card" aria-label="Completion criteria">
            <span class="criteria-icon" aria-hidden="true"><span class="check-icon"></span></span>
            <div><h3>Completion criteria</h3><p>{{ residentChore.criteria }}</p></div>
          </section>

          <form v-if="canSubmit" class="upload-form" @submit.prevent="sendPhoto">
            <h3>{{ residentStatus === 'rejected' ? 'Resubmit a photo' : 'Submit a photo' }}</h3>
            <p>{{ residentChore.photoInstructions }}</p>
            <input ref="fileInput" type="file" class="visually-hidden" tabindex="-1" accept="image/jpeg,image/png,image/webp" aria-label="Chore photo" @change="chooseFile" />
            <p v-if="fileProblem" class="field-error" role="alert">{{ fileProblem }}</p>
            <p v-if="chosenPhoto" class="file-name">{{ chosenPhoto.name }}</p>
            <div class="upload-actions">
              <button type="button" class="button button-secondary" @click="fileInput?.click()">{{ chosenPhoto ? 'Change photo' : 'Choose photo' }}</button>
              <button type="button" class="button button-link" @click="useSample">Use sample photo</button>
              <button type="submit" class="button button-primary" :disabled="!chosenPhoto">Submit for review</button>
            </div>
          </form>
          <div v-else class="resident-result">
            {{ residentStatus === 'approved' ? 'This chore is complete.' : 'Your photo is waiting for Overseer review.' }}
          </div>
        </article>

        <aside class="panel history-panel" aria-labelledby="history-heading">
          <h2 id="history-heading">Submission history</h2>
          <ol v-if="residentAttempts.length" class="history-list">
            <li v-for="attempt in residentAttempts.toReversed()" :key="attempt.id">
              <span class="status-badge" :data-status="statusOf(attempt)">{{ statusLabels[statusOf(attempt)] }}</span>
              <time :datetime="attempt.submittedAt.toISOString()">{{ dateTime.format(attempt.submittedAt) }}</time>
              <p v-if="attempt.review?.feedback">{{ attempt.review.feedback }}</p>
            </li>
          </ol>
          <p v-else class="queue-empty">No photos submitted yet.</p>
        </aside>
      </div>
      <footer class="workspace-footer">Sample data resets when you refresh.</footer>
    </main>
  </template>
</template>
