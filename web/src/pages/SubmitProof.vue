<script setup lang="ts">
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  loadMe,
  loadMyTasks,
  submitProof,
  type ProofSubmission,
  type ProofTask,
  type Resident,
} from "../submissions.ts";

type Photo = { blob: Blob; url: string };

const me = ref<Resident>();
const tasks = ref<ProofTask[]>([]);
const selectedTask = ref<string>("");
const photo = ref<Photo>();
const loading = ref(true);
const submitting = ref(false);
const error = ref("");
const submitted = ref<ProofSubmission>();
const showExample = ref(false);

const cameraInput = ref<HTMLInputElement>();

const task = computed(() => tasks.value.find((t) => t.task === selectedTask.value));

// The design study shows times as a large number with a small label: "10:00 PM" over "DUE TODAY".
const due = computed(() => {
  if (!task.value) return { label: "", time: "", period: "" };
  const at = task.value.due;
  const sameDay = at.toDateString() === new Date().toDateString();
  const [time = "", period = ""] = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).split(" ");
  const day = sameDay ? "today" : at.toLocaleDateString([], { weekday: "long" });
  return { label: `Due ${day}`, time, period };
});

onMounted(async () => {
  try {
    const [resident, mine] = await Promise.all([loadMe(), loadMyTasks()]);
    me.value = resident;
    tasks.value = mine;
    selectedTask.value = mine[0]?.task ?? "";
  } catch {
    error.value = "We couldn't load your chores. Check your connection and try again.";
  } finally {
    loading.value = false;
  }
});

// A photo belongs to one chore, so switching chores starts over.
watch(selectedTask, () => {
  clearPhoto();
  showExample.value = false;
  error.value = "";
});

onBeforeUnmount(clearPhoto);

function clearPhoto() {
  if (photo.value) URL.revokeObjectURL(photo.value.url);
  photo.value = undefined;
}

function openCamera() {
  error.value = "";
  cameraInput.value?.click();
}

function onCapture(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // let the same file be chosen again after a retake
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    error.value = "That file isn't a photo. Please take a picture of the finished chore.";
    return;
  }
  clearPhoto();
  photo.value = { blob: file, url: URL.createObjectURL(file) };
}

async function submit() {
  if (!task.value || !photo.value || submitting.value) return;
  submitting.value = true;
  error.value = "";
  try {
    submitted.value = await submitProof(task.value.task, photo.value.blob);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Your photo didn't go through. Please try again.";
  } finally {
    submitting.value = false;
  }
}

function startAnother() {
  const done = submitted.value?.task;
  submitted.value = undefined;
  tasks.value = tasks.value.filter((t) => t.task !== done);
  selectedTask.value = tasks.value[0]?.task ?? "";
  clearPhoto();
}
</script>

<template>
  <section class="board">
    <article class="card" aria-live="polite">
      <span class="pin" aria-hidden="true"></span>

      <p v-if="loading" class="status">Loading your chores…</p>

      <!-- Confirmation -->
      <div v-else-if="submitted && task" class="done">
        <div class="done-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>
        <h1 class="display">Sent for review</h1>
        <p class="lede">
          Your proof for <strong>{{ task.chore }}</strong> is with the Coordinator.
          You'll see their decision on your chores page.
        </p>
        <figure v-if="photo" class="polaroid">
          <img :src="photo.url" alt="Your submitted photo" />
          <figcaption>{{ task.chore }}</figcaption>
        </figure>
        <p class="pill">
          Waiting for review · sent
          {{ submitted.submittedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }}
        </p>
        <button v-if="tasks.length > 1" type="button" class="btn primary wide" @click="startAnother">
          Submit another chore
        </button>
      </div>

      <p v-else-if="tasks.length === 0" class="status">
        {{ error || "You have no chores waiting for proof. Nice work!" }}
      </p>

      <!-- Capture and review -->
      <template v-else-if="task">
        <header class="head">
          <label for="chore-select" class="tag">Chore</label>
          <span v-if="me" class="me" :title="`Signed in as ${me.name}`">
            <span class="avatar" aria-hidden="true">{{ me.name.charAt(0) }}</span>
            {{ me.name }}
          </span>
          <!-- The chore name gets its own full-width row so a long name or person never cuts it off. -->
          <select v-if="tasks.length > 1" id="chore-select" v-model="selectedTask" class="chore-name chore-select">
            <option v-for="t in tasks" :key="t.task" :value="t.task">{{ t.chore }}</option>
          </select>
          <h1 v-else id="chore-select" class="chore-name">{{ task.chore }}</h1>
        </header>

        <p class="stat">
          <span class="stat-value">{{ due.time }}<small>{{ due.period }}</small></span>
          <span class="stat-label">{{ due.label }}</span>
        </p>

        <section class="directions" aria-labelledby="directions-title">
          <h2 id="directions-title">Directions</h2>
          <ol>
            <li v-for="item in task.criteria" :key="item">{{ item }}</li>
          </ol>
          <template v-if="task.baseline">
            <button type="button" class="link" :aria-expanded="showExample" @click="showExample = !showExample">
              {{ showExample ? "Hide example" : "See an example" }}
            </button>
            <img v-if="showExample" :src="task.baseline" alt="Example of this chore done well" class="example" />
          </template>
        </section>

        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="visually-hidden"
          tabindex="-1"
          aria-hidden="true"
          @change="onCapture"
        />

        <button v-if="!photo" type="button" class="shutter" @click="openCamera">
          <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
            <path d="M17 9h14l3 5h6a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4h6l3-5Z" fill="var(--orange)" />
            <circle cx="24" cy="27" r="9" fill="var(--paper)" />
            <circle cx="24" cy="27" r="6" fill="var(--blue)" />
          </svg>
          <span class="shutter-label display">Take photo</span>
          <span class="shutter-hint">Show the whole area so every direction above is visible.</span>
        </button>

        <template v-else>
          <figure class="preview">
            <img :src="photo.url" :alt="`Your photo for ${task.chore}`" />
          </figure>

          <aside class="sticky" role="note">
            <span class="tape" aria-hidden="true"></span>
            <strong>Please make sure all criteria are met before submitting.</strong>
            If something's missing, finish it and retake the photo.
          </aside>

          <div class="actions">
            <button type="button" class="btn" :disabled="submitting" @click="openCamera">Retake</button>
            <button type="button" class="btn primary" :disabled="submitting" @click="submit">
              {{ submitting ? "Sending…" : "Submit" }}
            </button>
          </div>
        </template>

        <div v-if="error" class="error" role="alert">
          <span class="stamp">Not sent</span>
          <p>{{ error }}</p>
        </div>
      </template>
    </article>
  </section>
