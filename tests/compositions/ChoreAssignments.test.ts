import { describe, expect, spyOn, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../../src/assembly.ts";
import { policy } from "../../src/http.ts";
import { TaskSchedulingConcept } from "../../src/concepts/TaskScheduling/TaskScheduling.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("chore_assignments");
const at = (hour: number) => new Date(Date.UTC(2027, 0, 4, hour)).toISOString();
const interval = (start: number, end: number) => ({ start: at(start), end: at(end) });

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
      // This request deliberately faults after the residency write has succeeded.
      const error = console.error.bind(console);
      const warn = console.warn.bind(console);
      const faultLog = spyOn(console, "error").mockImplementation((...args) => {
        if (!String(args[0]).includes('"message":"Consequence action faulted"')
          || !String(args[0]).includes('"action":"removePerson"')) error(...args);
      });
      const lateReplyLog = spyOn(console, "warn").mockImplementation((...args) => {
        if (!String(args[0]).includes("HouseholdManagement.RemoveResident:removed")
          || !String(args[0]).includes("after it stopped pending")) warn(...args);
      });
      const removal = await (async () => {
        try {
          return await post("/households/residents/remove", { household, ...target }, owner.cookie);
        } finally {
          try {
            await application.whenIdle();
          } finally {
            faultLog.mockRestore();
            lateReplyLog.mockRestore();
          }
        }
      })();
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
