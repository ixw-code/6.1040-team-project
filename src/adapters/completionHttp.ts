import type { assembleApplication } from "../assembly.ts";
import { allowsAppOrigin, signedInPerson } from "../http.ts";
import { photoResponse, type PhotoStore } from "./photos.ts";

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
  active: boolean;
  completed: boolean;
};

export type TaskCompletion = {
  task: string;
  submission: string;
  person: string;
  submittedAt: Date;
  reviewedAt: Date;
};

// Adapt the task, role, and completion operations used by the HTTP handler.
export interface CompletionHooks {
  task(task: string): CompletionTask | undefined | Promise<CompletionTask | undefined>;
  role(household: string, person: string): HouseholdRole | undefined | Promise<HouseholdRole | undefined>;
  recordCompletion(completion: TaskCompletion): Promise<void>;
}

export function createCompletionHooks({
  TaskScheduling, HouseholdManaging, ChoreCataloguing,
}: ReturnType<typeof assembleApplication>["concepts"]): CompletionHooks {
  return {
    async task(task) {
      const [entry] = await TaskScheduling._completionContext({ task });
      if (!entry) return;
      const [chore] = await ChoreCataloguing._get({ chore: entry.item });
      const details = chore?.group === entry.group ? chore : undefined;
      const { dueAt } = entry;
      const completed = entry.completion === "COMPLETED";
      return {
        task,
        household: entry.group,
        assignee: entry.assignee ?? "",
        title: details?.name ?? "Chore",
        criteria: details?.requirements.join("\n") ?? "",
        photoInstructions: details?.description ?? "",
        baseline: details?.references[0] ?? "",
        dueAt,
        active: !completed && entry.assignee !== undefined,
        completed,
      };
    },
    async role(household, person) {
      const [home] = await HouseholdManaging._household({ household });
      if (!home) return;
      if (home.overseer === person) return "OVERSEER";
      if ((await HouseholdManaging._allResidents({ household, people: [person] })).all) return "RESIDENT";
    },
    async recordCompletion({ task, person, submittedAt }) {
      try {
        const result = await TaskScheduling.complete({ task, completedBy: person, completedAt: submittedAt });
        if ("error" in result) throw result;
      } catch (error) {
        if (!error || typeof error !== "object" || !("error" in error) || error.error !== "TASK_STATUS_CONFLICT") throw error;
        const [entry] = await TaskScheduling._get({ task });
        if (entry?.completedBy !== person || entry.completedAt?.getTime() !== submittedAt.getTime()) throw error;
      }
    },
  };
}

const prefix = "/api/completion/";
const paths = new Set(["submit", "get", "review", "review-queue"].map((name) => prefix + name));
const submissionPhotoPath = /^\/api\/completion\/submissions\/([\da-f-]{36})\/(photo|baseline)$/;
const taskBaselinePath = /^\/api\/completion\/tasks\/([\w-]{1,256})\/baseline$/;
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
      if (!task || task.household !== household) continue;
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
    const baselineTask = taskBaselinePath.exec(path)?.[1];
    if (!attachment && !baselineTask && !paths.has(path)) return failure(404);
    if (!allowsAppOrigin(request)) return failure(403);
    if (request.method !== (attachment || baselineTask ? "GET" : "POST")) return failure(400);

    try {
      const person = await signedInPerson(request, Sessioning);
      if (!person) return failure(401);
      if (!hooks) return failure(503);

      if (baselineTask) {
        const task = await hooks.task(baselineTask);
        if (!task?.baseline) return failure(404);
        const role = await hooks.role(task.household, person);
        if (role !== "OVERSEER" && (role !== "RESIDENT" || task.assignee !== person)) return failure(404);

        const stored = await photos.readReference(task.baseline);
        return stored ? photoResponse(stored) : failure(404);
      }

      if (attachment) {
        const [, submission, kind] = attachment;
        const [details] = await PhotoChecking._submission({ submission });
        const task = details && await hooks.task(details.subject);
        if (!task) return failure(404);
        const role = await hooks.role(task.household, person);
        if (role !== "OVERSEER" && (role !== "RESIDENT" || details.person !== person)) return failure(404);
        if (kind === "baseline") {
          const stored = details.baseline && await photos.readReference(details.baseline);
          return stored ? photoResponse(stored) : failure(404);
        }

        // Resolve the file from the authorized submission, including the original uploader.
        const stored = await photos.read(details.photo, details.person);
        return stored ? photoResponse(stored) : failure(404);
      }

      const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== "application/json") return failure(400);
      const input = parseInput(path.slice(prefix.length), await request.json().catch(() => undefined));
      if (!input) return failure(400);

      switch (input.operation) {
        case "submit": {
          const task = await hooks.task(input.task);
          if (!task?.active || task.assignee !== person || !await hooks.role(task.household, person)) {
            return failure(404);
          }
          if (!await photos.owns(input.photo, person)) return failure(404);
          const result = await PhotoChecking.submit({
            subject: task.task, person, photo: input.photo, criteria: task.criteria, baseline: task.baseline, method: "MANUAL",
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
        case "review": {
          const { submission, decision, feedback } = input;
          let [details] = await PhotoChecking._submission({ submission });
          if (!details) return failure(404);
          const task = await hooks.task(details.subject);
          if (!task || await hooks.role(task.household, person) !== "OVERSEER") return failure(404);

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
