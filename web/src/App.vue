<script setup lang="ts">
import { computed, nextTick, ref, onMounted, watch } from "vue";
import PhotoBox from "./resident/components/PhotoBox.vue";
import ResidentApp from "./resident/ResidentApp.vue";
import { statusOf, type Attempt, type Chore, type Decision, type Photo, type ReviewStatus } from "./review-preview.ts";
import { api } from "./api.ts";
import { completionRequest, submissionBaselineImage, submissionImage } from "./completion-api.ts";
import PasswordForm from "./PasswordForm.vue";
import SignIn from "./SignIn.vue";
import { useSession } from "./session.ts";

const { me, household, checked, load, signOut } = useSession();
onMounted(load);

const role = ref<"overseer" | "resident">("resident");
const filter = ref<"pending" | "reviewed">("pending");
const attempts = ref<Attempt[]>([]);
const selectedId = ref("");
const note = ref("");
const noteError = ref("");
const noteField = ref<HTMLTextAreaElement>();
const announcement = ref("");
const homes = ref<{ household: string; name: string }[]>([]);
const choresById = ref<Record<string, Pick<Chore, "title" | "resident" | "initials" | "criteria">>>({});
const busy = ref(false);
const saving = ref(false);
const householdName = ref("");
const memberId = ref("");
const problem = ref("");
type Completion = { completion: {
  task: { task: string; title: string; assignee: string; criteria: string };
  history: { submission: string; submittedAt: string; reviewedAt: string | null; status: string; feedback: string }[];
} };

async function refresh() {
  if (!household.value) return;
  busy.value = true;
  problem.value = "";
  try {
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const input = { household: household.value, from, until };
    const queue = await completionRequest<{ queue: { items: { task: string }[] } }>("/completion/review-queue", { household: input.household });
    const rows = await api.assignments.schedule(input);
    if ("error" in rows) throw new Error(rows.error);
    const taskIds = new Set(rows.tasks.filter((row) => row.assignee || row.completedBy).map(({ task }) => task));
    for (const item of queue.queue.items) taskIds.add(item.task);
    const tasks = await Promise.all([...taskIds].map(
      (task) => completionRequest<Completion>("/completion/get", { task }).then((row) => row.completion),
    ));
    const photo = (url: string, alt: string): Photo => ({ url, alt });
    choresById.value = Object.fromEntries(tasks.map(({ task }) => [task.task, {
      title: task.title, resident: task.assignee, initials: "", criteria: task.criteria,
    }]));
    attempts.value = tasks.flatMap(({ task, history }) => history.toReversed().map((row): Attempt => ({
      id: row.submission, taskId: task.task, submittedAt: new Date(row.submittedAt),
      photo: photo(submissionImage(row.submission), "Submitted photo"),
      ...(row.reviewedAt && (row.status === "APPROVED" || row.status === "REJECTED") ? { review: {
        decision: row.status === "APPROVED" ? "approved" : "rejected",
        feedback: row.feedback, reviewedAt: new Date(row.reviewedAt),
      } } : {}),
    })));
  } catch (error) {
    problem.value = String(error);
  } finally {
    busy.value = false;
  }
}

watch(me, async (user) => {
  if (!user) {
    role.value = "resident";
    homes.value = [];
    household.value = "";
    return;
  }
  try {
    const result = await api.households.mine();
    if (me.value !== user) return;
    if ("error" in result) throw new Error(result.error);
    homes.value = result.households;
    household.value = homes.value[0]?.household ?? "";
  } catch (error) {
    problem.value = String(error);
  }
});
async function createHousehold() {
  saving.value = true;
  problem.value = "";
  try {
    const name = householdName.value.trim();
    const result = await api.households.create({ name });
    if ("error" in result) throw new Error(result.error);
    homes.value = [...homes.value, { household: result.household, name }];
    household.value = result.household;
    householdName.value = "";
  } catch (error) {
    problem.value = String(error);
  } finally {
    saving.value = false;
  }
}