</template>

<style scoped>
/*
 * Follows the ShiftHappens design study:
 * - bulletin board: a soft background, never stark white or black; short pinned labels
 * - "Tide pods" (orange): action, so the Submit button and the camera
 * - "Clorox" (blue): check-offs and broad messages, plus label-style directions
 * - "Pink Stuff" (coral): errors, with all-caps stamp text
 * - sticky notes: bright notes; handwriting is kept for user-written text, so none here
 * - heavy rounded type for headings, chore names and buttons; clean type for directions
 */
.board {
  --ink: #1f1d1a;
  --muted: #6b6259;
  --paper: #fffdf8;
  --line: #e4dccd;
  --orange: #ffa347;
  --orange-deep: #f28b26;
  /* Darker orange for the due time text, so it stays readable on paper. */
  --orange-text: #d96f00;
  --blue: #4aa3ff;
  --blue-soft: #e2f0ff;
  --coral: #ff8fab;
  --coral-soft: #ffeef3;
  --coral-ink: #b0124a;
  --sticky: #ffe066;
  --display: "Nunito", ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  --label: "Helvetica Neue", Arial, system-ui, sans-serif;
  min-height: 100dvh;
  padding: 1.5rem 1rem 2.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  align-content: start;
  /* Cork: warm brown with light and dark flecks. */
  background-color: #b9844c;
  background-image:
    radial-gradient(rgb(90 52 20 / 0.35) 1px, transparent 1.6px),
    radial-gradient(rgb(240 200 150 / 0.3) 1px, transparent 1.5px);
  background-size: 11px 11px, 17px 17px;
  background-position: 0 0, 5px 8px;
  color: var(--ink);
  font-family: var(--label);
}

.display,
.chore-name,
.btn,
.stat-value,
.done h1 {
  font-family: var(--display);
}

.card {
  position: relative;
  width: min(100%, 30rem);
  background: var(--paper);
  border-radius: 16px;
  padding: 1.75rem 1.25rem 1.25rem;
  box-shadow: 0 2px 0 rgb(60 30 5 / 0.15), 0 16px 30px -14px rgb(50 25 5 / 0.6);
}

.pin {
  position: absolute;
  top: -9px;
  left: 50%;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #b8dcff, var(--blue) 62%);
  box-shadow: 0 3px 4px rgb(0 0 0 / 0.25);
}

.status {
  padding: 2rem 0;
  text-align: center;
  color: var(--muted);
}

.head {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.5rem 0.75rem;
}

.head .chore-name {
  grid-column: 1 / -1;
}

/* A short pinned label, like a tag on the bulletin board. */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  justify-self: start;
  padding: 0.15rem 0.55rem 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tag::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--blue);
}

.chore-name {
  display: block;
  margin: 0;
  font-size: 1.65rem;
  font-weight: 900;
  line-height: 1.15;
  color: var(--ink);
}

.chore-select {
  max-width: 100%;
  padding: 0.15rem 2rem 0.15rem 0.45rem;
  margin-left: -0.45rem;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6' fill='none' stroke='%23ff7a1a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 0.45rem center;
  appearance: none;
  cursor: pointer;
}

.chore-select:hover {
  border-color: var(--line);
}

.chore-select:focus-visible {
  outline: none;
  border-color: var(--ink);
}

