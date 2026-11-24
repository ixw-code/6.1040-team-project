import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import {
  createCompletionHandler,
  type CompletionHooks,
  type CompletionTask,
  type TaskCompletion,
} from "../../src/compositions/CompletionChecking.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const resident = { session: "demo-alice", task: "demo-sink" };
const overseer = { session: "demo-overseer", household: "demo-house" };

function completionFixtures() {
  const sessions = new Map([
    [resident.session, "alice"], [overseer.session, "overseer"],
    ["demo-sam", "sam"], ["demo-other-overseer", "other-overseer"],
  ]);
  const roles = new Map<string, "RESIDENT" | "OVERSEER">([
    ["demo-house/alice", "RESIDENT"], ["demo-house/sam", "RESIDENT"], ["demo-house/overseer", "OVERSEER"],
    ["demo-other-house/sam", "RESIDENT"], ["demo-other-house/other-overseer", "OVERSEER"],
  ]);
  const sink: CompletionTask = {
    task: resident.task,
    household: overseer.household,
    assignee: "alice",
    title: "Clear the sink",
    criteria: "The sink and dish rack are empty.",
    photoInstructions: "Show the whole sink and dish rack.",
    baseline: "demo-sink-baseline.jpg",
    dueAt: new Date("2026-12-01T00:00:00Z"),
    active: true,
    completed: false,
  };
  const tasks = new Map([
    [sink.task, sink],
    ["demo-other-sink", { ...sink, task: "demo-other-sink", household: "demo-other-house", assignee: "sam" }],
  ]);
  const completions = new Map<string, TaskCompletion>();
  const hooks: CompletionHooks = {
    sessionPerson: (session) => sessions.get(session),
    role: (household, person) => roles.get(`${household}/${person}`),
    task: (id) => {
      const task = tasks.get(id);
      return task && { ...task, completed: completions.has(id) };
    },
    async recordCompletion(completion) {
      const existing = completions.get(completion.task);
      if (existing && existing.submission !== completion.submission) throw new Error("Task already completed.");
      if (!existing) completions.set(completion.task, completion);
    },
  };
  return { hooks, completions };
}

