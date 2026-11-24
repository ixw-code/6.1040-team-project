// Every backend call the resident screens make goes through this file.
//
// The backend currently exposes only /user/* (see generated/wire.ts), so each function below is a
// PLACEHOLDER that reads and writes the in-memory data in mockData.ts. Each one has a TODO(backend)
// naming the concept action/query it should call. When an endpoint lands:
//   1. run `bun run generate` so it appears on `api` (web/src/api.ts),
//   2. replace the function body with the real `api.<route>(...)` call,
//   3. map the wire output into the shapes in types.ts here, so the screens don't change.
import { useSession } from "../session.ts";
import * as mock from "./mockData.ts";
import type {
  Attempt, AvailabilityBlock, AvailabilityChange, Person, Preference, SwapOverview, SwapRequest, Task,
} from "./types.ts";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => structuredClone(value);

/** The household's residents, including the signed-in user (isMe). */
export async function getPeople(): Promise<Person[]> {
  // TODO(backend): HouseholdManaging._residents(household) + Registering._username for names.
  // Mark isMe by comparing with the user from /user/me (useSession in ../session.ts).
  await delay();
  const username = useSession().me.value?.username;
  // The signed-in user's real username replaces the mock "Alice".
  return clone(mock.people).map((p) => (p.isMe && username ? { ...p, name: username } : p));
}

/** The signed-in resident's tasks for this week, for My Tasks. */
export async function getMyTasks(): Promise<Task[]> {
  // TODO(backend): TaskScheduling._schedule(group, weekStart, weekEnd) filtered to assignee = me,
  // joined with CompletionChecking for each task's latest attempt → status.
  await delay();
  return clone(mock.tasks.filter((t) => t.ownerId === mock.ME));
}

/** One task with its instructions, reference photos and attempts. Works for anyone's task. */
export async function getTask(taskId: string): Promise<Task | null> {
  // TODO(backend): TaskScheduling._get(task) + ChoreCataloguing (instructions, criteria, reference photos)
  // + PhotoChecking attempts for the task.
  await delay();
  const task = mock.tasks.find((t) => t.id === taskId);
  return task ? clone(task) : null;
}

/** Submits a camera photo for a task. The task becomes Submitted. */
export async function submitPhoto(taskId: string, photo: File): Promise<Attempt> {
  // TODO(backend): CompletionChecking submit endpoint (multipart upload of `photo`).
  await delay(300);
  const task = mock.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");
  const attempt: Attempt = {
    id: `a-${Date.now()}`, photoUrl: URL.createObjectURL(photo), submittedAt: new Date().toISOString(), status: "pending",
  };
  task.attempts.push(attempt);
  task.status = "submitted";
  return clone(attempt);
}

/** Everyone's tasks between two times, for the Calendar. */
export async function getSchedule(from: Date, until: Date): Promise<Task[]> {
  // TODO(backend): TaskScheduling._schedule(group, from, until) joined with completion status.
  await delay();
  return clone(mock.tasks.filter((t) => new Date(t.due) > from && new Date(t.start) < until));
}

/** Everyone's free time between two times, for Availability. */
export async function getAvailability(from: Date, until: Date): Promise<AvailabilityBlock[]> {
  // TODO(backend): TaskScheduling._availability(group, person) for each resident.
  await delay();
  return clone(mock.availability.filter((a) => new Date(a.end) > from && new Date(a.start) < until));
}

function blocksFor(change: AvailabilityChange): { start: Date; end: Date }[] {
  const count = change.repeat === "daily" ? 7 : change.repeat === "weekly" ? 4 : 1;
  const step = change.repeat === "weekly" ? 7 : 1;
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(`${change.date}T${change.from}`);
    const end = new Date(`${change.date}T${change.until}`);
    start.setDate(start.getDate() + i * step);
    end.setDate(end.getDate() + i * step);
    return { start, end };
  });
}

/** Adds free time for the signed-in resident (once, daily or weekly). */
export async function addAvailability(change: AvailabilityChange): Promise<void> {
  // TODO(backend): TaskScheduling.addAvailability(group, me, start, end). The concept has no repeat,
  // so either the sync expands daily/weekly into blocks (as done here for the next 7 days / 4 weeks) or
  // the concept gains an interval. Decide with Ada.
  await delay();
  for (const { start, end } of blocksFor(change)) {
    mock.availability.push({ id: `av-${Date.now()}-${start.getTime()}`, personId: mock.ME, start: start.toISOString(), end: end.toISOString() });
  }
}

