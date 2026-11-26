import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { policy } from "../../src/http.ts";
import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import {
  createCompletionHandler,
  type CompletionHooks,
  type CompletionTask,
  type TaskCompletion,
} from "../../src/adapters/completionHttp.ts";
import { createPhotoHandler, createPhotoStore } from "../../src/adapters/photos.ts";
import { accountRequests } from "../helpers/accounts.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const url = "http://127.0.0.1";
const sinkTask = "demo-sink";
const otherTask = "demo-other-sink";
const household = "demo-house";
const otherHousehold = "demo-other-house";
const notFound = { status: 404, body: { error: "NOT_FOUND" } };
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2QAAAAASUVORK5CYII=", "base64",
));
const baselinePng = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP438AAAAQBAYDFKhhdAAAAAElFTkSuQmCC", "base64",
));

function completionFixtures(users: { alice: string; sam: string; reviewer: string; otherReviewer: string }) {
  const roles = new Map<string, "RESIDENT" | "OVERSEER">([
    [`${household}/${users.alice}`, "RESIDENT"],
    [`${household}/${users.sam}`, "RESIDENT"],
    [`${household}/${users.reviewer}`, "OVERSEER"],
    [`${otherHousehold}/${users.sam}`, "RESIDENT"],
    [`${otherHousehold}/${users.otherReviewer}`, "OVERSEER"],
  ]);
  const sink: CompletionTask = {
    task: sinkTask,
    household,
    assignee: users.alice,
    title: "Clear the sink",
    criteria: "The sink and dish rack are empty.",
    photoInstructions: "Show the whole sink and dish rack.",
    baseline: "demo-sink-baseline.jpg",
    dueAt: new Date("2026-12-01T00:00:00Z"),
    active: true,
    completed: false,
  };
  const tasks = new Map([
    [sinkTask, sink],
    [otherTask, { ...sink, task: otherTask, household: otherHousehold, assignee: users.sam }],
  ]);
  const completions = new Map<string, TaskCompletion>();
  const hooks: CompletionHooks = {
    role: (house, person) => roles.get(`${house}/${person}`),
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

function requests(handler: ReturnType<typeof createCompletionHandler>) {
  function get(path: string, cookie?: string) {
    return handler(new Request(`${url}/api/completion/${path}`, {
      headers: cookie ? { Cookie: cookie } : {},
    }));
  }

  return {
    get,
    async post(path: string, input: object, cookie?: string) {
      const response = await handler(new Request(`${url}/api/completion/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(input),
      }));
      return { status: response.status, body: await response.json() };
    },
    readPhoto(submission: string, cookie: string) {
      return get(`submissions/${submission}/photo`, cookie);
    },
  };
}

describe("CompletionChecking HTTP", () => {
  const database = useMongoTestDb("completion");

  async function setup(label: string) {
    const application = assembleApplication(database);
    const { session } = accountRequests(application);
    const [alice, reviewer, sam, otherReviewer] = await Promise.all([
      session("register", `${label}-alice`),
      session("register", `${label}-reviewer`),
      session("register", `${label}-sam`),
      session("register", `${label}-other-reviewer`),
    ]);
    const { hooks, completions } = completionFixtures({
      alice: alice.user, reviewer: reviewer.user, sam: sam.user, otherReviewer: otherReviewer.user,
    });
    const photos = createPhotoStore(database());
    const uploadHandler = createPhotoHandler(photos, application.concepts.Sessioning);

    async function upload(cookie: string) {
      const response = await uploadHandler(new Request(`${url}/api/photos`, {
        method: "POST", headers: { "Content-Type": "image/png", Cookie: cookie }, body: png,
      }));
      expect(response.status).toBe(201);
      return (await response.json() as { photo: string }).photo;
    }

    const completion = (dependencies = hooks) => requests(createCompletionHandler(application.concepts, photos, dependencies));
    return { application, hooks, completions, completion, upload, alice, reviewer, sam, otherReviewer };
  }

  test("attaches a resident's upload, permits its household Overseer to view it, and awards credit once", async () => {
    const { completion, upload, application, completions, alice, reviewer, sam, otherReviewer } = await setup("review");
    const { post, readPhoto } = completion();
    const score = () => application.concepts.Ranking._score({ group: household, person: alice.user });
    const task = sinkTask;

    expect(await post("get", { task }, alice.cookie)).toMatchObject({
      status: 200,
      body: { completion: { task: { completed: false, photoInstructions: expect.any(String) }, current: [], history: [] } },
    });

    const foreignPhoto = await upload(sam.cookie);
    expect(await post("submit", { task, photo: foreignPhoto }, alice.cookie)).toEqual(notFound);
    expect(await post("submit", { task, photo: crypto.randomUUID() }, alice.cookie)).toEqual(notFound);

    const firstPhoto = await upload(alice.cookie);
    const first = await post("submit", { task, photo: firstPhoto }, alice.cookie);
    expect(first).toEqual({ status: 200, body: { submission: expect.any(String) } });
    const firstID = first.body.submission;
    expect(await score()).toEqual({ score: 0 });
    expect(await post("get", { task }, alice.cookie)).toMatchObject({
      status: 200,
      body: { completion: { current: [{ status: "PENDING", reviewedAt: null }], task: { completed: false } } },
    });
    expect(await post("submit", { task, photo: firstPhoto }, alice.cookie)).toEqual({
      status: 409, body: { error: "CONFLICT" },
    });

    expect(await post("review-queue", { household }, reviewer.cookie)).toMatchObject({
      status: 200,
      body: { queue: { items: [{ submission: firstID, person: alice.user, photo: firstPhoto, baseline: "demo-sink-baseline.jpg" }] } },
    });
    for (const cookie of [alice.cookie, reviewer.cookie]) {
      const image = await readPhoto(firstID, cookie);
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toBe("image/png");
      expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
    }
    expect((await readPhoto(firstID, sam.cookie)).status).toBe(404);
    expect((await readPhoto(firstID, otherReviewer.cookie)).status).toBe(404);

    const reject = { submission: firstID, decision: "REJECT" };
    expect(await post("review", reject, reviewer.cookie)).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await post("review", { ...reject, feedback: "Include the dish rack." }, reviewer.cookie)).toEqual({
      status: 200, body: { submission: firstID, task, status: "REJECTED" },
    });
    expect(await score()).toEqual({ score: 0 });

    const secondPhoto = await upload(alice.cookie);
    const second = await post("submit", { task, photo: secondPhoto }, alice.cookie);
    expect(second).toEqual({ status: 200, body: { submission: expect.any(String) } });
    const secondID = second.body.submission;
    expect(secondID).not.toBe(firstID);
    const approve = { submission: secondID, decision: "APPROVE", feedback: "Looks good." };
    const approved = { status: 200, body: { submission: secondID, task, status: "APPROVED" } };
    expect(await post("review", approve, reviewer.cookie)).toEqual(approved);
    expect(await post("review", { ...approve, feedback: "This retry cannot change the review." }, reviewer.cookie)).toEqual(approved);
    expect(await post("review-queue", { household }, reviewer.cookie)).toEqual({ status: 200, body: { queue: { items: [] } } });
    expect(await score()).toEqual({ score: 1 });

    const final = await post("get", { task }, alice.cookie);
    expect(final).toMatchObject({ status: 200, body: { completion: {
      task: { completed: true },
      current: [{
        submission: secondID, photo: secondPhoto, status: "APPROVED", feedback: approve.feedback,
        submittedAt: expect.any(String), reviewedAt: expect.any(String), reviewer: reviewer.user,
      }],
      history: [{ submission: secondID, status: "APPROVED" }, { submission: firstID, status: "REJECTED" }],
    } } });
    const { submittedAt, reviewedAt } = final.body.completion.current[0];
    expect(completions.get(task)).toMatchObject({
      submission: secondID, person: alice.user, submittedAt: new Date(submittedAt), reviewedAt: new Date(reviewedAt),
    });
    expect((await readPhoto(firstID, reviewer.cookie)).status).toBe(200);
  });

  test("takes the session from the cookie and conceals tasks and queues from other users", async () => {
    const { completion, alice, reviewer, sam, otherReviewer } = await setup("access");
    const { post } = completion();
    const task = sinkTask;
    expect(await post("get", { task, session: alice.cookie })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await post("get", { task }, sam.cookie)).toEqual(notFound);
    expect(await post("get", { task }, otherReviewer.cookie)).toEqual(notFound);
    expect(await post("submit", { task, photo: "photo.jpg" }, sam.cookie)).toEqual(notFound);
    expect(await post("submit", { task, person: sam.user, photo: "photo.jpg" }, alice.cookie)).toEqual({
      status: 400, body: { error: "INVALID_REQUEST" },
    });
    expect(await post("review-queue", { household }, alice.cookie)).toEqual(notFound);
    expect(await post("review-queue", { household }, otherReviewer.cookie)).toEqual(notFound);
    expect(await post("review", { submission: "unknown", decision: "APPROVE" }, reviewer.cookie)).toEqual(notFound);
  });

  test("retries an approval after completion recording fails and credits only after it succeeds", async () => {
    const { hooks, completion, upload, sam, reviewer, otherReviewer, application } = await setup("retry");
    let firstWrite = true;
    const { post } = completion({
      ...hooks,
      async recordCompletion(completion) {
        if (firstWrite) {
          firstWrite = false;
          throw new Error("Test completion write failed.");
        }
        await hooks.recordCompletion(completion);
      },
    });
    const photo = await upload(sam.cookie);
    const created = await post("submit", { task: otherTask, photo }, sam.cookie);
    expect(created).toEqual({ status: 200, body: { submission: expect.any(String) } });
    const submission = created.body.submission;
    const approve = { submission, decision: "APPROVE", feedback: "Done" };
    expect(await post("review", approve, reviewer.cookie)).toEqual(notFound);
    expect(await post("review", approve, sam.cookie)).toEqual(notFound);
    expect(await post("review", approve, otherReviewer.cookie)).toEqual({ status: 500, body: { error: "INTERNAL_ERROR" } });

    const score = () => application.concepts.Ranking._score({ group: otherHousehold, person: sam.user });
    expect(await score()).toEqual({ score: 0 });
    expect(await hooks.task(otherTask)).toMatchObject({ completed: false });
    const [original] = await application.concepts.PhotoChecking._submission({ submission });
    expect(original).toMatchObject({ status: "APPROVED", reviewer: otherReviewer.user, feedback: "Done" });

    expect(await post("review", { ...approve, feedback: "Different feedback" }, otherReviewer.cookie)).toEqual({
      status: 200, body: { task: otherTask, submission, status: "APPROVED" },
    });
    expect(await hooks.task(otherTask)).toMatchObject({ completed: true });
    expect(await score()).toEqual({ score: 1 });
    expect(await application.concepts.PhotoChecking._submission({ submission })).toEqual([original]);
  });

  test("requires login and reports when team hooks are unavailable", async () => {
    const application = assembleApplication(database);
    const { cookie } = await accountRequests(application).session("register", "completion-awaiting-hooks");
    const { post } = requests(createCompletionHandler(application.concepts, createPhotoStore(database())));
    expect(await post("get", { task: sinkTask })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await post("get", { task: sinkTask }, cookie)).toEqual({ status: 503, body: { error: "UNAVAILABLE" } });
  });
});

describe("Production completion", () => {
  const database = useMongoTestDb("completion_live");

  test("records an approved upload against the scheduled task and credits it once", async () => {
    const { createCompletionHooks } = await import("../../src/adapters/completionHttp.ts");
    const application = assembleApplication(database);
    const { ChoreCataloguing, TaskScheduling, Ranking, Sessioning } = application.concepts;
    const { session, accountRequest } = accountRequests(application);
    const handle = createHttpHandler({ application, gateway: createGateway({ application }), policy });
    async function call(path: string, input: object, cookie: string) {
      const response = await handle(new Request(url + "/api" + path, {
        method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }));
      expect(response.status).toBe(200);
      return response.json();
    }
    const owner = await session("register", "live-owner");
    const resident = await session("register", "live-resident");
    const neighbor = await session("register", "live-neighbor");
    const login = await session("login", "live-owner");
    expect((await accountRequest("me", {}, login.cookie)).status).toBe(200);
    const { household } = await call("/households/create", { name: "Home" }, owner.cookie);
    await call("/households/residents/add", { household, person: resident.user }, owner.cookie);
    await call("/households/residents/add", { household, person: neighbor.user }, owner.cookie);
    const { category } = await call("/households/categories/add", { household, name: "Kitchen" }, owner.cookie);
    await call("/households/preferences/set", {
      household, person: resident.user, category, preferenceLevel: "PREFER",
    }, resident.cookie);
    const photos = createPhotoStore(database());
    const photoHandler = createPhotoHandler(photos, Sessioning);
    const baselineUpload = await photoHandler(new Request(url + "/api/photos", {
      method: "POST", headers: { Cookie: owner.cookie, "Content-Type": "image/png" }, body: baselinePng,
    }));
    expect(baselineUpload.status).toBe(201);
    const { photo: baseline } = await baselineUpload.json();
    const createdChore = await ChoreCataloguing.create({
      group: household, category, name: "Sink", difficulty: 2, description: "Show the sink",
      requirements: ["Empty the sink"], references: [baseline],
    });
    if ("error" in createdChore) throw new Error(createdChore.error);
    const { chore } = createdChore;
    const start = new Date(Date.now() - 60_000).toISOString();
    const end = new Date(Date.now() + 60_000).toISOString();
    const { task } = await call("/assignments/tasks/create", { household, chore, interval: { start, end } }, owner.cookie);
    await call("/assignments/availability/add", { household, person: resident.user, start, end }, resident.cookie);
    const scheduling = await call("/assignments/auto-schedule", {
      household, from: start, until: end, onlyUnassigned: true,
    }, owner.cookie);
    expect(scheduling.scheduled).toEqual([{ task, person: resident.user }]);
    const upload = await photoHandler(new Request(url + "/api/photos", {
      method: "POST", headers: { Cookie: resident.cookie, "Content-Type": "image/png" }, body: png,
    }));
    expect(upload.status).toBe(201);
    const { photo } = await upload.json();
    const { get, post } = requests(createCompletionHandler(application.concepts, photos, createCompletionHooks(application.concepts)));
    const taskBaseline = `tasks/${task}/baseline`;
    expect((await get(taskBaseline)).status).toBe(401);
    expect((await get(taskBaseline, neighbor.cookie)).status).toBe(404);
    const reference = await get(taskBaseline, resident.cookie);
    expect(reference.status).toBe(200);
    expect(reference.headers.get("content-type")).toBe("image/png");
    expect(reference.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await reference.arrayBuffer())).toEqual(baselinePng);
    expect((await photoHandler(new Request(`${url}/api/photos/${baseline}`, {
      headers: { Cookie: resident.cookie },
    }))).status).toBe(404);
    const token = resident.cookie.split("=")[1];
    expect(await application.invoker.invoke("/completion/submit", {
      session: token, task, photo: "missing-upload",
    }, { timeoutMs: 2000 })).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
    expect(await application.invoker.invoke("/completion/submit", {
      session: token, task, photo: baseline,
    }, { timeoutMs: 2000 })).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
    const result = await call("/completion/submit", { task, photo }, resident.cookie);
    expect(await ChoreCataloguing.updateReferencePhotos({
      chore, group: household, references: [],
    })).toEqual({ chore });
    expect((await get(taskBaseline, resident.cookie)).status).toBe(404);

    const attemptBaseline = `submissions/${result.submission}/baseline`;
    expect((await get(attemptBaseline, neighbor.cookie)).status).toBe(404);
    for (const cookie of [owner.cookie, resident.cookie]) {
      const image = await get(attemptBaseline, cookie);
      expect(image.status).toBe(200);
      expect(new Uint8Array(await image.arrayBuffer())).toEqual(baselinePng);
    }
    const review = { submission: result.submission, decision: "APPROVE" };
    expect(await post("review", review, resident.cookie)).toEqual(notFound);
    expect((await post("review", review, owner.cookie)).status).toBe(200);
    expect((await post("review", review, owner.cookie)).status).toBe(200);
    expect(await TaskScheduling._get({ task })).toMatchObject([{ completedBy: resident.user }]);
    expect(await Ranking._score({ group: household, person: resident.user })).toEqual({ score: 1 });
  });
});
