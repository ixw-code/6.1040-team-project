<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import BackLink from "../components/BackLink.vue";
import { useNav } from "../nav.ts";
import { submitPhoto, uploadPhoto } from "../residentApi.ts";
import { prepareSubmissionPhoto } from "../submissionPhoto.ts";

const props = defineProps<{ taskId: string; file: File; baseline: string | null; criteria: string }>();
const nav = useNav();
const file = shallowRef(props.file);
const preparedPhoto = shallowRef<File>();
const photoUrl = ref("");
const uploadedPhoto = ref<string>();
const preparing = ref(false);
const busy = ref(false);
const error = ref("");
const camera = ref<HTMLInputElement>();
const baselineUnavailable = ref(false);

watch(file, async (next, _, onCleanup) => {
  let active = true;
  let url: string | undefined;
  onCleanup(() => {
    active = false;
    if (url) URL.revokeObjectURL(url);
  });

  preparing.value = true;
  preparedPhoto.value = undefined;
  uploadedPhoto.value = undefined;
  photoUrl.value = "";
  error.value = "";
  try {
    const photo = await prepareSubmissionPhoto(next);
    if (!active) return;
    url = URL.createObjectURL(photo);
    photoUrl.value = url;
    preparedPhoto.value = photo;
  } catch (reason) {
    if (active) error.value = reason instanceof Error ? reason.message : "Couldn't prepare this photo.";
  } finally {
    if (active) preparing.value = false;
  }
}, { immediate: true });

function replacePhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const next = input.files?.[0];
  input.value = "";
  if (next && !busy.value) file.value = next;
}

async function submit() {
  if (!preparedPhoto.value || busy.value) return;
  const screen = nav.current.value;
  busy.value = true;
  error.value = "";
  try {
    uploadedPhoto.value ??= await uploadPhoto(preparedPhoto.value);
    await submitPhoto(props.taskId, uploadedPhoto.value);
    if (nav.current.value === screen) nav.back();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "Couldn't submit the photo. Try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="preview">
    <header>
      <BackLink light :disabled="busy" />
      <h1 class="rs-heading">Compare your photo</h1>
    </header>
    <div class="comparison">
      <figure>
        <figcaption>Your photo</figcaption>
        <div class="evidence">
          <img v-if="photoUrl" :src="photoUrl" alt="Your selected photo" />
          <p v-else-if="preparing" role="status">Preparing your photo…</p>
          <p v-else>Choose another photo to continue.</p>
        </div>
      </figure>
      <figure>
        <figcaption>Baseline photo</figcaption>
        <div class="evidence">
          <img v-if="baseline && !baselineUnavailable" :src="baseline" alt="Baseline photo" @error="baselineUnavailable = true" />
          <p v-else>{{ baseline ? "Baseline photo unavailable." : "No baseline photo was provided." }}</p>
        </div>
      </figure>
    </div>
    <section v-if="criteria">
      <h2 class="rs-heading">Completion criteria</h2>
      <p class="criteria">{{ criteria }}</p>
    </section>
    <p v-if="error" role="alert" class="rs-hand error">{{ error }}</p>
    <div class="actions">
      <button type="button" class="rs-pill rs-pill--retake rs-heading" :disabled="busy" @click="camera?.click()">Retake or choose another</button>
      <button type="button" class="rs-pill rs-pill--submit rs-heading" :disabled="busy || !preparedPhoto" @click="submit">
        {{ busy ? "Submitting…" : "Submit for review" }}
      </button>
      <input ref="camera" type="file" accept="image/*" capture="environment" hidden @change="replacePhoto" />
    </div>
  </section>
</template>

<style scoped>
.preview { flex: 1; display: grid; align-content: start; gap: 18px; padding: 18px; background: #111; color: #fffaf0; }
.preview h1 { font-size: clamp(24px, 5vw, 36px); }
.preview h2 { font-size: 19px; }
.comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
figure { margin: 0; }
figcaption { margin-bottom: 6px; }
.evidence { display: grid; place-items: center; height: min(44vh, 400px); min-height: 160px; background: #242424; }
.evidence img { width: 100%; height: 100%; min-height: 0; object-fit: contain; }
.evidence p { padding: 10px; text-align: center; }
.criteria { margin: 4px 0 0; white-space: pre-line; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; }
.error { margin: 0; font-size: 20px; color: #ffb4a8; }
</style>