.me {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding: 0.2rem 0.7rem 0.2rem 0.2rem;
  border-radius: 999px;
  background: #f3ece1;
  font-family: var(--display);
  font-size: 0.9rem;
  font-weight: 800;
}

.avatar {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  background: var(--orange);
  color: var(--ink);
  font-size: 0.85rem;
  font-weight: 900;
}

/* Large number, small label. */
.stat {
  display: grid;
  margin: 0.9rem 0 0;
}

.stat-value {
  font-size: 2.1rem;
  font-weight: 900;
  line-height: 1;
  color: var(--orange-text);
}

.stat-value small {
  margin-left: 0.2rem;
  font-size: 0.95rem;
  font-weight: 800;
}

.stat-label {
  margin-top: 0.2rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Clean product-label type: an all-caps header over numbered steps. */
.directions {
  margin: 1.1rem 0 1.25rem;
  padding: 0.9rem 1rem 1rem;
  border: 2px solid var(--blue);
  border-top-width: 8px;
  border-radius: 10px;
  background: #fff;
}

.directions h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--blue);
}

.directions ol {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
  display: grid;
  gap: 0.5rem;
}

.directions li {
  position: relative;
  padding-left: 2rem;
  font-size: 0.95rem;
  line-height: 1.4;
  counter-increment: step;
}

.directions li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  font-family: var(--display);
  font-size: 0.8rem;
  font-weight: 900;
}

.link {
  margin-top: 0.7rem;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--blue);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.example {
  display: block;
  width: 100%;
  margin-top: 0.6rem;
  border-radius: 8px;
}

.shutter {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  width: 100%;
  padding: 2.25rem 1rem;
  border: 3px dashed #d6c7ae;
  border-radius: 14px;
  background: #fbf6ee;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.shutter:hover {
  border-color: var(--orange);
  background: #fff3e8;
}

.shutter:focus-visible {
  outline: 3px solid var(--ink);
  outline-offset: 2px;
}

.shutter-label {
  font-size: 1.3rem;
  font-weight: 900;
}

.shutter-hint {
  max-width: 16rem;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
}

.preview {
  margin: 0;
  overflow: hidden;
  border-radius: 14px;
  background: #1d1b18;
  aspect-ratio: 3 / 4;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sticky {
  position: relative;
  margin: 1.1rem 0.25rem 1.1rem;
  padding: 1rem 0.95rem 0.8rem;
  background: var(--sticky);
  font-size: 0.9rem;
  line-height: 1.4;
  box-shadow: 0 6px 10px -8px rgb(60 40 10 / 0.6);
  transform: rotate(-0.8deg);
}

.sticky strong {
  display: block;
  margin-bottom: 0.15rem;
}

.tape {
  position: absolute;
  top: -9px;
  left: 50%;
  width: 64px;
  height: 18px;
  margin-left: -32px;
  background: rgb(255 255 255 / 0.6);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  transform: rotate(2deg);
}

.actions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.6rem;
}

.btn {
  min-height: 3rem;
  padding: 0.55rem 0.75rem;
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink);
  font-size: 1rem;
  font-weight: 900;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: #f3ece1;
}

.btn:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Orange for action, with a darker base like a pressable pod. */
.btn.primary {
  border-color: var(--orange);
  background: var(--orange);
  color: var(--ink);
  font-size: 1.1rem;
  box-shadow: 0 4px 0 var(--orange-deep);
}

.btn.primary:hover:not(:disabled) {
  background: #ffb066;
}

.btn.primary:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 var(--orange-deep);
}

.btn.wide {
  width: 100%;
  margin-top: 0.4rem;
}

/* Coral, never harsh red, with stamp-style all-caps text. */
.error {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  margin-top: 1rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  background: var(--coral-soft);
}

.error p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--coral-ink);
}

.stamp {
  flex-shrink: 0;
  padding: 0.1rem 0.4rem;
  border: 2.5px solid var(--coral);
  border-radius: 4px;
  color: var(--coral-ink);
  font-family: var(--display);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-4deg);
}

.done {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0 0.25rem;
  text-align: center;
}

.done h1 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 900;
}

.done-badge {
  display: grid;
  place-items: center;
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 50%;
  background: var(--blue);
  color: #fff;
  box-shadow: 0 4px 0 rgb(0 0 0 / 0.12);
}

.lede {
  max-width: 22rem;
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}

.lede strong {
  color: var(--ink);
}

.polaroid {
  margin: 0.4rem 0 0.2rem;
  padding: 0.5rem 0.5rem 0.6rem;
  background: #fff;
  box-shadow: 0 6px 14px -8px rgb(0 0 0 / 0.45);
  transform: rotate(-2.5deg);
}

.polaroid img {
  display: block;
  width: 9rem;
  height: 9rem;
  object-fit: cover;
}

.polaroid figcaption {
  margin-top: 0.4rem;
  font-family: var(--display);
  font-size: 0.8rem;
  font-weight: 800;
}

.pill {
  margin: 0.2rem 0 0;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .shutter {
    transition: none;
  }
}
</style>
