<script setup lang="ts" generic="T extends { id: string; start: string; end: string; lane?: number; lanes?: number }">
// Day columns × hours, used by Calendar (tasks) and Availability (free time).
// Shows as many day columns as fit (1–7). Items spanning several days are split per day.
// Items with `lane`/`lanes` go in that lane; others share lanes automatically when they overlap.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dayHeading, hourLabel, startOfDay } from "../display.ts";

const props = withDefaults(defineProps<{
  items: T[];
  from?: Date;
  startHour?: number;
  endHour?: number;
  hourPx?: number;
  minColumn?: number;
}>(), { from: () => startOfDay(new Date()), startHour: 8, endHour: 24, hourPx: 36, minColumn: 110 });

defineSlots<{ item(props: { item: T; height: number }): unknown }>();

const root = ref<HTMLElement>();
const width = ref(360);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { if (entry) width.value = entry.contentRect.width; });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const GUTTER = 38;
const dayCount = computed(() => Math.min(7, Math.max(1, Math.floor((width.value - GUTTER) / props.minColumn))));
const bodyHeight = computed(() => (props.endHour - props.startHour) * props.hourPx);
const hours = computed(() => {
  const list: { label: string; top: number }[] = [];
  for (let h = props.startHour; h < props.endHour; h += 2) list.push({ label: hourLabel(h), top: (h - props.startHour) * props.hourPx });
  return list;
});

interface Segment { item: T; top: number; height: number; lane: number; lanes: number }

const days = computed(() => Array.from({ length: dayCount.value }, (_, d) => {
  const date = new Date(props.from);
  date.setDate(date.getDate() + d);
  const windowStart = new Date(date); windowStart.setHours(props.startHour, 0, 0, 0);
  const windowEnd = new Date(date); windowEnd.setHours(0, 0, 0, 0); windowEnd.setTime(windowEnd.getTime() + props.endHour * 3_600_000);

  const segments: Segment[] = [];
  for (const item of props.items) {
    const s = Math.max(new Date(item.start).getTime(), windowStart.getTime());
    const e = Math.min(new Date(item.end).getTime(), windowEnd.getTime());
    if (e <= s) continue;
    segments.push({
      item,
      top: ((s - windowStart.getTime()) / 3_600_000) * props.hourPx,
      height: Math.max(((e - s) / 3_600_000) * props.hourPx - 4, 18),
      lane: item.lane ?? -1,
      lanes: item.lanes ?? 1,
    });
  }
  // Auto lanes for items without one: greedy, first free lane.
  const auto = segments.filter((seg) => seg.lane < 0).sort((a, b) => a.top - b.top);
  const laneEnds: number[] = [];
  for (const seg of auto) {
    let lane = laneEnds.findIndex((end) => end <= seg.top);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = seg.top + seg.height + 4;
    seg.lane = lane;
  }
  for (const seg of auto) seg.lanes = Math.max(1, laneEnds.length);
  return { key: date.toISOString(), ...dayHeading(date), segments };
}));
</script>

<template>
  <div ref="root" class="grid">
    <div class="heads">
      <span class="gutter" />
      <div v-for="day in days" :key="day.key" class="head rs-heading">
        {{ day.label }}<span class="sub rs-serif">{{ day.sub }}</span>
      </div>
    </div>
    <div class="body" :style="{ height: `${bodyHeight}px` }">
      <div v-for="h in hours" :key="h.top" class="hour" :style="{ top: `${h.top}px` }">
        <span class="hour-label rs-serif">{{ h.label }}</span><span class="hour-line" />
      </div>
      <span class="gutter" />
      <div v-for="day in days" :key="day.key" class="col">
        <div
          v-for="seg in day.segments"
          :key="seg.item.id"
          class="slot"
          :style="{
            top: `${seg.top}px`,
            height: `${seg.height}px`,
            left: `calc(${(seg.lane / seg.lanes) * 100}% + 2px)`,
            width: `calc(${100 / seg.lanes}% - 4px)`,
          }"
        >
          <slot name="item" :item="seg.item" :height="seg.height" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid { width: 100%; }
.heads, .body { display: flex; }
.gutter { width: 38px; flex-shrink: 0; }
.head { flex: 1; min-width: 0; padding: 0 3px; font-size: 19px; line-height: 1; }
.sub { display: block; font-size: 13px; letter-spacing: 0; font-variant-caps: normal; }
.body { position: relative; margin-top: 10px; }
.hour { position: absolute; left: 0; right: 0; display: flex; align-items: flex-start; gap: 4px; pointer-events: none; }
.hour-label { width: 32px; margin-top: -7px; text-align: right; font-size: 12px; }
.hour-line { flex: 1; border-top: 1px dashed rgba(42, 28, 14, .3); }
.col { position: relative; flex: 1; min-width: 0; }
.slot { position: absolute; display: flex; }
.slot > :deep(*) { flex: 1; min-width: 0; }
</style>
