import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { policy } from "../../src/http.ts";
import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import {
  createCompletionHandler,
  createCompletionHooks,
  type CompletionHooks,
  type TaskCompletion,
} from "../../src/adapters/completionHttp.ts";
import { createPhotoHandler, createPhotoStore } from "../../src/adapters/photos.ts";
import { accountRequests } from "../helpers/accounts.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const url = "http://127.0.0.1";
const notFound = { status: 404, body: { error: "NOT_FOUND" } };
const conflict = { status: 409, body: { error: "CONFLICT" } };
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2QAAAAASUVORK5CYII=", "base64",
));

async function completionFixtures(
  application: ReturnType<typeof assembleApplication>,
  users: { alice: string; sam: string; reviewer: string; otherReviewer: string },
) {
  const { ChoreCataloguing, HouseholdManaging, TaskScheduling } = application.concepts;

  async function createHousehold(overseer: string) {
    const result = await HouseholdManaging.create({ name: "Chore house", overseer });
    if ("error" in result) throw new Error(result.error);
    return result.household;
  }
  const household = await createHousehold(users.reviewer);
  const otherHousehold = await createHousehold(users.otherReviewer);
  await HouseholdManaging.addResident({ household, person: users.alice });
  await HouseholdManaging.addResident({ household, person: users.sam });
  await HouseholdManaging.addResident({ household: otherHousehold, person: users.sam });

  async function addTask(group: string, person: string, name: string, firstDay: string, lastDay = firstDay) {
    const interval = {
      start: new Date(`${firstDay}T00:00:00-05:00`),
      end: new Date(`${lastDay}T23:59:00-05:00`),
    };
    const created = await ChoreCataloguing.create({
      group, name, difficulty: 1, description: "Show the whole sink and dish rack.",
      requirements: ["The sink and dish rack are empty."], references: ["demo-sink-baseline.jpg"],
    });
    if ("error" in created) throw new Error(created.error);
    const added = await TaskScheduling.add({ group, item: created.chore, interval, weight: 1 });
    if ("error" in added) throw new Error(added.error);
    const { task } = added;
    await TaskScheduling.editAvailability({ group, person, windows: [interval], adding: true });
    await TaskScheduling.setSchedule({ group, entries: [{ task, assignee: person }] });
    return task;
  }

  const sinkTask = await addTask(household, users.alice, "Clear the sink", "2026-12-01");
  const nextSinkTask = await addTask(household, users.alice, "Clear the sink next week", "2026-12-08");
  const weekendTask = await addTask(household, users.alice, "Clean the kitchen", "2026-12-04", "2026-12-06");
  const otherTask = await addTask(otherHousehold, users.sam, "Clear the sink", "2026-12-01");

  const completions = new Map<string, TaskCompletion>();
  const live = createCompletionHooks(application.concepts);
  const hooks: CompletionHooks = {
    ...live,
    async recordCompletion(completion) {
      await live.recordCompletion(completion);
      if (!completions.has(completion.task)) completions.set(completion.task, completion);
    },
  };
  return { hooks, completions, sinkTask, nextSinkTask, weekendTask, otherTask, household, otherHousehold };
}

