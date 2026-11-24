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

test("two accounts schedule a catalog chore, revise evidence and persist a single completion credit", async () => {
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
      method: input ? "POST" : "GET", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: policy.publicOrigin! },
      ...(input && { body: JSON.stringify(input) }),
    }));
  }
  async function post(path: string, cookie: string, input: object) {
    const response = await send(path, cookie, input);
    expect(response.ok).toBe(true);
    return response.json();
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
  const { category } = await post("households/categories/add", owner.cookie, { household, name: "Kitchen" });
  const baseline = await upload(owner.cookie, 1);
  const definition = { household, category, name: "Dishes", difficulty: 3, description: "Show the sink.", criteria: "All clear.", photo: baseline };
  expect((await send("catalog/create", resident.cookie, definition)).status).toBe(403);
  const { chore } = await post("catalog/create", owner.cookie, definition);
  const reference = `catalog/${chore}/references/${baseline}`;
  expect((await send(reference, resident.cookie)).status).toBe(200);
  expect((await send(reference, outsider.cookie)).status).toBe(404);

  const start = "2027-01-04T12:00:00Z", end = "2027-01-04T13:00:00Z";
  await post("households/preferences/set", resident.cookie, { household, person: resident.user, category, preferenceLevel: "PREFER" });
  const availability = { household, adding: true, windows: [{ start, end }] };
  expect((await send("assignments/availability/edit", outsider.cookie, availability)).status).toBe(403);
  await post("assignments/availability/edit", resident.cookie, availability);
  const { task } = await post("assignments/tasks/create", owner.cookie, { household, chore, interval: { start, end }, deadline: end });
  expect(await post("assignments/weekly", owner.cookie, { household, from: start, until: end }))
    .toMatchObject({ scheduled: [{ task, person: resident.user }] });
  const readTask = () => post("assignments/task", resident.cookie, { household, task });
  expect(await readTask()).toMatchObject({ task: { assignee: resident.user, completedAt: null } });
  const submit = async () => post("completion/submit", resident.cookie, { task, photo: await upload(resident.cookie, 2) });
  const first = await submit();
  await post("completion/review", owner.cookie, { ...first, decision: "REJECT", feedback: "Show the rack." });
  const second = await submit();
  const approve = () => post("completion/review", owner.cookie, { ...second, decision: "APPROVE" });
  await Promise.all([approve(), approve()]);
  const { completion: recorded } = await post("completion/get", resident.cookie, { task });
  expect(recorded.history.map((row: { status: string }) => row.status)).toEqual(["APPROVED", "REJECTED"]);
  expect(await readTask()).toMatchObject({ task: { completedAt: recorded.current[0].submittedAt, completedBy: resident.user } });
  expect(await post("catalog/list", resident.cookie, { household })).toMatchObject({ ranking: [{ person: resident.user, score: 1 }] });
  await concepts.ChoreCataloguing.updateReferencePhotos({ chore, group: household, references: [] });
  const path = `completion/submissions/${second.submission}/baseline`;
  expect((await send(path, owner.cookie)).status).toBe(200);
  expect((await send(path, outsider.cookie)).status).toBe(404);
  expect((await send("completion/reviewed", resident.cookie, { household })).status).toBe(404);
  expect((await post("completion/reviewed", owner.cookie, { household })).queue.items).toHaveLength(2);
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
