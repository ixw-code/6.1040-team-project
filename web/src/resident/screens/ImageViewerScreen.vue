<script setup lang="ts">
import BackLink from "../components/BackLink.vue";
import PhotoBox from "../components/PhotoBox.vue";

defineProps<{ url: string | null; label: string }>();
</script>

<template>
  <section class="viewer">
    <div class="top"><BackLink label="Back" light /></div>
    <div class="image"><PhotoBox :url="url" :label="label" text="Image" /></div>
    <p class="caption">{{ label }}</p>
  </section>
</template>

<style scoped>
.viewer { flex: 1; display: flex; flex-direction: column; background: #0d0d0d; color: #fffaf0; }
.top { padding: 14px 18px; }
.image { flex: 1; min-height: 0; display: flex; }
.image :deep(.photo) { object-fit: contain; background-color: #3a3a3a; color: #d8d8d8; }
.caption { margin: 0; padding: 18px; text-align: center; font-size: 17px; }
</style>
