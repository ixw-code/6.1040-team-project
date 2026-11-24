import type { assembleApplication } from "../assembly.ts";
import { allowsAppOrigin, signedInPerson } from "../http.ts";
import { submissionWindowState } from "../shared/assignmentDates.ts";
import { photoResponse, type PhotoStore } from "./Photos.ts";

type CompletionConcepts = Pick<ReturnType<typeof assembleApplication>["concepts"], "PhotoChecking" | "Ranking" | "Sessioning">;
type HouseholdRole = "RESIDENT" | "OVERSEER";

export type CompletionTask = {
  task: string;
  household: string;
  assignee: string;
  title: string;
  criteria: string;
  photoInstructions: string;
  baseline: string;
  dueAt: Date;
  interval?: { start: Date; end: Date };
  active: boolean;
  archived?: boolean;
  completed: boolean;
};

export type TaskCompletion = {
  task: string;
  submission: string;
  person: string;
  submittedAt: Date;
  reviewedAt: Date;
};

// Task and membership lookups are supplied by the scheduling and household concepts.
export interface CompletionHooks {
  task(task: string): CompletionTask | undefined | Promise<CompletionTask | undefined>;
  role(household: string, person: string): HouseholdRole | undefined | Promise<HouseholdRole | undefined>;
  householdTasks?(household: string): Promise<{ task: string }[]>;
  recordCompletion(completion: TaskCompletion): Promise<void>;
}

const prefix = "/api/completion/";
const paths = new Set(["submit", "get", "review", "review-queue", "reviewed"].map((name) => prefix + name));
const submissionPhotoPath = /^\/api\/completion\/submissions\/([\da-f-]{36})\/(photo|baseline)$/;
const errorCodes = {
  400: "INVALID_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  500: "INTERNAL_ERROR",
  503: "UNAVAILABLE",
};

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(status: keyof typeof errorCodes) {
  return json({ error: errorCodes[status] }, status);
}

function refusal(code: string) {
  switch (code) {
    case "NOT_FOUND": return failure(404);
    case "MISSING_REASON": return failure(400);
    case "ALREADY_PENDING":
    case "ALREADY_APPROVED":
    case "ALREADY_REVIEWED":
    case "WRONG_REVIEW_METHOD":
    case "MANUAL_REVIEW_REQUIRED": return failure(409);
    default: return failure(500);
  }
}

function nonblank(value: unknown, maxLength = 256): value is string {
  return typeof value === "string" && value.length <= maxLength && value.trim() !== "";
}

function parseInput(operation: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const body = input as Record<string, unknown>;
  const only = (...fields: string[]) => Object.keys(body).every((key) => fields.includes(key));
  const { task, photo, household, submission, decision, feedback = "" } = body;

  switch (operation) {
    case "submit":
      if (only("task", "photo") && nonblank(task) && nonblank(photo)) {
        return { operation, task, photo };
      }
      return;
    case "get":
      if (only("task") && nonblank(task)) return { operation, task };
      return;
    case "reviewed":
    case "review-queue":
      if (only("household") && nonblank(household)) return { operation, household };
      return;
    case "review":
      if (only("submission", "decision", "feedback") && nonblank(submission) &&
          (decision === "APPROVE" || decision === "REJECT") &&
          typeof feedback === "string" && feedback.length <= 2000) {
        return { operation, submission, decision, feedback };
      }
  }
}

