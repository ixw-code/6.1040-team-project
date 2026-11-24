<script setup lang="ts">
// A photo, or a striped placeholder when we don't have one yet (no photo storage on the backend).
defineProps<{ url: string | null; label: string; text?: string }>();
</script>

<template>
  <img v-if="url" :src="url" :alt="label" class="photo" />
  <span v-else class="photo rs-placeholder rs-serif" role="img" :aria-label="label">{{ text ?? label }}</span>
</template>

<style scoped>
.photo { display: flex; width: 100%; height: 100%; object-fit: cover; font-size: 14px; }
</style>
