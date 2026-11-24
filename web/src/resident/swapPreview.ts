// Standalone swap prototype for the planned Trading concept.
import * as mock from "./mockData.ts";
import type {
  Person, SwapOverview, SwapRequest, Task,
} from "./types.ts";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => structuredClone(value);

/** The household's residents, including the signed-in user (isMe). */
export async function getPeople(): Promise<Person[]> {
  // TODO(backend): HouseholdManaging._residents(household) + Registering._username for names.
  // Mark isMe by comparing with the user from /user/me (useSession in ../session.ts).
  await delay();
  return clone(mock.people);
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
