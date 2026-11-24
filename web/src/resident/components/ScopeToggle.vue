<script setup lang="ts">
// Everyone ⟷ Me switch used on Calendar and Availability.
const onlyMe = defineModel<boolean>({ required: true });
defineProps<{ what: string }>();
</script>

<template>
  <div class="scope rs-heading">
    <span aria-hidden="true">Everyone</span>
    <button
      type="button"
      role="switch"
      class="track"
      :aria-checked="onlyMe"
      :aria-label="`Show only my ${what}`"
      @click="onlyMe = !onlyMe"
    >
      <span class="knob" :class="{ right: onlyMe }" />
    </button>
    <span aria-hidden="true">Me</span>
  </div>
</template>

<style scoped>
.scope { display: flex; align-items: center; gap: 6px; font-size: 16px; }
.track { position: relative; width: 56px; height: 32px; padding: 0; border: 2px solid var(--rs-ink); border-radius: 999px; background: var(--rs-tab); cursor: pointer; }
.knob { position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: var(--rs-ink); transition: left .15s; }
.knob.right { left: 28px; }
</style>