async function addMember() {
  saving.value = true;
  problem.value = "";
  const result = await api.households.residents.add({ household: household.value, person: memberId.value.trim() });
  saving.value = false;
  if ("error" in result) {
    problem.value = result.error === "NOT_FOUND" ? "No account has that ID." : result.error === "CONFLICT"
      ? "They're already in this household." : "Couldn't add them. Try again.";
    return;
  }
  announcement.value = "Added them to the household.";
  memberId.value = "";
}

watch([household, role], () => {
  attempts.value = [];
  choresById.value = {};
  if (role.value === "overseer") void refresh();
});

const pending = computed(() => attempts.value.filter((attempt) => !attempt.review));
const reviewed = computed(() => attempts.value.filter((attempt) => attempt.review).toReversed());
const queue = computed(() => filter.value === "pending" ? pending.value : reviewed.value);
const selected = computed(() => queue.value.find((attempt) => attempt.id === selectedId.value) ?? queue.value[0]);
const chore = computed(() => selected.value && choresById.value[selected.value.taskId]);
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
  if (busy.value || saving.value) return;
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
  if (!selected.value || !chore.value || saving.value) return;
  if (decision === "rejected" && !note.value.trim()) {
    noteError.value = "Add feedback so the resident knows what to fix.";
    await nextTick();
    noteField.value?.focus();
    return;
  }
  saving.value = true;
  try {
    await completionRequest("/completion/review", {
      submission: selected.value.id, decision: decision === "approved" ? "APPROVE" : "REJECT", feedback: note.value,
    });
    selectAttempt("");
    await refresh();
  } catch (error) {
    noteError.value = String(error);
  } finally {
    saving.value = false;
  }
}

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

        <nav class="role-switch" aria-label="View">
          <button type="button" :aria-pressed="role === 'overseer'" @click="setRole('overseer')">Overseer view</button>
          <button type="button" :aria-pressed="role === 'resident'" @click="setRole('resident')">Resident view</button>
        </nav>

        <div class="profile">
          <div class="profile-name">{{ me.username }}</div>
          <span class="avatar profile-avatar" aria-hidden="true">{{ me.username.slice(0, 2).toUpperCase() }}</span>
          <button type="button" class="button button-secondary" @click="signOut">Sign out</button>
        </div>
      </div>
    </header>

    <main v-if="role === 'overseer'" class="workspace">
      <div class="page-heading">
        <div>
          <select v-model="household" aria-label="Household" :disabled="busy || saving">
            <option value="" disabled>Select a household</option>
            <option v-for="home in homes" :key="home.household" :value="home.household">{{ home.name }}</option>
          </select>
          <h1>{{ role === 'overseer' ? 'Review queue' : 'My chores' }}</h1>
          <p class="page-description">
            {{ role === 'overseer' ? 'Compare resident photos with the baseline before making a decision.'
              : 'Check your assignment and submit a photo when the work is done.' }}
          </p>
        </div>

      </div>

      <div class="notice" :class="{ 'notice-visible': announcement }" role="status">{{ announcement }}</div>

      <form @submit.prevent="createHousehold">
        <label>New household <input v-model="householdName" required /></label>
        <button type="submit" :disabled="busy || saving">Create household</button>
      </form>
      <form v-if="household" @submit.prevent="addMember">
        <label>Add member by ID <input v-model="memberId" autocomplete="off" required /></label>
        <button type="submit" :disabled="busy || saving">Add member</button>
      </form>
      <p v-if="problem" role="alert">{{ problem }}</p>
      <p v-if="busy" role="status">Loading…</p>
      <div v-else-if="role === 'overseer'" class="review-layout">
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
                <span class="thumbnail"><PhotoBox :url="'url' in attempt.photo ? attempt.photo.url : null" :label="attempt.photo.alt" /></span>
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
              <PhotoBox :url="'url' in selected.photo ? selected.photo.url : null" :label="selected.photo.alt" />
            </figure>
            <figure>
              <figcaption>Baseline photo</figcaption>
              <PhotoBox :url="submissionBaselineImage(selected.id)" label="Baseline photo" text="Baseline photo unavailable" />
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

    </main>
    <ResidentApp v-else />
  </template>
</template>