import { describe, expect, spyOn, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../../src/assembly.ts";
import { policy } from "../../src/http.ts";
import { TaskSchedulingConcept } from "../../src/concepts/TaskScheduling/TaskScheduling.ts";
import type { WeekAvailability } from "../../src/shared/weeklyAvailability.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("chore_assignments");
const at = (hour: number) => new Date(Date.UTC(2027, 0, 4, hour)).toISOString();
const interval = (start: number, end: number) => ({ start: at(start), end: at(end) });

function weeklyDays(days: Partial<WeekAvailability> = {}): WeekAvailability {
  return {
    Monday: "NOT_AVAILABLE", Tuesday: "NOT_AVAILABLE", Wednesday: "NOT_AVAILABLE", Thursday: "NOT_AVAILABLE",
    Friday: "NOT_AVAILABLE", Saturday: "NOT_AVAILABLE", Sunday: "NOT_AVAILABLE", ...days,
  };
}

async function setup() {
  const application = assembleApplication(database);
  const handler = createHttpHandler({ application, gateway: createGateway({ application }), policy });
  async function post(path: string, body: object, cookie?: string) {
    const response = await handler(new Request(`http://localhost/api${path}`, {
      signal: AbortSignal.timeout(2000),
      method: "POST", headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json(), cookie: response.headers.get("Set-Cookie")?.split(";")[0] };
  }
  async function register() {
    const response = await post("/user/register", { username: crypto.randomUUID().slice(0, 12), password: "correct horse battery" });
    expect(response.status).toBe(200);
    return { person: response.body.user as string, cookie: response.cookie! };
  }
  const owner = await register();
  const resident = await register();
  const outsider = await register();
  const created = await post("/households/create", { name: "Home" }, owner.cookie);
  expect(created.status).toBe(200);
  const household = created.body.household as string;
  expect((await post("/households/residents/add", { household, person: resident.person }, owner.cookie)).status).toBe(200);
  const added = await post("/households/categories/add", { household, name: "Kitchen" }, owner.cookie);
  expect(added.status).toBe(200);
  const category = added.body.category as string;
  const catalogued = await application.concepts.ChoreCataloguing.create({
    group: household, category, name: "Dishes", description: "Wash plates.", difficulty: 3, requirements: [], references: [],
  });
  if ("error" in catalogued) throw new Error(catalogued.error);
  const invoke = (path: string, body: object, cookie = owner.cookie) => application.invoker.invoke(
    `/assignments/${path}`, { ...body, household, session: cookie.split("=")[1] }, { timeoutMs: 2000 },
  );
  const request = (path: string, body: object, cookie?: string) => post(`/assignments/${path}`, { ...body, household }, cookie);
  const createTask = async (timing: object) => {
    const created = await request("tasks/create", { chore: catalogued.chore, ...timing }, owner.cookie);
    expect(created.status).toBe(200);
    return created.body.task as string;
  };
  return { application, post, request, invoke, createTask, owner, resident, outsider, household, category, chore: catalogued.chore };
}

describe("ChoreAssignments", () => {
  test("authorizes availability and task changes and preserves chore snapshots", async () => {
    const { request, invoke, createTask, owner, resident, outsider, application, household, category, chore } = await setup();
    const add = { person: resident.person, ...interval(1, 8) };
    expect((await request("availability/add", add)).status).toBe(401);
    expect((await request("availability/add", add, outsider.cookie)).status).toBe(403);
    expect((await request("availability/add", { ...add, requester: owner.person }, resident.cookie)).status).toBe(400);
    expect((await request("availability/add", { ...add, end: "invalid" }, resident.cookie)).status).toBe(400);
    const own = await request("availability/add", add, resident.cookie);
    expect(own.status).toBe(200);
    expect((await request("availability/add", { ...add, person: outsider.person }, owner.cookie)).status).toBe(404);
    expect((await request("availability/remove", { person: owner.person, availability: own.body.availability }, owner.cookie)).status).toBe(404);
    expect((await request("tasks/create", { chore, interval: interval(2, 3) }, resident.cookie)).status).toBe(403);
    const foreign = await application.concepts.ChoreCataloguing.create({
      group: "other-group", category, name: "Other", description: "", difficulty: 1, requirements: [], references: [],
    });
    if ("error" in foreign) throw new Error(foreign.error);
    expect((await request("tasks/create", { chore: foreign.chore, deadline: at(8) }, owner.cookie)).status).toBe(404);
    const wrongCategory = await application.concepts.ChoreCataloguing.create({
      group: household, category: "nonexistent", name: "Other category", description: "", difficulty: 1,
      requirements: [], references: [],
    });
    if ("error" in wrongCategory) throw new Error(wrongCategory.error);
    expect((await request("tasks/create", { chore: wrongCategory.chore, deadline: at(8) }, owner.cookie)).status).toBe(404);
    const task = await createTask({ deadline: at(8), interval: interval(2, 3) });
    await application.concepts.ChoreCataloguing.updateDifficulty({ group: household, chore, difficulty: 8 });
    expect((await application.concepts.TaskScheduling._get({ task }))[0]).toMatchObject({ category, weight: 3 });
    expect((await request("tasks/deadline", { task, deadline: at(2) }, owner.cookie)).status).toBe(400);
    expect((await request("tasks/deadline", { task, deadline: at(9) }, owner.cookie)).status).toBe(200);
    expect((await request("tasks/interval", { task, interval: interval(3, 4) }, owner.cookie)).status).toBe(200);
    expect((await request("set", { entries: [{ task, assignee: resident.person }] }, owner.cookie)).status).toBe(200);
    expect(await request("availability/remove", { person: resident.person, availability: own.body.availability }, resident.cookie))
      .toMatchObject({ status: 200, body: { freed: [{ task }] } });
    await application.concepts.TaskScheduling.complete({ task, completedBy: resident.person, completedAt: new Date(at(4)) });
    expect(await invoke("tasks/remove", { task })).toMatchObject({ ok: false, error: { value: "TASK_STATUS_CONFLICT" } });
    expect(await application.concepts.TaskScheduling.remove({ task })).toMatchObject({ error: "TASK_STATUS_CONFLICT" });
    const removable = await createTask({ deadline: at(8) });
    expect((await request("tasks/remove", { task: removable }, owner.cookie)).status).toBe(200);
    expect((await request("tasks/remove", { task: removable }, owner.cookie)).status).toBe(404);
  });

  test("uses weekday availability for all-day tasks and prefers available residents over the fallback", async () => {
    const { request, owner, resident, outsider, createTask, chore, household, category, post, application } = await setup();
    const pay = { days: weeklyDays({ Monday: "AVAILABLE" }), timeZone: "UTC" };
    const save = (input: object, cookie?: string) => request("availability/weekly/set", input, cookie);
    const read = (cookie: string) => request("availability/weekly", { person: resident.person }, cookie);

    expect(await read(resident.cookie)).toMatchObject({ status: 200, body: { days: null } });
    expect((await read(outsider.cookie)).status).toBe(403);
    expect((await save(pay)).status).toBe(401);
    expect((await save(pay, outsider.cookie)).status).toBe(403);
    expect((await save({ ...pay, person: owner.person }, resident.cookie)).status).toBe(400);
    expect((await save({ ...pay, timeZone: "Invalid/Zone" }, resident.cookie)).status).toBe(400);
    expect((await save({ ...pay, days: { Monday: "AVAILABLE" } }, resident.cookie)).status).toBe(400);

    const start = at(0);
    const end = new Date(Date.UTC(2027, 0, 5)).toISOString();
    const window = { from: start, until: end };
    expect((await request("availability/add", { person: resident.person, start: at(1), end }, resident.cookie)).status).toBe(200);
    const task = await createTask({ interval: { start, end } });
    const auto = () => request("weekly", window, owner.cookie);
    expect(await auto()).toMatchObject({ status: 200, body: { scheduled: [], unassigned: [{ task }] } });

    expect((await save(pay, resident.cookie)).status).toBe(200);
    expect(await read(owner.cookie)).toMatchObject({ status: 200, body: { days: pay.days } });
    expect(await request("overview", {}, owner.cookie)).toMatchObject({
      status: 200, body: { residents: [{ person: owner.person, weeklyAvailability: null }, { person: resident.person, weeklyAvailability: pay.days }] },
    });
    expect((await save({ ...pay, days: weeklyDays({ Monday: "SOMEWHAT_AVAILABLE" }) }, owner.cookie)).status).toBe(200);
    // The preferred chore would favor the overseer if both people were in the same availability tier.
    await post("/households/preferences/set", { household, person: owner.person, category, preferenceLevel: "PREFER" }, owner.cookie);
    await post("/households/preferences/set", { household, person: resident.person, category, preferenceLevel: "AVOID" }, resident.cookie);
    expect(await auto()).toMatchObject({ status: 200, body: { scheduled: [{ task, person: resident.person }] } });

    expect(await save({ ...pay, days: weeklyDays() }, resident.cookie)).toMatchObject({ status: 200, body: { freed: [{ task }] } });
    expect(await auto()).toMatchObject({ status: 200, body: { scheduled: [{ task, person: owner.person }] } });
    expect(await application.concepts.TaskScheduling._get({ task })).toMatchObject([{ item: chore, assignee: owner.person }]);
  });

  test("matches all dates of a weekly series by the task's local weekday", async () => {
    const { request, owner, resident, chore, application, household } = await setup();
    const windows = [4, 11].map(day => ({
      start: new Date(Date.UTC(2027, 0, day, 2)).toISOString(),
      end: new Date(Date.UTC(2027, 0, day, 3)).toISOString(),
    }));
    const pattern = { days: weeklyDays({ Sunday: "SOMEWHAT_AVAILABLE" }), timeZone: "UTC" };
    const save = (input: object) => request("availability/weekly/set", input, resident.cookie);
    expect((await save(pattern)).status).toBe(200);
    const created = await request("tasks/create-batch", {
      chore, batchId: crypto.randomUUID(), windows, repeatWeekly: true, timeZone: "America/New_York",
    }, owner.cookie);
    expect(created.status).toBe(200);
    const [first, second] = created.body.tasks;
    const assign = () => request("weekly", { from: at(0), until: at(6) }, owner.cookie);
    // Both UTC Mondays start on Sunday in the scheduling time zone, even for residents saving from UTC.
    expect(await assign()).toMatchObject({ status: 200, body: { scheduled: [{ ...first, person: resident.person }] } });
    expect(await application.concepts.TaskScheduling._tasks({ group: household })).toMatchObject([
      { ...first, assignee: resident.person }, { ...second, assignee: resident.person },
    ]);

    expect(await save({ ...pattern, days: weeklyDays() })).toMatchObject({ status: 200, body: { freed: [] } });
    expect(await application.concepts.TaskScheduling._tasks({ group: household })).toMatchObject([
      { ...first, assignee: resident.person }, { ...second, assignee: resident.person },
    ]);
    expect((await request("set", { entries: [first] }, owner.cookie)).status).toBe(200);
    expect((await request("set", { entries: [{ ...first, assignee: resident.person }] }, owner.cookie)).status).toBe(409);
    expect(await assign()).toMatchObject({ status: 200, body: { scheduled: [], unassigned: [first] } });
  });

  test("a flexible weekend uses any permitted day and retains the same assignee across a repeat", async () => {
    const { request, owner, resident, chore } = await setup();
    const save = (days: Partial<WeekAvailability>, cookie: string) =>
      request("availability/weekly/set", { days: weeklyDays(days), timeZone: "UTC" }, cookie);
    expect((await save({ Friday: "SOMEWHAT_AVAILABLE" }, owner.cookie)).status).toBe(200);
    expect((await save({ Sunday: "AVAILABLE" }, resident.cookie)).status).toBe(200);

    const first = { start: "2027-03-12T14:00:00.000Z", end: "2027-03-15T04:00:00.000Z" };
    const second = { start: "2027-03-19T13:00:00.000Z", end: "2027-03-22T04:00:00.000Z" };
    function create(windows: object[], flexibleDays: boolean, repeatWeekly = false) {
      return request("tasks/create-batch", {
        chore, windows, flexibleDays, repeatWeekly, batchId: crypto.randomUUID(), timeZone: "America/New_York",
      }, owner.cookie);
    }
    const series = await create([first, second], true, true);
    const specific = await create([{ start: first.start, end: "2027-03-12T15:00:00Z" }], false);
    expect(series.status).toBe(200);
    expect(specific.status).toBe(200);
    const [weekend, nextWeekend] = series.body.tasks;
    const [friday] = specific.body.tasks;
    const slice = { from: "2027-03-13T12:00:00Z", until: "2027-03-13T18:00:00.000Z" };
    expect(await request("schedule", slice, resident.cookie)).toMatchObject({
      status: 200, body: { tasks: [{ ...weekend, flexibleDays: true }] },
    });
    expect(await request("list", slice, owner.cookie)).toMatchObject({
      status: 200, body: { assignments: [{ ...weekend, firstWindowEndsAt: first.end, flexibleDays: true, occurrences: 2 }] },
    });

    expect(await request("weekly", slice, owner.cookie)).toMatchObject({
      status: 200, body: { scheduled: [{ ...weekend, person: resident.person }], unassigned: [] },
    });
    const week = { from: first.start, until: first.end };
    expect(await request("weekly", week, owner.cookie)).toMatchObject({
      status: 200, body: { scheduled: [{ ...friday, person: owner.person }], unassigned: [] },
    });
    const task = (row: { task: string }) => request("task", row, resident.cookie);
    expect(await task(nextWeekend)).toMatchObject({
      status: 200, body: { task: { assignee: resident.person, interval: second, flexibleDays: true } },
    });

    // A deadline at the start of Monday permits work through Sunday only.
    await save({ Monday: "AVAILABLE" }, resident.cookie);
    await save({ Monday: "AVAILABLE" }, owner.cookie);
    const duplicate = await create([first], true);
    expect(duplicate.status).toBe(200);
    expect(await request("weekly", week, owner.cookie)).toMatchObject({
      status: 200, body: { scheduled: [], unassigned: expect.arrayContaining([friday, ...duplicate.body.tasks]) },
    });
  });

  test("creates the whole weekly series once and rejects an invalid series without adding tasks", async () => {
    const { request, owner, resident, application, household, category, chore } = await setup();
    const nextWeek = (hour: number) => new Date(Date.UTC(2027, 0, 11, hour)).toISOString();
    const windows = [interval(2, 3), { start: nextWeek(2), end: nextWeek(3) }];
    const input = { chore, windows, batchId: crypto.randomUUID() };
    expect((await request("tasks/create-batch", input)).status).toBe(401);
    expect((await request("tasks/create-batch", input, resident.cookie)).status).toBe(403);
    expect((await request("tasks/create-batch", { ...input, chore: "missing" }, owner.cookie)).status).toBe(404);
    const invalid = { ...input, windows: [windows[0], { start: nextWeek(3), end: nextWeek(2) }] };
    expect((await request("tasks/create-batch", invalid, owner.cookie)).status).toBe(400);
    const scheduling = application.concepts.TaskScheduling;
    expect(await scheduling._tasks({ group: household })).toEqual([]);

    const create = () => request("tasks/create-batch", input, owner.cookie);
    const [first, retry] = await Promise.all([create(), create()]);
    expect(first.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    const { tasks } = first.body;
    expect(tasks).toHaveLength(2);
    expect(tasks[0].task).not.toBe(tasks[1].task);
    expect(await scheduling._tasks({ group: household })).toMatchObject(windows.map(({ start, end }, index) => ({
      ...tasks[index], item: chore, category, weight: 3, start: new Date(start), end: new Date(end), deadline: new Date(end),
    })));

    // Previously saved weekly batches have dated task IDs and no repeat flag.
    await database().collection<{ _id: string }>("task_scheduling_groups").updateOne(
      { _id: household, "taskBatches.batchId": input.batchId },
      { $unset: { "taskBatches.$.repeatWeekly": "" } },
    );
    expect(await request("list", { from: at(1), until: nextWeek(4) }, owner.cookie)).toMatchObject({
      status: 200, body: { assignments: [{ task: tasks[0].task, weekly: true, occurrences: 2 }] },
    });
  });

  test("counts a weekly series once and keeps one assignee through its open dates", async () => {
    const { request, application, household, owner, resident, chore } = await setup();
    const next = (hour: number) => new Date(Date.UTC(2027, 0, 11, hour)).toISOString();
    const windows = [interval(2, 3), { start: next(2), end: next(3) }];
    const firstWeek = { from: at(1), until: next(1) };
    const secondWeek = { from: next(1), until: next(8) };
    const created = await request("tasks/create-batch", { chore, windows, batchId: crypto.randomUUID(), repeatWeekly: true }, owner.cookie);
    expect(created.status).toBe(200);
    const [first, second] = created.body.tasks.map(({ task }: { task: string }) => task);
    const entireSeries = { from: at(1), until: next(8) };
    expect((await request("list", firstWeek, resident.cookie)).status).toBe(403);
    expect(await request("list", entireSeries, owner.cookie)).toMatchObject({
      status: 200, body: { assignments: [{ task: first, weekly: true, occurrences: 2, remaining: 2, assignee: null }] },
    });

    const availability = (window: object, person: string) => request("availability/add", { person, ...window }, owner.cookie);
    await availability(windows[0], resident.person);
    await availability(windows[1], owner.person);
    const schedule = (window: object) => request("weekly", window, owner.cookie);
    expect(await schedule(entireSeries)).toMatchObject({ status: 200, body: { scheduled: [], unassigned: [{ task: first }] } });
    const added = await availability(windows[1], resident.person);
    expect(await schedule(firstWeek)).toMatchObject({ status: 200, body: { scheduled: [{ task: first, person: resident.person }] } });
    expect(await schedule(secondWeek)).toMatchObject({ status: 200, body: { scheduled: [], unassigned: [] } });

    const tasks = () => application.concepts.TaskScheduling._tasks({ group: household });
    expect((await tasks()).map(task => task.assignee)).toEqual([resident.person, resident.person]);
    expect(await request("availability/remove", { person: resident.person, availability: added.body.availability }, resident.cookie))
      .toMatchObject({ status: 200, body: { freed: [] } });
    expect((await tasks()).map(task => task.assignee)).toEqual([resident.person, resident.person]);

    const assign = (entries: object[]) => request("set", { entries }, owner.cookie);
    expect((await assign([{ task: first, assignee: owner.person }, { task: second, assignee: resident.person }])).status).toBe(400);
    expect((await tasks()).map(task => task.assignee)).toEqual([resident.person, resident.person]);

    await application.concepts.TaskScheduling.complete({ task: first, completedBy: resident.person, completedAt: new Date(at(3)) });
    // A manual assignment commits the whole series even before future availability is entered.
    await request("availability/edit", { windows: [windows[1]], adding: false }, owner.cookie);
    expect((await assign([{ task: second, assignee: owner.person }])).status).toBe(200);
    expect(await tasks()).toMatchObject([
      { task: first, assignee: resident.person, completedBy: resident.person },
      { task: second, assignee: owner.person, source: "MANUAL" },
    ]);
    expect(await request("list", secondWeek, owner.cookie)).toMatchObject({
      status: 200, body: { assignments: [{ task: second, weekly: true, remaining: 1, assignee: owner.person }] },
    });
    expect((await assign([{ task: second }])).status).toBe(200);
    expect((await tasks()).map(task => task.assignee)).toEqual([resident.person, undefined]);
    expect((await request("tasks/delete", { task: second })).status).toBe(401);
    expect((await request("tasks/delete", { task: second }, resident.cookie)).status).toBe(403);
    expect((await request("tasks/delete", { task: second }, owner.cookie)).status).toBe(200);
    expect((await request("tasks/delete", { task: second }, owner.cookie)).status).toBe(200);
    expect(await request("list", entireSeries, owner.cookie)).toMatchObject({ status: 200, body: { assignments: [] } });
    expect(await request("schedule", entireSeries, resident.cookie)).toMatchObject({ status: 200, body: { tasks: [] } });
    expect(await tasks()).toMatchObject([{ task: first, completedBy: resident.person }, { task: second }]);
  });

  test("runs manual, automatic and weekly scheduling and serves household and personal reads", async () => {
    const { request, invoke, createTask, owner, resident, outsider, application, household, chore } = await setup();
    expect((await request("availability/add", { person: resident.person, ...interval(1, 8) }, owner.cookie)).status).toBe(200);
    const manual = await createTask({ interval: interval(2, 3) });
    const automatic = await createTask({ interval: interval(3, 4) });
    const unavailable = await createTask({ interval: interval(9, 10) });
    const entries = [{ task: manual, assignee: resident.person }];
    expect(await invoke("set", { entries: [...entries, { task: automatic, assignee: outsider.person }] }))
      .toMatchObject({ ok: false, error: { value: "NOT_FOUND" } });
    expect((await application.concepts.TaskScheduling._get({ task: manual }))[0].assignee).toBeUndefined();
    expect((await request("set", { entries }, owner.cookie)).status).toBe(200);
    const window = { from: at(1), until: at(12) };
    expect((await request("weekly", window, resident.cookie)).status).toBe(403);
    expect(await request("weekly", window, owner.cookie)).toMatchObject({
      status: 200, body: { scheduled: [{ task: automatic, person: resident.person }], unassigned: [{ task: unavailable }] },
    });
    expect(await request("weekly", window, owner.cookie)).toMatchObject({ status: 200, body: { scheduled: [] } });
    expect(await request("reset", window, owner.cookie)).toMatchObject({ status: 200, body: { cleared: [{ task: automatic }] } });
    expect(await request("auto-schedule", { ...window, onlyUnassigned: false }, owner.cookie))
      .toMatchObject({ status: 200, body: { scheduled: [{ task: automatic, person: resident.person }] } });
    expect(await request("schedule", window, resident.cookie)).toMatchObject({ status: 200, body: { tasks: [
      { task: manual, source: "MANUAL", chore: { name: "Dishes" }, categoryName: "Kitchen" },
      { task: automatic, source: "AUTO" }, { task: unavailable },
    ] } });
    expect(await request("mine", { ...window, mode: "assigned" }, resident.cookie)).toMatchObject({
      status: 200, body: { tasks: [{ task: manual }, { task: automatic }] },
    });
    expect((await request("schedule", window, outsider.cookie)).status).toBe(403);
    expect(await invoke("schedule", { from: at(12), until: at(1) }))
      .toMatchObject({ ok: false, error: { value: "SCHEDULE_WINDOW_INVALID" } });
    await application.concepts.TaskScheduling.complete({ task: automatic, completedBy: resident.person, completedAt: new Date(at(5)) });
    expect(await request("mine", { ...window, mode: "completed" }, resident.cookie)).toMatchObject({
      status: 200, body: { tasks: [{ task: automatic, status: "COMPLETED_LATE" }] },
    });
    expect(await request("total", { person: resident.person }, owner.cookie)).toMatchObject({ status: 200, body: { workload: 6 } });
    expect((await request("availability", { person: owner.person }, resident.cookie)).status).toBe(403);
    expect(await request("availability", { person: resident.person }, resident.cookie)).toMatchObject({ status: 200, body: {
      availability: [{ interval: interval(1, 8) }],
    } });
    expect((await request("overview", {}, resident.cookie)).status).toBe(403);
    expect(await request("overview", {}, owner.cookie)).toMatchObject({ status: 200, body: { residents: [
      { person: owner.person, workload: 0 }, { person: resident.person, workload: 6 },
    ] } });
    expect(await application.concepts.ChoreCataloguing.remove({ group: household, chore }))
      .toMatchObject({ chore, group: household });
    expect(await request("schedule", window, resident.cookie)).toMatchObject({
      status: 200, body: { tasks: [{ task: manual, item: chore, weight: 3 }, { task: automatic }, { task: unavailable }] },
    });
    expect((await request("swaps/propose", {}, resident.cookie)).status).toBe(404);
    expect(await application.concepts.TaskScheduling._tasks({ group: household })).toHaveLength(3);
  });

  test("runs the Alpha household-to-cleanup workflow using the signed-in session", async () => {
    const { post, request, createTask, owner, resident, household, category, application } = await setup();
    const target = { person: resident.person };
    const window = { from: at(1), until: at(8) };
    expect((await post("/households/preferences/set", {
      household, ...target, category, preferenceLevel: "PREFER",
    }, resident.cookie)).status).toBe(200);
    expect((await post("/households/preferences/set", {
      household, person: owner.person, category, preferenceLevel: "AVOID",
    }, owner.cookie)).status).toBe(200);
    for (const { person, cookie } of [owner, resident]) {
      expect((await request("availability/add", { person, ...interval(1, 8) }, cookie)).status).toBe(200);
    }

    const task = await createTask({ interval: interval(2, 3) });
    expect(await request("auto-schedule", { ...window, onlyUnassigned: true }, owner.cookie)).toMatchObject({
      status: 200, body: { scheduled: [{ task, ...target }] },
    });
    expect((await request("set", { entries: [{ task, assignee: owner.person }] }, owner.cookie)).status).toBe(200);
    expect(await request("schedule", window, resident.cookie)).toMatchObject({
      status: 200, body: { tasks: [{ task, assignee: owner.person, source: "MANUAL" }] },
    });
    expect((await request("set", { entries: [{ task, assignee: resident.person }] }, owner.cookie)).status).toBe(200);
    expect(await request("mine", window, resident.cookie)).toMatchObject({ status: 200, body: { tasks: [{ task }] } });

    expect((await post("/households/residents/remove", { household, ...target }, owner.cookie)).status).toBe(200);
    await application.whenIdle();
    expect(await request("schedule", window, owner.cookie)).toMatchObject({
      status: 200, body: { tasks: [{ task, assignee: null, source: null }] },
    });
    expect((await request("schedule", window, resident.cookie)).status).toBe(403);
    expect(await application.concepts.TaskScheduling._availability({ group: household, ...target })).toEqual([]);
    expect(await application.concepts.TaskScheduling._workload({ group: household, ...target })).toEqual({ workload: 0 });
  });

  test("can retry scheduling cleanup after a failed reaction without restoring the residency", async () => {
    const cleanup = spyOn(TaskSchedulingConcept.prototype, "removePerson").mockImplementationOnce(async () => {
      throw new Error("Injected cleanup write failure");
    });
    try {
      const { request, post, createTask, owner, resident, household, application } = await setup();
      const target = { person: resident.person };
      expect((await request("availability/add", { ...target, ...interval(1, 8) }, owner.cookie)).status).toBe(200);
      const task = await createTask({ interval: interval(2, 3) });
      expect((await request("set", { entries: [{ task, assignee: resident.person }] }, owner.cookie)).status).toBe(200);
      const removal = await post("/households/residents/remove", { household, ...target }, owner.cookie);
      await application.whenIdle();
      expect(removal).toMatchObject({ status: 500, body: { error: "INTERNAL_ERROR" } });
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(await application.concepts.HouseholdManaging._residents({ household })).toEqual([{ person: owner.person }]);
      expect(await application.concepts.TaskScheduling._availability({ group: household, ...target })).toHaveLength(1);
      expect(await request("residents/cleanup", target, owner.cookie)).toMatchObject({
        status: 200, body: { freed: [{ task }] },
      });
      expect(await application.concepts.TaskScheduling._availability({ group: household, ...target })).toEqual([]);
      expect(await application.concepts.TaskScheduling._workload({ group: household, ...target })).toEqual({ workload: 0 });
    } finally {
      cleanup.mockRestore();
    }
  });

  test("cleans up after successful resident removal and supports safe, repeatable retry", async () => {
    const { request, post, createTask, owner, resident, household, application } = await setup();
    const key = { household, person: resident.person };
    await request("availability/add", { person: resident.person, ...interval(1, 8) }, owner.cookie);
    const open = await createTask({ interval: interval(2, 3) });
    const done = await createTask({ interval: interval(3, 4) });
    await request("set", { entries: [open, done].map((task) => ({ task, assignee: resident.person })) }, owner.cookie);
    await application.concepts.TaskScheduling.complete({ task: done, completedBy: resident.person, completedAt: new Date(at(4)) });
    expect((await request("residents/cleanup", { person: resident.person }, owner.cookie)).status).toBe(409);
    expect((await post("/households/residents/remove", key, resident.cookie)).status).toBe(200);
    await application.whenIdle();
    expect(await application.concepts.TaskScheduling._availability({ group: household, person: resident.person })).toEqual([]);
    expect((await application.concepts.TaskScheduling._get({ task: open }))[0].assignee).toBeUndefined();
    expect((await application.concepts.TaskScheduling._get({ task: done }))[0])
      .toMatchObject({ assignee: resident.person, completedBy: resident.person });
    // Simulate state left by an interrupted cleanup, then retry through the authorized endpoint.
    await application.concepts.TaskScheduling.addAvailability({ group: household, person: resident.person, start: new Date(at(1)), end: new Date(at(8)) });
    expect((await request("residents/cleanup", { person: resident.person }, resident.cookie)).status).toBe(403);
    expect((await request("residents/cleanup", { person: resident.person }, owner.cookie)).status).toBe(200);
    expect(await request("residents/cleanup", { person: resident.person }, owner.cookie)).toMatchObject({ status: 200, body: { freed: [] } });
    expect(await application.concepts.TaskScheduling._availability({ group: household, person: resident.person })).toEqual([]);
  });
});
