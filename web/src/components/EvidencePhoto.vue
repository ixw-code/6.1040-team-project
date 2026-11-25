<script setup lang="ts">
import type { Photo } from "../review-preview.ts";

defineProps<{ photo: Photo }>();
</script>

<template>
  <span
    v-if="'sample' in photo"
    class="evidence-photo sample-photo"
    :class="photo.sample"
    role="img"
    :aria-label="photo.alt"
  ></span>
  <img v-else class="evidence-photo uploaded-photo" :src="photo.url" :alt="photo.alt" />
</template>