/** Removes free time. Removal wins over everything, including repeating availability. */
export async function removeAvailability(change: AvailabilityChange): Promise<void> {
  // TODO(backend): TaskScheduling.removeAvailability(availability). The concept removes whole blocks;
  // removing part of a block (and "removal takes precedence") needs a split/trim in the sync. Here
  // overlapping blocks are trimmed.
  await delay();
  for (const { start, end } of blocksFor(change)) {
    const next: AvailabilityBlock[] = [];
    for (const block of mock.availability) {
      const s = new Date(block.start), e = new Date(block.end);
      if (block.personId !== mock.ME || e <= start || s >= end) { next.push(block); continue; }
      if (s < start) next.push({ ...block, id: block.id + "-a", end: start.toISOString() });
      if (e > end) next.push({ ...block, id: block.id + "-b", start: end.toISOString() });
    }
    mock.availability.splice(0, mock.availability.length, ...next);
  }
}

/** Chores with the resident's 1–10 rating (or null) and the household average. */
export async function getPreferences(): Promise<Preference[]> {
  // TODO(backend): ChoreCataloguing._chores(household) + the resident's preference per chore + an
  // average across residents. Note HouseholdManaging.setPreference rates *categories*; the screen rates
  // chores (team decision: keep per chore).
  await delay();
  return clone(mock.preferences);
}

export async function setPreference(choreId: string, rating: number | null): Promise<void> {
  // TODO(backend): ChoreCataloguing.setPreference(chore, me, weight). Null = clear the rating.
  await delay();
  const pref = mock.preferences.find((p) => p.choreId === choreId);
  if (pref) pref.rating = rating;
}

/** Pending requests to and from the resident, plus resolved ones. */
export async function getSwaps(): Promise<SwapOverview> {
  // TODO(backend): no concept yet. ChoreAssignments.md plans a small Trading concept (offer/accept);
  // accepting applies TaskScheduling.setSchedule for both tasks.
  await delay();
  const mine = mock.swaps.filter((s) => s.fromId === mock.ME || s.toId === mock.ME);
  const byNewest = (a: SwapRequest, b: SwapRequest) => (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt);
  return clone({
    incoming: mine.filter((s) => s.state === "pending" && s.toId === mock.ME),
    outgoing: mine.filter((s) => s.state === "pending" && s.fromId === mock.ME),
    history: mine.filter((s) => s.state !== "pending").sort(byNewest),
  });
}

/** Asks the owner of `wantedTaskId` to trade it for `offeredTaskId`. */
export async function requestSwap(wantedTaskId: string, offeredTaskId: string): Promise<SwapRequest> {
  // TODO(backend): Trading.offer(...) once the concept exists.
  await delay();
  const wanted = mock.tasks.find((t) => t.id === wantedTaskId)!;
  const offered = mock.tasks.find((t) => t.id === offeredTaskId)!;
  const request: SwapRequest = {
    id: `s-${Date.now()}`, fromId: mock.ME, toId: wanted.ownerId, offered: mock.summary(offered), wanted: mock.summary(wanted),
    state: "pending", createdAt: new Date().toISOString(),
  };
  mock.swaps.push(request);
  return clone(request);
}

export async function respondToSwap(swapId: string, accept: boolean): Promise<void> {
  // TODO(backend): Trading.accept / Trading.decline; accept also reassigns both tasks.
  await delay();
  const swap = mock.swaps.find((s) => s.id === swapId);
  if (!swap) return;
  swap.state = accept ? "accepted" : "declined";
  swap.resolvedAt = new Date().toISOString();
  if (accept) {
    for (const [summary, newOwner] of [[swap.offered, swap.toId], [swap.wanted, swap.fromId]] as const) {
      const task = mock.tasks.find((t) => t.id === summary.id);
      if (task) task.ownerId = newOwner;
    }
  }
}

export async function cancelSwap(swapId: string): Promise<void> {
  // TODO(backend): Trading.withdraw once the concept exists.
  await delay();
  const swap = mock.swaps.find((s) => s.id === swapId);
  if (swap) { swap.state = "cancelled"; swap.resolvedAt = new Date().toISOString(); }
}