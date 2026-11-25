<script setup lang="ts">
// Swaps tab: requests to you (Accept/Decline), requests you sent (Cancel), and history.
import { computed, onMounted, ref } from "vue";
import SwapPair from "../components/SwapPair.vue";
import { formatDate } from "../display.ts";
import { cancelSwap, getPeople, getSwaps, respondToSwap } from "../swapPreview.ts";
import type { Person, SwapOverview, SwapRequest } from "../types.ts";

const swaps = ref<SwapOverview | null>(null);
const people = ref<Person[]>([]);
const busy = ref("");
const announcement = ref("");

async function load() {
  [swaps.value, people.value] = await Promise.all([getSwaps(), getPeople()]);
}
onMounted(load);

const name = (id: string) => people.value.find((p) => p.id === id)?.name ?? "Someone";
const me = computed(() => people.value.find((p) => p.isMe)?.id);

async function act(swap: SwapRequest, action: "accept" | "decline" | "cancel") {
  busy.value = swap.id;
  if (action === "cancel") await cancelSwap(swap.id);
  else await respondToSwap(swap.id, action === "accept");
  announcement.value = action === "accept" ? `Accepted. ${swap.offered.title} is now yours.`
    : action === "decline" ? "Declined" : "Request cancelled";
  busy.value = "";
  await load();
}

/** History line from your point of view. */
function describe(swap: SwapRequest) {
  const iAsked = swap.fromId === me.value;
  const other = name(iAsked ? swap.toId : swap.fromId);
  const youGot = iAsked ? swap.wanted : swap.offered;
  const theyGot = iAsked ? swap.offered : swap.wanted;
  const what = swap.state === "accepted"
    ? `You got ${youGot.title} · ${other} got ${theyGot.title}`
    : iAsked ? `You asked for ${youGot.title} · offered ${theyGot.title}` : `${other} asked for ${theyGot.title} · offered ${youGot.title}`;
  const result = { accepted: "Accepted", declined: "Declined", cancelled: "Cancelled", pending: "Pending" }[swap.state];
  return { who: `With ${other}`, result, what, when: formatDate(swap.resolvedAt ?? swap.createdAt) };
}
const RESULT_COLOR: Record<string, string> = { Accepted: "#3d6b1f", Declined: "var(--rs-overdue)", Cancelled: "#5a4a38" };
</script>

<template>
  <section class="rs-screen">
    <h1 class="rs-title rs-heading">Swap Requests</h1>
    <p class="rs-visually-hidden" role="status">{{ announcement }}</p>

    <p v-if="!swaps" class="rs-status-line rs-hand">Loading…</p>
    <template v-else>
      <h2 class="rs-heading rs-section-title">To You</h2>
      <p v-if="swaps.incoming.length === 0" class="rs-hand none">No requests right now</p>
      <article v-for="swap in swaps.incoming" :key="swap.id" class="rs-paper card">
        <span class="rs-hand from">From {{ name(swap.fromId) }}</span>
        <!-- They offer `offered` (you get it) and want `wanted` (they get it). -->
        <SwapPair :get="swap.offered" :give="swap.wanted" :other-name="name(swap.fromId)" :people="people" />
        <div class="buttons">
          <button type="button" class="rs-pill rs-pill--approve rs-heading" :disabled="busy === swap.id" @click="act(swap, 'accept')">Accept</button>
          <button type="button" class="rs-pill rs-pill--decline rs-heading" :disabled="busy === swap.id" @click="act(swap, 'decline')">Decline</button>
        </div>
      </article>

      <h2 class="rs-heading rs-section-title">Sent</h2>
      <p v-if="swaps.outgoing.length === 0" class="rs-hand none">Nothing waiting</p>
      <article v-for="swap in swaps.outgoing" :key="swap.id" class="rs-paper card">
        <span class="rs-hand from">To {{ name(swap.toId) }}</span>
        <SwapPair :get="swap.wanted" :give="swap.offered" :other-name="name(swap.toId)" :people="people" />
        <button type="button" class="rs-pill rs-pill--light rs-heading" :disabled="busy === swap.id" @click="act(swap, 'cancel')">Cancel</button>
      </article>

      <h2 class="rs-heading rs-section-title">History</h2>
      <p v-if="swaps.history.length === 0" class="rs-hand none">No past swaps</p>
      <ul v-else class="rs-paper history">
        <li v-for="swap in swaps.history" :key="swap.id" class="rs-hand">
          <span class="top"><span>{{ describe(swap).who }}</span><span :style="{ color: RESULT_COLOR[describe(swap).result] }">{{ describe(swap).result }}</span></span>
          <span class="what">{{ describe(swap).what }}</span>
          <span class="what">{{ describe(swap).when }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.card { max-width: 500px; display: flex; flex-direction: column; gap: 14px; }
.from { font-size: 21px; }
.buttons { display: flex; gap: 10px; }
.buttons .rs-pill { flex: 1; }
.none { margin: 0; font-size: 19px; }
.history { max-width: 500px; margin: 0; padding: 4px 16px; list-style: none; }
.history li { display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-bottom: 1px solid #c9d8ec; }
.history li:last-child { border-bottom: 0; }
.top { display: flex; justify-content: space-between; gap: 8px; font-size: 19px; }
.what { font-size: 17px; }
</style>
