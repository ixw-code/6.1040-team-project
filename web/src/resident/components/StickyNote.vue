<script setup lang="ts">
// A pinned post-it. Renders as a <button> when clickable so it's keyboard reachable.
withDefaults(defineProps<{
  color: string;
  tilt?: string;
  /** Square note (My Tasks, swaps). Calendar notes stretch to their slot instead. */
  square?: boolean;
  clickable?: boolean;
  pin?: boolean;
  label?: string;
}>(), { tilt: "0deg", square: false, clickable: false, pin: true, label: undefined });

defineEmits<{ open: [] }>();
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="note rs-hand"
    :class="{ square, clickable }"
    :style="{ background: color, transform: `rotate(${tilt})` }"
    :aria-label="label"
    @click="clickable && $emit('open')"
  >
    <svg v-if="pin" class="pin" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="var(--rs-pin)" />
      <circle cx="7" cy="7" r="2.4" fill="#f3a093" />
    </svg>
    <slot />
  </component>
</template>

<style scoped>
.note {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  margin: 0;
  padding: 18px 12px 12px;
  border: 0;
  color: var(--rs-ink);
  text-align: left;
  font-size: 20px;
  line-height: 1.15;
  box-shadow: 0 6px 10px rgba(0, 0, 0, .3), inset 0 -10px 18px rgba(0, 0, 0, .05);
}
.square { aspect-ratio: 1; }
.clickable { cursor: pointer; }
.clickable:hover { box-shadow: 0 9px 14px rgba(0, 0, 0, .35); }
.pin { position: absolute; top: -6px; left: 50%; margin-left: -9px; }
</style>
