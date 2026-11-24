// Placeholder household used until the backend endpoints exist. Dates are relative to today,
// so the screens always look current. Delete this file once residentApi.ts stops importing it.
import type { AvailabilityBlock, Person, Preference, SwapRequest, Task, TaskSummary } from "./types.ts";

const day0 = new Date();
day0.setHours(0, 0, 0, 0);

/** ISO time `dayOffset` days from today at hour:minute. */
export function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(day0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// TODO(backend): "me" stands in for the signed-in user's id from /user/me.
export const ME = "me";

export const people: Person[] = [
  { id: ME, name: "Alice", color: "#b0d898", isMe: true },
  { id: "ben", name: "Ben", color: "#efbcd5", isMe: false },
  { id: "priya", name: "Priya", color: "#f6c79a", isMe: false },
  { id: "marcus", name: "Marcus", color: "#d3bdee", isMe: false },
];

const refs = [null, null, null];

export const tasks: Task[] = [
  {
    id: "t-wipe", title: "Wipe counters", ownerId: ME, start: at(0, 14), due: at(0, 19), status: "redo",
    instructions: "Clear the counters, spray them down, and wipe with a clean cloth.",
    criteria: "Photo shows every counter clear and dry.", references: refs,
    attempts: [{ id: "a1", photoUrl: null, submittedAt: at(0, 14, 40), status: "rejected", reviewedAt: at(0, 15, 5), reviewer: "Jim Brooks", comment: "The counter by the stove is cut off. Retake it with all counters in frame." }],
  },
  {
    id: "t-plants", title: "Water plants", ownerId: ME, start: at(-1, 8), due: at(-1, 21), status: "redo",
    instructions: "Water every plant in the living room and on the windowsills.",
    criteria: "Photo shows damp soil in each pot.", references: refs,
    attempts: [{ id: "a2", photoUrl: null, submittedAt: at(-1, 20), status: "rejected", reviewedAt: at(-1, 20, 30), reviewer: "Jim Brooks", comment: "Only two plants are in frame." }],
  },
  {
    id: "t-recycling", title: "Take out recycling", ownerId: ME, start: at(1, 8), due: at(1, 12), status: "submitted",
    instructions: "Take the recycling bins out to the curb.", criteria: "Photo shows both bins at the curb.", references: refs,
    attempts: [{ id: "a3", photoUrl: null, submittedAt: at(0, 9, 14), status: "pending" }],
  },
  {
    id: "t-sink", title: "Clean bathroom sink", ownerId: ME, start: at(2, 16), due: at(2, 23, 59), status: "todo",
    instructions: "Scrub the basin and faucet, and wipe the mirror.", criteria: "Photo shows a clean basin and streak-free mirror.",
    references: refs, attempts: [],
  },
  {
    id: "t-dishwasher", title: "Load dishwasher", ownerId: ME, start: at(5, 0), due: at(5, 23, 59), status: "todo",
    instructions: "Load every dirty dish from both sinks and the counter into the dishwasher. Add a pod and start it on Normal.",
    criteria: "Photo shows both sinks empty and the dishwasher closed with the cycle light on.", references: refs, attempts: [],
  },
  {
    id: "t-rack", title: "Empty dish rack", ownerId: ME, start: at(0, 8), due: at(0, 11), status: "approved",
    instructions: "Put away every dish from the drying rack.", criteria: "Photo shows the rack empty.", references: refs,
    attempts: [
      { id: "a4", photoUrl: null, submittedAt: at(0, 9), status: "rejected", reviewedAt: at(0, 9, 20), reviewer: "Jim Brooks", comment: "Two mugs are still in the rack." },
      { id: "a5", photoUrl: null, submittedAt: at(0, 9, 40), status: "approved", reviewedAt: at(0, 10), reviewer: "Jim Brooks", comment: "Looks good, thanks!" },
    ],
  },
  {
    id: "t-trash", title: "Take out trash", ownerId: "ben", start: at(0, 11), due: at(0, 14), status: "todo",
    instructions: "Tie up the kitchen and bathroom trash bags and take them to the bins out back. Put in fresh bags.",
    criteria: "Photo shows both empty cans with new bags in them.", references: refs, attempts: [],
  },
  {
    id: "t-mop", title: "Mop kitchen", ownerId: "priya", start: at(0, 19), due: at(0, 23), status: "submitted",
    instructions: "Sweep, then mop the whole kitchen floor.", criteria: "Photo shows the full floor, still damp.", references: refs,
    attempts: [{ id: "a6", photoUrl: null, submittedAt: at(0, 21), status: "pending" }],
  },
  {
    id: "t-vacuum", title: "Vacuum living room", ownerId: "marcus", start: at(1, 12), due: at(1, 18), status: "todo",
    instructions: "Vacuum the rug and under the couch.", criteria: "Photo shows the rug with vacuum lines.", references: refs, attempts: [],
  },
  {
    id: "t-microwave", title: "Clean microwave", ownerId: "ben", start: at(1, 18), due: at(1, 22), status: "approved",
    instructions: "Wipe the inside, the turntable, and the door.", criteria: "Photo shows the inside with the door open.", references: refs,
    attempts: [{ id: "a7", photoUrl: null, submittedAt: at(1, 19), status: "approved", reviewedAt: at(1, 20), reviewer: "Jim Brooks" }],
  },
  {
    id: "t-shower", title: "Scrub shower", ownerId: "priya", start: at(2, 8), due: at(2, 13), status: "redo",
    instructions: "Scrub the walls, floor, and glass door.", criteria: "Photo shows the whole shower with the door open.", references: refs,
    attempts: [{ id: "a8", photoUrl: null, submittedAt: at(2, 10), status: "rejected", reviewedAt: at(2, 11), reviewer: "Jim Brooks", comment: "The glass still has spots." }],
  },
  {
    id: "t-towels", title: "Restock paper towels", ownerId: "marcus", start: at(2, 13), due: at(2, 16), status: "todo",
    instructions: "Refill the kitchen and bathroom paper towel holders.", criteria: "Photo shows both holders full.", references: refs, attempts: [],
  },
];

/** Free time per person, repeating a three-day pattern across the week. */
const pattern: Record<string, [number, number][][]> = {
  [ME]: [[[8, 10], [14, 20]], [[9, 13], [18, 23]], [[15, 23]]],
  ben: [[[10, 15]], [[8, 12], [17, 21]], [[8, 12]]],
  priya: [[[17, 23]], [[12, 16]], [[8, 14], [19, 22]]],
  marcus: [[[8, 12]], [[12, 19]], [[11, 17]]],
};
export const availability: AvailabilityBlock[] = Object.entries(pattern).flatMap(([personId, days]) =>
  Array.from({ length: 7 }, (_, d) => days[d % 3]!.map(([s, e], i) => ({
    id: `av-${personId}-${d}-${i}`, personId, start: at(d, s), end: at(d, e),
  }))).flat(),
);

const averages = [6.2, 4.8, 5.5, 3.1, 4.0, 2.7, 2.3, 5.0, 6.8, 4.4, 8.1, 7.3];
export const preferences: Preference[] = [
  "Load dishwasher", "Empty dish rack", "Wipe counters", "Take out trash", "Take out recycling", "Clean bathroom sink",
  "Scrub shower", "Mop kitchen", "Vacuum living room", "Clean microwave", "Water plants", "Restock paper towels",
].map((chore, i) => ({ choreId: `c-${i}`, chore, rating: null, average: averages[i]! }));

export function summary(task: Task): TaskSummary {
  return { id: task.id, title: task.title, due: task.due, status: task.status, ownerId: task.ownerId };
}
const byId = (id: string) => tasks.find((t) => t.id === id)!;
const past = (id: string, title: string, ownerId: string, daysAgo: number): TaskSummary =>
  ({ id, title, due: at(-daysAgo, 20), status: "approved", ownerId });

export const swaps: SwapRequest[] = [
  { id: "s-in", fromId: "marcus", toId: ME, offered: summary(byId("t-towels")), wanted: summary(byId("t-dishwasher")), state: "pending", createdAt: at(0, 8) },
  { id: "s-out", fromId: ME, toId: "ben", offered: summary(byId("t-wipe")), wanted: summary(byId("t-trash")), state: "pending", createdAt: at(0, 9) },
  { id: "s-h1", fromId: ME, toId: "priya", offered: past("x1", "Mop kitchen", ME, 3), wanted: past("x2", "Vacuum living room", "priya", 3), state: "accepted", createdAt: at(-3, 9), resolvedAt: at(-3, 12) },
  { id: "s-h2", fromId: ME, toId: "ben", offered: past("x3", "Empty dish rack", ME, 5), wanted: past("x4", "Clean microwave", "ben", 5), state: "declined", createdAt: at(-5, 9), resolvedAt: at(-5, 10) },
  { id: "s-h3", fromId: ME, toId: "marcus", offered: past("x5", "Water plants", ME, 7), wanted: past("x6", "Restock paper towels", "marcus", 7), state: "cancelled", createdAt: at(-7, 9), resolvedAt: at(-7, 9, 30) },
  { id: "s-h4", fromId: "priya", toId: ME, offered: past("x7", "Scrub shower", "priya", 11), wanted: past("x8", "Wipe counters", ME, 11), state: "accepted", createdAt: at(-11, 9), resolvedAt: at(-11, 15) },
];
