<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ url: string | null; label: string; text?: string }>();
const failed = ref(false);
watch(() => props.url, () => { failed.value = false; });
</script>

<template>
  <img v-if="url && !failed" :src="url" :alt="label" class="photo" @error="failed = true" />
  <span v-else class="photo rs-placeholder rs-serif" role="img" :aria-label="label">{{ text ?? label }}</span>
</template>

<style scoped>
.photo { display: flex; width: 100%; height: 100%; object-fit: cover; font-size: 14px; }
</style>