export function createCompletionHandler(
  { PhotoChecking, Ranking, Sessioning }: CompletionConcepts,
  photos: PhotoStore,
  hooks?: CompletionHooks,
  now = () => new Date(),
) {
  async function readCompletion(task: CompletionTask, person: string, role: HouseholdRole) {
    const attempts = await PhotoChecking._history({ subject: task.task });
    const latest = attempts[0]?.submission;
    const history = [];
    const current = [];

    for (const attempt of attempts) {
      const { submission } = attempt;
      const [details] = role === "RESIDENT" || submission === latest
        ? await PhotoChecking._submission({ submission }) : [];
      // An assignee can see the task. A resident can only read evidence they submitted.
      if (role === "RESIDENT" && details?.person !== person) continue;
      const { status, feedback, submittedAt, reviewedAt = null } = details ?? attempt;
      history.push({ submission, status, feedback, submittedAt, reviewedAt });
      if (submission === latest && details) {
        const { person, photo, criteria, baseline, reviewer = null } = details;
        current.push({ submission, person, photo, criteria, baseline, status, feedback, submittedAt, reviewedAt, reviewer });
      }
    }

    if (role === "RESIDENT" && task.assignee !== person && history.length === 0) return failure(404);
    const { task: id, household, assignee, title, criteria, photoInstructions, baseline, dueAt, active, completed } = task;
    return json({ completion: {
      task: { task: id, household, assignee, title, criteria, photoInstructions, baseline, dueAt, active, completed },
      current,
      history,
    } });
  }

  async function listQueue(household: string, taskById: CompletionHooks["task"]) {
    const items = [];
    for (const { submission, subject } of await PhotoChecking._pending({ method: "MANUAL" })) {
      const task = await taskById(subject);
      if (!task || task.archived || task.household !== household) continue;
      const [details] = await PhotoChecking._submission({ submission });
      if (!details || details.status !== "PENDING" || details.reviewMethod !== "MANUAL") continue;
      const { person, photo, criteria, baseline, submittedAt } = details;
      items.push({ submission, task: subject, title: task.title, person, photo, criteria, baseline, submittedAt });
    }
    return json({ queue: { items } });
  }

  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const attachment = submissionPhotoPath.exec(path);
    if (!attachment && !paths.has(path)) return failure(404);
    if (!allowsAppOrigin(request)) return failure(403);
    if (request.method !== (attachment ? "GET" : "POST")) return failure(400);

    try {
      const person = await signedInPerson(request, Sessioning);
      if (!person) return failure(401);
      if (!hooks) return failure(503);

      if (attachment) {
        const [details] = await PhotoChecking._submission({ submission: attachment[1] });
        const task = details && await hooks.task(details.subject);
        if (!task) return failure(404);
        const role = await hooks.role(task.household, person);
        if (role !== "OVERSEER" && (role !== "RESIDENT" || details.person !== person)) return failure(404);
        // Resolve the file from the authorized submission, including the original uploader.
        const stored = attachment[2] === "baseline"
          ? await photos.readReference(details.baseline) : await photos.read(details.photo, details.person);
        return stored ? photoResponse(stored) : failure(404);
      }

      const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== "application/json") return failure(400);
      const input = parseInput(path.slice(prefix.length), await request.json().catch(() => undefined));
      if (!input) return failure(400);

      switch (input.operation) {
        case "submit": {
          const task = await hooks.task(input.task);
          if (!task?.active || task.completed || task.assignee !== person || !await hooks.role(task.household, person)) {
            return failure(404);
          }
          if (!task.interval || !await photos.owns(input.photo, person)) return failure(404);
          const submittedAt = now();
          const state = submissionWindowState(task.interval, submittedAt.getTime());
          if (state !== "open") {
            return json({ error: state === "upcoming" ? "SUBMISSION_NOT_OPEN" : "SUBMISSION_CLOSED" }, 409);
          }
          const result = await PhotoChecking.submit({
            subject: task.task, person, photo: input.photo, criteria: task.criteria, baseline: task.baseline, method: "MANUAL", submittedAt,
          });
          return "error" in result ? refusal(result.error) : json(result);
        }
        case "get": {
          const task = await hooks.task(input.task);
          if (!task) return failure(404);
          const role = await hooks.role(task.household, person);
          return role ? await readCompletion(task, person, role) : failure(404);
        }
        case "review-queue":
          if (await hooks.role(input.household, person) !== "OVERSEER") return failure(404);
          return await listQueue(input.household, (id) => hooks.task(id));
        case "reviewed": {
          if (await hooks.role(input.household, person) !== "OVERSEER") return failure(404);
          const items = [];
          for (const { task } of await hooks.householdTasks?.(input.household) ?? []) {
            const entry = await hooks.task(task);
            if (!entry) continue;
            for (const row of await PhotoChecking._history({ subject: task })) {
              if (row.status === "PENDING") continue;
              const [details] = await PhotoChecking._submission({ submission: row.submission });
              if (details) items.push({ ...details, ...row, task, title: entry.title });
            }
          }
          items.sort((a, b) => b.reviewedAt!.getTime() - a.reviewedAt!.getTime());
          return json({ queue: { items } });
        }
        case "review": {
          const { submission, decision, feedback } = input;
          let [details] = await PhotoChecking._submission({ submission });
          if (!details) return failure(404);
          const task = await hooks.task(details.subject);
          if (!task || await hooks.role(task.household, person) !== "OVERSEER") return failure(404);
          if (task.archived && details.status !== "APPROVED") return failure(404);

          if (decision === "REJECT") {
            const result = await PhotoChecking.reject({ submission, reviewer: person, reason: feedback });
            return "error" in result ? refusal(result.error) : json({ submission, task: task.task, status: "REJECTED" });
          }

          if (details.status !== "APPROVED") {
            const result = await PhotoChecking.approve({ submission, reviewer: person, method: "MANUAL", feedback });
            if ("error" in result && result.error !== "ALREADY_REVIEWED") return refusal(result.error);
            [details] = await PhotoChecking._submission({ submission });
            if (details?.status !== "APPROVED") return failure(409);
          }
          if (!details.reviewedAt) return failure(500);

          // Use the stored decision on retries. Confirm task completion before awarding its point.
          await hooks.recordCompletion({
            task: task.task, submission, person: details.person, submittedAt: details.submittedAt, reviewedAt: details.reviewedAt,
          });
          const credit = await Ranking.credit({ group: task.household, person: details.person, contribution: task.task });
          return "error" in credit ? refusal(credit.error) : json({ submission, task: task.task, status: "APPROVED" });
        }
      }
      return failure(400);
    } catch {
      return failure(500);
    }
  };
}