function requests(application: ReturnType<typeof assembleApplication>, hooks?: CompletionHooks) {
  const handler = createCompletionHandler(application.concepts, hooks);
  return async (path: string, input: object) => {
    const response = await handler(new Request(`http://127.0.0.1/api/completion/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));
    return { status: response.status, body: await response.json() };
  };
}

describe("CompletionChecking HTTP", () => {
  const database = useMongoTestDb("completion");

  test("reviews submissions and credits a completed task once", async () => {
    const { hooks, completions } = completionFixtures();
    const application = assembleApplication(database);
    const post = requests(application, hooks);
    const score = () => application.concepts.Ranking._score({ group: overseer.household, person: "alice" });

    expect(await post("get", resident)).toMatchObject({
      status: 200,
      body: { completion: { task: { completed: false, photoInstructions: expect.any(String) }, current: [], history: [] } },
    });

    const first = await post("submit", { ...resident, photo: "first.jpg" });
    expect(first).toEqual({ status: 200, body: { submission: expect.any(String) } });
    const firstID = first.body.submission;
    expect(await score()).toEqual({ score: 0 });
    expect(await post("get", resident)).toMatchObject({
      status: 200,
      body: { completion: { current: [{ status: "PENDING", reviewedAt: null }], task: { completed: false } } },
    });
    expect(await post("submit", { ...resident, photo: "duplicate.jpg" })).toEqual({
      status: 409, body: { error: "CONFLICT" },
    });

    const reject = { session: overseer.session, submission: firstID, decision: "REJECT" };
    expect(await post("review", reject)).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await post("review-queue", overseer)).toMatchObject({
      status: 200,
      body: { queue: { items: [{ submission: firstID, person: "alice", photo: "first.jpg", baseline: "demo-sink-baseline.jpg" }] } },
    });
    expect(await post("review", { ...reject, feedback: "Include the dish rack." })).toEqual({
      status: 200, body: { submission: firstID, task: resident.task, status: "REJECTED" },
    });
    expect(await score()).toEqual({ score: 0 });

    const second = await post("submit", { ...resident, photo: "retry.jpg" });
    expect(second).toEqual({ status: 200, body: { submission: expect.any(String) } });
    const secondID = second.body.submission;
    expect(secondID).not.toBe(firstID);
    const approve = { session: overseer.session, submission: secondID, decision: "APPROVE", feedback: "Looks good." };
    const approved = { status: 200, body: { submission: secondID, task: resident.task, status: "APPROVED" } };
    expect(await post("review", approve)).toEqual(approved);
    expect(await post("review", { ...approve, feedback: "This retry cannot change the review." })).toEqual(approved);
    expect(await post("review-queue", overseer)).toEqual({ status: 200, body: { queue: { items: [] } } });
    expect(await score()).toEqual({ score: 1 });

    const final = await post("get", resident);
    expect(final).toMatchObject({ status: 200, body: { completion: {
      task: { completed: true },
      current: [{
        submission: secondID, status: "APPROVED", feedback: approve.feedback,
        submittedAt: expect.any(String), reviewedAt: expect.any(String), reviewer: "overseer",
      }],
      history: [{ submission: secondID, status: "APPROVED" }, { submission: firstID, status: "REJECTED" }],
    } } });
    const { submittedAt, reviewedAt } = final.body.completion.current[0];
    const recorded = completions.get(resident.task);
    expect(recorded).toMatchObject({
      submission: secondID, person: "alice", submittedAt: new Date(submittedAt), reviewedAt: new Date(reviewedAt),
    });
  });

  test("conceals tasks and review queues from people in the wrong household or role", async () => {
    const { hooks } = completionFixtures();
    const post = requests(assembleApplication(database), hooks);
    const notFound = { status: 404, body: { error: "NOT_FOUND" } };
    expect(await post("get", { task: resident.task })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await post("get", { ...resident, session: "demo-sam" })).toEqual(notFound);
    expect(await post("get", { ...resident, session: "demo-other-overseer" })).toEqual(notFound);
    expect(await post("submit", { ...resident, session: "demo-sam", photo: "photo.jpg" })).toEqual(notFound);
    expect(await post("submit", { ...resident, person: "sam", photo: "photo.jpg" })).toEqual({
      status: 400, body: { error: "INVALID_REQUEST" },
    });
    expect(await post("review-queue", { ...overseer, session: "demo-alice" })).toEqual(notFound);
    expect(await post("review-queue", { ...overseer, session: "demo-other-overseer" })).toEqual(notFound);
    expect(await post("review", { session: overseer.session, submission: "unknown", decision: "APPROVE" })).toEqual(notFound);
  });

  test("retries an approval after completion recording fails and credits only after it succeeds", async () => {
    const { hooks } = completionFixtures();
    let firstWrite = true;
    const application = assembleApplication(database);
    const post = requests(application, {
      ...hooks,
      async recordCompletion(completion) {
        if (firstWrite) {
          firstWrite = false;
          throw new Error("Test completion write failed.");
        }
        await hooks.recordCompletion(completion);
      },
    });
    const task = "demo-other-sink";
    const created = await post("submit", { session: "demo-sam", task, photo: "other.jpg" });
    expect(created).toEqual({ status: 200, body: { submission: expect.any(String) } });
    const submission = created.body.submission;
    const approve = { session: "demo-other-overseer", submission, decision: "APPROVE", feedback: "Done" };
    expect(await post("review", { ...approve, session: overseer.session })).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await post("review", { ...approve, session: "demo-sam" })).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await post("review", approve)).toEqual({ status: 500, body: { error: "INTERNAL_ERROR" } });

    const score = () => application.concepts.Ranking._score({ group: "demo-other-house", person: "sam" });
    expect(await score()).toEqual({ score: 0 });
    expect(await hooks.task(task)).toMatchObject({ completed: false });
    const [original] = await application.concepts.PhotoChecking._submission({ submission });
    expect(original).toMatchObject({ status: "APPROVED", reviewer: "other-overseer", feedback: "Done" });

    expect(await post("review", { ...approve, feedback: "Different feedback" })).toEqual({
      status: 200, body: { task, submission, status: "APPROVED" },
    });
    expect(await hooks.task(task)).toMatchObject({ completed: true });
    expect(await score()).toEqual({ score: 1 });
    expect(await application.concepts.PhotoChecking._submission({ submission })).toEqual([original]);
  });

  test("the server requires session hooks", async () => {
    const post = requests(assembleApplication(database));
    expect(await post("get", resident)).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
  });
});
