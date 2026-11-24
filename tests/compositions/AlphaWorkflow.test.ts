import { expect, test } from "bun:test";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { assembleApplication } from "../../src/assembly.ts";
import { createCatalogHandler } from "../../src/compositions/Catalog.ts";
import { createCompletionHandler } from "../../src/compositions/CompletionChecking.ts";
import { completionHooks } from "../../src/compositions/completionHooks.ts";
import { createPhotoHandler, createPhotoStore } from "../../src/compositions/Photos.ts";
import { policy } from "../../src/http.ts";
import { accountRequests } from "../helpers/accounts.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("alpha_workflow");

test("seven catalog chores produce fourteen tasks while preferences and completion use the right identities", async () => {
  const application = assembleApplication(database);
  const { concepts } = application;
  const store = createPhotoStore(database());
  const catalog = createCatalogHandler(concepts, store);
  const completion = createCompletionHandler(concepts, store, completionHooks(concepts));
  const uploads = createPhotoHandler(store, concepts.Sessioning);
  const api = createHttpHandler({ application, gateway: createGateway({ application }), policy });
  const { session } = accountRequests(application);
  const [owner, resident, outsider] = await Promise.all(["owner", "resident", "outsider"].map(name => session("register", name)));

  function send(path: string, cookie: string, input?: object) {
    const handler = path.startsWith("catalog/") ? catalog : path.startsWith("completion/") ? completion : api;
    return handler(new Request("http://localhost/api/" + path, {
      signal: AbortSignal.timeout(3000),
      method: input ? "POST" : "GET", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: policy.publicOrigin! },
      ...(input && { body: JSON.stringify(input) }),
    }));
  }
  async function post(path: string, cookie: string, input: object) {
    const response = await send(path, cookie, input);
    const body = await response.json();
    if (!response.ok) throw new Error(`POST ${path} returned ${response.status} ${JSON.stringify(body)}`);
    return body;
  }
  async function upload(cookie: string, label: number) {
    const response = await uploads(new Request("http://localhost/api/photos", { method: "POST",
      headers: { Cookie: cookie, "Content-Type": "image/jpeg" }, body: new Uint8Array([255, 216, 255, label]),
    }));
    expect(response.status).toBe(201);
    return (await response.json()).photo as string;
  }

  const { household } = await post("households/create", owner.cookie, { name: "Home" });
  await post("catalog/add-resident", owner.cookie, { household, username: "resident" });
  // Exercise the migration from the original catalog index before adding active chores.
  await database().collection("chore_cataloguing_chores").createIndex(
    { group: 1, name: 1 }, { unique: true, collation: { locale: "simple" } },
  );
  const baseline = await upload(owner.cookie, 1);
  const definition = { household, difficulty: 3, description: "Show the sink.", criteria: "All clear.", photo: baseline };
  expect((await send("catalog/create", resident.cookie, { ...definition, name: "Dishes" })).status).toBe(403);
  const names = ["Dishes", "Floors", "Laundry", "Recycling", "Shower", "Sink", "Trash"];
  const chores = await Promise.all(names.map(async name =>
    (await post("catalog/create", owner.cookie, { ...definition, name })).chore as string));
  const [chore, alternate] = chores;
  const order = { household, order: chores };
  expect((await send("catalog/preferences", outsider.cookie, order)).status).toBe(403);
  expect((await send("catalog/preferences", resident.cookie, { ...order, person: owner.user })).status).toBe(400);
  expect((await send("catalog/preferences", resident.cookie, { household, order: [chore, chore] })).status).toBe(400);
  expect((await send("catalog/preferences", resident.cookie, { household, order: ["outside-this-catalog"] })).status).toBe(404);
  await post("catalog/preferences", resident.cookie, order);
  expect(await post("catalog/list", owner.cookie, { household })).toMatchObject({ choreOrder: [] });
  const catalogView = await post("catalog/list", resident.cookie, { household });
  expect(catalogView.choreOrder).toEqual(chores);
  expect(catalogView.chores.map(({ name }: { name: string }) => name)).toEqual(names);
  expect(catalogView.chores.every((entry: object) => !("category" in entry))).toBe(true);
  await post("catalog/preferences", owner.cookie, { household, order: [alternate, ...chores.slice(2), chore] });
  const reference = `catalog/${chore}/references/${baseline}`;
  expect((await send(reference, resident.cookie)).status).toBe(200);
  expect((await send(reference, outsider.cookie)).status).toBe(404);

  const start = "2027-01-04T12:00:00Z", end = "2027-01-04T13:00:00Z";
  const nextStart = "2027-01-06T12:00:00Z", nextEnd = "2027-01-06T13:00:00Z";
  const availability = { household, adding: true, windows: [{ start, end }] };
  expect((await send("assignments/availability/edit", outsider.cookie, availability)).status).toBe(403);
  await post("assignments/availability/edit", resident.cookie, availability);
  await post("assignments/availability/edit", owner.cookie, availability);

  const { task } = await post("assignments/tasks/create", owner.cookie, { household, chore, interval: { start, end }, deadline: end });
  const { task: nextTask } = await post("assignments/tasks/create", owner.cookie, {
    household, chore, interval: { start: nextStart, end: nextEnd }, deadline: nextEnd,
  });
  await Promise.all(chores.slice(1).map(async (item, index) => {
    const at = (day: number, hour: number) => new Date(Date.UTC(2027, 0, day, hour)).toISOString();
    const later = 14 + index;
    const windows = [4, 6].map(day => ({ start: at(day, later), end: at(day, later + 1) }));
    await post("assignments/tasks/create-batch", owner.cookie, { household, chore: item, batchId: crypto.randomUUID(), windows });
  }));
  const week = { household, from: start, until: "2027-01-11T00:00:00Z" };
  const { tasks } = await post("assignments/schedule", owner.cookie, week);
  expect(tasks).toHaveLength(14);
  for (const item of chores) expect(tasks.filter((row: { item: string }) => row.item === item)).toHaveLength(2);
  expect(await post("assignments/weekly", owner.cookie, week)).toMatchObject({ scheduled: [{ task, person: resident.user }] });
  const readTask = (id = task) => post("assignments/task", resident.cookie, { household, task: id });
  expect(await readTask()).toMatchObject({ task: { item: chore, category: null, assignee: resident.user, completedAt: null } });
  const submit = async () => post("completion/submit", resident.cookie, { task, photo: await upload(resident.cookie, 2) });
  const first = await submit();
  await post("completion/review", owner.cookie, { ...first, decision: "REJECT", feedback: "Show the rack." });
  const second = await submit();
  const approve = () => post("completion/review", owner.cookie, { ...second, decision: "APPROVE" });
  await Promise.all([approve(), approve()]);
  const { completion: recorded } = await post("completion/get", resident.cookie, { task });
  expect(recorded.history.map((row: { status: string }) => row.status)).toEqual(["APPROVED", "REJECTED"]);
  expect(await readTask()).toMatchObject({ task: { completedAt: recorded.current[0].submittedAt, completedBy: resident.user } });
  expect(await readTask(nextTask)).toMatchObject({ task: { item: chore, assignee: null, completedAt: null } });
  expect(await post("catalog/list", resident.cookie, { household })).toMatchObject({ choreOrder: chores });
  expect(await post("catalog/list", resident.cookie, { household })).toMatchObject({ ranking: [{ person: resident.user, score: 1 }] });
  const deleteChore = { household, chore };
  expect((await send("catalog/delete", resident.cookie, deleteChore)).status).toBe(403);
  expect((await send("catalog/delete", outsider.cookie, deleteChore)).status).toBe(403);
  const otherHome = await post("households/create", outsider.cookie, { name: "Other home" });
  expect((await send("catalog/delete", outsider.cookie, { ...deleteChore, household: otherHome.household })).status).toBe(404);
  await post("catalog/delete", owner.cookie, deleteChore);
  expect(await post("catalog/list", resident.cookie, { household })).toMatchObject({ choreOrder: chores.slice(1) });
  expect((await post("catalog/list", resident.cookie, { household })).chores).toHaveLength(6);
  expect((await send("assignments/tasks/create", owner.cookie, { household, chore, interval: { start, end } })).status).toBe(404);
  expect(await post("assignments/list", owner.cookie, week)).toMatchObject({
    assignments: expect.arrayContaining([expect.objectContaining({
      task, chore: expect.objectContaining({ name: "Dishes", description: definition.description }),
    })]),
  });
  expect((await send(reference, resident.cookie)).status).toBe(200);
  const replacement = await post("catalog/create", owner.cookie, { ...definition, name: "Dishes" });
  expect(replacement.chore).not.toBe(chore);

  const remove = { household, task };
  expect((await send("assignments/tasks/delete", resident.cookie, remove)).status).toBe(403);
  expect((await send("assignments/tasks/delete", outsider.cookie, { ...remove, household: otherHome.household })).status).toBe(404);
  await post("assignments/tasks/delete", owner.cookie, remove);
  expect((await send("assignments/task", resident.cookie, remove)).status).toBe(404);
  expect((await post("assignments/schedule", owner.cookie, week)).tasks).toHaveLength(13);
  expect(await readTask(nextTask)).toMatchObject({ task: { item: chore, completedAt: null } });
  const path = `completion/submissions/${second.submission}/baseline`;
  expect((await send(path, owner.cookie)).status).toBe(200);
  expect((await send(path, outsider.cookie)).status).toBe(404);
  expect((await send("completion/reviewed", resident.cookie, { household })).status).toBe(404);
  expect((await post("completion/reviewed", owner.cookie, { household })).queue.items).toHaveLength(2);
  expect(await post("catalog/list", resident.cookie, { household })).toMatchObject({ ranking: [{ person: resident.user, score: 1 }] });

  await post("assignments/availability/edit", resident.cookie, {
    household, adding: true, windows: [{ start: nextStart, end: nextEnd }],
  });
  await post("assignments/set", owner.cookie, { household, entries: [{ task: nextTask, assignee: resident.user }] });
  const pending = await post("completion/submit", resident.cookie, { task: nextTask, photo: await upload(resident.cookie, 3) });
  await post("assignments/tasks/delete", owner.cookie, { household, task: nextTask });
  expect(await post("completion/review-queue", owner.cookie, { household })).toEqual({ queue: { items: [] } });
  expect((await send("completion/review", owner.cookie, { ...pending, decision: "APPROVE" })).status).toBe(404);
});

