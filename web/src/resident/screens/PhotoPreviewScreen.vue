<script setup lang="ts">
// After the camera: Retake or Submit.
import { onBeforeUnmount, ref, watch } from "vue";
import { useNav } from "../nav.ts";
import { useResidentApi } from "../residentApi.ts";
const { submitPhoto } = useResidentApi();

const props = defineProps<{ taskId: string; file: File }>();
const nav = useNav();
const file = ref(props.file);
const url = ref("");
const busy = ref(false);
const error = ref("");
const camera = ref<HTMLInputElement>();

watch(file, (next, _, onCleanup) => {
  url.value = URL.createObjectURL(next);
  onCleanup(() => URL.revokeObjectURL(url.value));
}, { immediate: true });
onBeforeUnmount(() => URL.revokeObjectURL(url.value));

function retake(event: Event) {
  const input = event.target as HTMLInputElement;
  const next = input.files?.[0];
  input.value = "";
  if (next) file.value = next;
}

async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await submitPhoto(props.taskId, file.value);
    nav.back(); // Task detail reloads and shows Submitted.
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="preview">
    <header class="bar">
      <button type="button" class="rs-pill rs-pill--retake rs-heading" :disabled="busy" @click="camera?.click()">Retake</button>
      <button type="button" class="rs-pill rs-pill--submit rs-heading" :disabled="busy" @click="submit">
        {{ busy ? "Submitting…" : "Submit" }}
      </button>
      <input ref="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden @change="retake" />
    </header>
    <img :src="url" alt="The photo you just took" class="photo" />
    <p v-if="error" role="alert" class="rs-hand error">{{ error }}</p>
  </section>
</template>

<style scoped>
.preview { flex: 1; display: flex; flex-direction: column; background: #111; color: #fffaf0; }
.bar { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 2px solid #fffaf0; }
.photo { flex: 1; min-height: 0; width: 100%; object-fit: contain; background: #222; }
.error { margin: 0; padding: 12px 16px; font-size: 20px; color: #ffb4a8; }
</style>
