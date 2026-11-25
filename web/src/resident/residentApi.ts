// Every backend call the resident screens make goes through this file.
//
// Many functions below are placeholders that read and write the in-memory data in mockData.ts.
// Each one has a TODO(backend) naming the concept action/query it should call. When an endpoint lands:
//   1. run `bun run generate` so it appears on `api` (web/src/api.ts),
//   2. replace the function body with the real `api.<route>(...)` call,
//   3. map the wire output into the shapes in types.ts here, so the screens don't change.
// These changes are currently in-progress.
import * as mock from "./mockData.ts";
import type {
  Attempt, AvailabilityBlock, AvailabilityChange, Person, Preference, SwapOverview, SwapRequest, Task, TaskDetail, TaskStatus,
} from "./types.ts";
import { api } from "../api.ts";
import { useSession } from "../session.ts";
import { colorFor } from "./display.ts";
import { CompletionRequestError, completionRequest, submissionImage, taskBaselineImage } from "../completion-api.ts";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => structuredClone(value);

/** The residents of the selected household, with the signed-in user marked. */
export async function getPeople(): Promise<Person[]> {
  const { me, household } = useSession();
  const result = await api.households.residents({ household: household.value });
  if ("error" in result) throw new Error(result.error);

  return result.residents.map(({ person, username }) => ({
    id: person,
    name: username ?? "Unknown",
    color: colorFor(person),
    isMe: person === me.value?.user,
  }));
}

const attemptStatus = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" } as const;
type ReviewStatus = keyof typeof attemptStatus;
type Completion = {
  task: {
    task: string; household: string; title: string; assignee: string; photoInstructions: string;
    criteria: string; baseline: string; dueAt: string; completed: boolean;
  };
  current: { status: ReviewStatus }[];
  history: {
    submission: string; status: ReviewStatus; submittedAt: string; reviewedAt: string | null; feedback: string;
  }[];
};

function uiStatus(completed: boolean, latest?: ReviewStatus): TaskStatus {
  if (completed || latest === "APPROVED") return "approved";
  if (latest === "PENDING") return "submitted";
  if (latest === "REJECTED") return "redo";
  return "todo";
}

async function readCompletion(task: string): Promise<Completion> {
  const { completion } = await completionRequest<{ completion: Completion }>("/completion/get", { task });
  return completion;
}

/** The assigned task, its photo instructions, and the resident's recorded submissions. */
export async function getTask(taskId: string): Promise<TaskDetail | null> {
  const { household, me } = useSession();
  try {
    const { task, current, history } = await readCompletion(taskId);
    if (task.household !== household.value) return null;
    return {
      id: task.task,
      title: task.title,
      ownerId: task.assignee,
      due: task.dueAt,
      status: uiStatus(task.completed, current[0]?.status),
      instructions: task.photoInstructions,
      criteria: task.criteria,
      references: task.baseline && task.assignee === me.value?.user ? [taskBaselineImage(task.task)] : [],
      attempts: history.map((row): Attempt => ({
        id: row.submission,
        photoUrl: submissionImage(row.submission),
        submittedAt: row.submittedAt,
        status: attemptStatus[row.status],
        reviewedAt: row.reviewedAt ?? undefined,
        comment: row.feedback,
      })),
    };
  } catch (error) {
    if (error instanceof CompletionRequestError && error.status === 404) return null;
    throw error;
  }
}

/** The signed-in resident's tasks for the current week, for My Tasks. */
export async function getMyTasks(): Promise<Task[]> {
  const { household } = useSession();
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const until = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const result = await api.assignments.mine({
    household: household.value,
    from,
    until,
    mode: "assigned",
  });
  if ("error" in result) throw new Error(result.error);

  return Promise.all(result.tasks.map(async (row) => {
    const completion = await readCompletion(row.task);
    const completed = row.status === "COMPLETED" || row.status === "COMPLETED_LATE";

    return {
      id: row.task,
      title: row.chore?.name ?? "Chore",
      ownerId: row.assignee ?? "",
      start: row.interval?.start ?? row.deadline ?? "",
      due: row.interval?.end ?? row.deadline ?? "",
      status: uiStatus(completed, completion.current[0]?.status),
      instructions: row.chore?.description ?? "",
      criteria: completion.task.criteria,
      references: [],
      attempts: [],
    };
  }));
}

/** Task details for the calendar's swap preview. */
export async function getSwapTask(taskId: string): Promise<Task | null> {
  await delay();
  const task = mock.tasks.find((t) => t.id === taskId);
  return task ? clone(task) : null;
}

export async function uploadPhoto(file: File): Promise<string> {
  try {
    const { photo } = await completionRequest<{ photo: string }>("/photos", file);
    return photo;
  } catch (error) {
    if (error instanceof CompletionRequestError) {
      if (error.status === 413) throw new Error("The photo is too large. Choose a smaller image.");
      if (error.status === 400 || error.status === 415) throw new Error("Choose a valid JPEG, PNG, or WebP photo.");
    }
    throw new Error("Couldn't upload the photo. Try again.");
  }
}

/** Attaches the uploaded photo to the real assignment through the sync-engine endpoint. */
export async function submitPhoto(task: string, photo: string): Promise<void> {
  const result = await api.completion.submit({ task, photo });
  if (!("error" in result)) return;
  switch (result.error) {
    case "UNAUTHORIZED":
      useSession().sessionEnded();
      throw new Error("Your session ended. Sign in to submit a photo.");
    case "NOT_FOUND":
      throw new Error("This task can no longer accept your photo. Return to the task for its latest status.");
    case "CONFLICT":
      throw new Error("This task already has a pending or approved photo. Return to the task to see it.");
    default:
      throw new Error("Couldn't submit the photo. Try again.");
  }
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