function requests(handler: ReturnType<typeof createCompletionHandler>, submit = handler) {
  return {
    async post(path: string, input: object, cookie?: string) {
      const handle = path === "submit" ? submit : handler;
      const response = await handle(new Request(`${url}/api/completion/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(input),
      }));
      return { status: response.status, body: await response.json() };
    },
    readPhoto(submission: string, cookie: string) {
      return handler(new Request(`${url}/api/completion/submissions/${submission}/photo`, {
        headers: { Cookie: cookie },
      }));
    },
  };
}

describe("CompletionChecking HTTP", () => {
  const database = useMongoTestDb("completion");

  async function setup(label: string) {
    let now = new Date("2026-12-01T12:00:00-05:00");
    const application = assembleApplication(database, () => now);
    const { session } = accountRequests(application);
    const [alice, reviewer, sam, otherReviewer] = await Promise.all([
      session("register", `${label}-alice`),
      session("register", `${label}-reviewer`),
      session("register", `${label}-sam`),
      session("register", `${label}-other-reviewer`),
    ]);
    const fixtures = await completionFixtures(application, {
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

    const submit = createHttpHandler({ application, gateway: createGateway({ application }), policy });
    const setTime = (iso: string) => { now = new Date(iso); };
    const completion = (dependencies = fixtures.hooks) => requests(createCompletionHandler(application.concepts, photos, dependencies), submit);
    return { ...fixtures, application, completion, upload, alice, reviewer, sam, otherReviewer, setTime };
  }

  test("attaches a resident's upload, permits its household Overseer to view it, and awards credit once", async () => {
    const { completion, upload, application, completions, alice, reviewer, sam, otherReviewer, household, sinkTask } = await setup("review");
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
    const { completion, alice, reviewer, sam, otherReviewer, household, sinkTask } = await setup("access");
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

  test("checks each occurrence's window for new evidence and permits review after it closes", async () => {
    const { application, completion, upload, alice, reviewer, setTime, sinkTask, nextSinkTask, weekendTask } = await setup("windows");
    const { post } = completion();
    const photo = await upload(alice.cookie);
    const submit = (task: string) => post("submit", { task, photo }, alice.cookie);
    const submitDirect = (task: string) => application.invoker.invoke("/completion/submit", {
      session: alice.cookie.split("=")[1], task, photo,
    }, { timeoutMs: 2000 });

    setTime("2026-11-30T23:59:59.999-05:00");
    expect(await submitDirect(sinkTask)).toMatchObject({ ok: false, error: { kind: "domain", value: "SUBMISSION_NOT_OPEN" } });
    expect(await submit(sinkTask)).toEqual(conflict);
    setTime("2026-12-01T00:00:00-05:00");
    expect(await submit(sinkTask)).toMatchObject({ status: 200 });
    expect(await submit(nextSinkTask)).toEqual(conflict);

    setTime("2026-12-03T23:59:59.999-05:00");
    expect(await submit(weekendTask)).toEqual(conflict);
    setTime("2026-12-06T23:59:00-05:00");
    const weekend = await submit(weekendTask);
    expect(weekend).toMatchObject({ status: 200 });
    expect(await post("get", { task: weekendTask }, alice.cookie)).toMatchObject({
      body: { completion: { current: [{ submittedAt: "2026-12-07T04:59:00.000Z" }] } },
    });
    setTime("2026-12-06T23:59:00.001-05:00");
    expect(await post("review", {
      submission: weekend.body.submission, decision: "REJECT", feedback: "Include the counter.",
    }, reviewer.cookie)).toMatchObject({ status: 200 });
    expect(await submitDirect(weekendTask)).toMatchObject({ ok: false, error: { kind: "domain", value: "SUBMISSION_CLOSED" } });
    expect(await submit(weekendTask)).toEqual(conflict);

    setTime("2026-12-08T12:00:00-05:00");
    expect(await submit(sinkTask)).toEqual(conflict);
    expect(await submit(nextSinkTask)).toMatchObject({ status: 200 });
  });

  test("retries an approval after completion recording fails and credits only after it succeeds", async () => {
    const { hooks, completion, upload, sam, reviewer, otherReviewer, application, otherTask, otherHousehold } = await setup("retry");
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
    expect(await post("get", { task: "task" })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await post("get", { task: "task" }, cookie)).toEqual({ status: 503, body: { error: "UNAVAILABLE" } });
  });
});

describe("Production completion", () => {
  const database = useMongoTestDb("completion_live");

  test("records an approved upload against the scheduled task and credits it once", async () => {
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
    const login = await session("login", "live-owner");
    expect((await accountRequest("me", {}, login.cookie)).status).toBe(200);
    const { household } = await call("/households/create", { name: "Home" }, owner.cookie);
    await call("/households/residents/add", { household, person: resident.user }, owner.cookie);
    const { category } = await call("/households/categories/add", { household, name: "Kitchen" }, owner.cookie);
    await call("/households/preferences/set", {
      household, person: resident.user, category, preferenceLevel: "PREFER",
    }, resident.cookie);
    const createdChore = await ChoreCataloguing.create({
      group: household, category, name: "Sink", difficulty: 2, description: "Show the sink",
      requirements: ["Empty the sink"], references: [],
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
    const photos = createPhotoStore(database());
    const upload = await createPhotoHandler(photos, Sessioning)(new Request(url + "/api/photos", {
      method: "POST", headers: { Cookie: resident.cookie, "Content-Type": "image/png" }, body: png,
    }));
    expect(upload.status).toBe(201);
    const { photo } = await upload.json();
    const { post } = requests(createCompletionHandler(application.concepts, photos, createCompletionHooks(application.concepts)));
    const token = resident.cookie.split("=")[1];
    expect(await application.invoker.invoke("/completion/submit", {
      session: token, task, photo: "missing-upload",
    }, { timeoutMs: 2000 })).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
    const foreignUpload = await createPhotoHandler(photos, Sessioning)(new Request(url + "/api/photos", {
      method: "POST", headers: { Cookie: owner.cookie, "Content-Type": "image/png" }, body: png,
    }));
    expect(foreignUpload.status).toBe(201);
    const foreign = await foreignUpload.json();
    expect(await application.invoker.invoke("/completion/submit", {
      session: token, task, photo: foreign.photo,
    }, { timeoutMs: 2000 })).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
    const result = await call("/completion/submit", { task, photo }, resident.cookie);
    const review = { submission: result.submission, decision: "APPROVE" };
    expect(await post("review", review, resident.cookie)).toEqual(notFound);
    expect((await post("review", review, owner.cookie)).status).toBe(200);
    expect((await post("review", review, owner.cookie)).status).toBe(200);
    expect(await TaskScheduling._get({ task })).toMatchObject([{ completedBy: resident.user }]);
    expect(await Ranking._score({ group: household, person: resident.user })).toEqual({ score: 1 });
  });
});