test("availability edits preserve unaffected coverage and free only assignments in the removed period", async () => {
  const { concepts } = assembleApplication(database);
  const group = "availability", person = "resident";
  const at = (hour: number, day = 1) => new Date(Date.UTC(2027, 0, day, hour));
  const windows = [1, 2].map(day => ({ start: at(9, day), end: at(17, day) }));
  const scheduling = concepts.TaskScheduling;
  const edit = (adding: boolean, selected = windows) => scheduling.editAvailability({ group, person, windows: selected, adding });
  await edit(true);
  await edit(true);
  expect(await scheduling._availability({ group, person })).toHaveLength(2);
  const tasks: string[] = [];
  for (const hour of [10, 14]) {
    const result = await scheduling.add({ group, item: "item", category: "kitchen", weight: 1, interval: { start: at(hour), end: at(hour + 1) } });
    if ("error" in result) throw new Error(result.error);
    tasks.push(result.task);
  }
  await scheduling.setSchedule({ group, entries: tasks.map(task => ({ task, assignee: person })) });
  const cuts = [1, 2].map(day => ({ start: at(13, day), end: at(15, day) }));
  expect(await edit(false, cuts)).toEqual({ freed: [{ task: tasks[1] }] });
  expect(await edit(false, cuts)).toEqual({ freed: [] });
  expect(await scheduling._availability({ group, person })).toHaveLength(4);
  expect((await scheduling._get({ task: tasks[0] }))[0]?.assignee).toBe(person);
});
