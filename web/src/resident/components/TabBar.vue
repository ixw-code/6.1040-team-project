<script setup lang="ts">
import { useNav, type Tab } from "../nav.ts";
const nav = useNav();
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "tasks", label: "My Tasks", icon: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 9h8M8 13h6"/>' },
  { id: "calendar", label: "Cal", icon: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  { id: "availability", label: "Availability", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  { id: "prefs", label: "Prefs", icon: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z"/>' },
];
</script>

<template>
  <nav class="tabbar" aria-label="Resident">
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      class="tab rs-heading"
      :aria-current="nav.tab.value === t.id ? 'page' : undefined"
      @click="nav.switchTab(t.id)"
    >
      <span class="icon">
        <!-- eslint-disable-next-line vue/no-v-html -- static icon paths defined above -->
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" v-html="t.icon" />
      </span>
      {{ t.label }}
    </button>
  </nav>
</template>

<style scoped>
.tabbar { position: sticky; bottom: 0; z-index: 5; display: flex; height: 64px; background: var(--rs-tab); border-top: 3px solid #5c3a17; }
.tab { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0; border: 0; background: none; color: #5a4a38; font-size: 15px; letter-spacing: 0; white-space: nowrap; cursor: pointer; }
.tab[aria-current="page"] { color: var(--rs-ink); box-shadow: inset 0 -4px 0 var(--rs-accent); }
.icon { position: relative; display: flex; }
.badge { position: absolute; top: -6px; right: -10px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: var(--rs-pin); color: #fff; font-size: 13px; line-height: 18px; text-align: center; font-variant-caps: normal; }
</style>
