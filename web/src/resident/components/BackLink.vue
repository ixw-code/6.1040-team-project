<script setup lang="ts">
// "‹ My Tasks" style back link. Label defaults to the screen you'd return to.
import { computed } from "vue";
import { useNav } from "../nav.ts";

const props = defineProps<{ label?: string; light?: boolean }>();
const nav = useNav();
const text = computed(() => props.label ?? nav.backLabel.value);
</script>

<template>
  <button type="button" class="rs-back rs-heading" :style="light ? { color: '#fffaf0' } : undefined" @click="nav.back()">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    {{ text }}
  </button>
</template>
