import { describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  TaskSchedulingConcept, TaskNotFound, TaskWeightInvalid, TaskIntervalInvalid,
  TaskStatusConflict, AvailabilityNotFound, PersonNotAvailable, ScheduleEntriesInvalid,
  ScheduleWindowInvalid, PreferencesInvalid, CompletionTimeInvalid,
} from "../../src/concepts/TaskScheduling/TaskScheduling.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("scheduling");
const at = (hour: number) => new Date(Date.UTC(2026, 0, 1, hour));
const interval = (start: number, end: number) => ({ start: at(start), end: at(end) });
const definition = { item: "chore", category: "kitchen", weight: 3 };

describe("TaskScheduling task lifecycle", () => {
  test("stores snapshot fields, updates timing, and removes tasks", async () => {
    const concept = new TaskSchedulingConcept(database);
    const { task } = await concept.add({ group: "lifecycle", ...definition, interval: interval(2, 4) });
    expect(await concept._get({ task })).toEqual([{
      group: "lifecycle", ...definition, interval: interval(2, 4), deadline: at(4),
    }]);
    await expect(concept.updateDeadline({ task, deadline: at(3) })).rejects.toBeInstanceOf(TaskIntervalInvalid);
    await concept.updateDeadline({ task, deadline: at(6) });
    await expect(concept.updateInterval({ task, interval: interval(4, 7) })).rejects.toBeInstanceOf(TaskIntervalInvalid);
    await concept.updateInterval({ task, interval: interval(4, 6) });
    await concept.updateDeadline({ task });
    await expect(concept.updateInterval({ task })).rejects.toBeInstanceOf(TaskIntervalInvalid);
    expect(await concept.remove({ task })).toEqual({ task });
    expect(await concept._get({ task })).toEqual([]);
    await expect(concept.remove({ task })).rejects.toBeInstanceOf(TaskNotFound);
  });

  test("refuses bad weights, invalid dates, and missing or incompatible timings", async () => {
    const concept = new TaskSchedulingConcept(database);
    const input = { group: "invalid", ...definition };
    for (const weight of [NaN, Infinity, 0.9, 10.1]) {
      await expect(concept.add({ ...input, weight, deadline: at(8) })).rejects.toBeInstanceOf(TaskWeightInvalid);
    }
    for (const timing of [{}, { interval: interval(4, 4) }, { deadline: new Date(NaN) },
      { interval: interval(4, 6), deadline: at(5) }]) {
      await expect(concept.add({ ...input, ...timing })).rejects.toBeInstanceOf(TaskIntervalInvalid);
    }
    await expect(concept.updateInterval({ task: "missing" })).rejects.toBeInstanceOf(TaskNotFound);
    expect(await concept._tasks({ group: input.group })).toEqual([]);
  });

  test("allows only one of concurrent removal and completion to succeed", async () => {
    const first = new TaskSchedulingConcept(database);
    const second = new TaskSchedulingConcept(database);
    const { task } = await first.add({ group: "completion-race", ...definition, deadline: at(8) });
    const [removal, completion] = await Promise.allSettled([
      first.remove({ task }),
      second.complete({ task, completedBy: "alice", completedAt: at(7) }),
    ]);
    if (completion.status === "fulfilled") {
      expect(removal.status).toBe("rejected");
      if (removal.status === "rejected") expect(removal.reason).toBeInstanceOf(TaskStatusConflict);
      expect(await first._get({ task })).toMatchObject([{ completedBy: "alice", completedAt: at(7) }]);
    } else {
      expect(completion.reason).toBeInstanceOf(TaskNotFound);
      expect(removal.status).toBe("fulfilled");
      expect(await first._get({ task })).toEqual([]);
    }
  });

  test("reads task windows and derives status with boundary and completion queries", async () => {
    const group = "status";
    const concept = new TaskSchedulingConcept(database, () => at(8));
    const { task: late } = await concept.add({ group, ...definition, interval: interval(2, 3), deadline: at(6) });
    const { task: onTime } = await concept.add({ group, ...definition, deadline: at(9) });
    const { task: overdue } = await concept.add({ group, ...definition, deadline: at(7) });
    const { task: due } = await concept.add({ group, ...definition, deadline: at(8) });
    expect(await concept.complete({ task: late, completedBy: "alice", completedAt: at(4) }))
      .toEqual({ task: late, completedBy: "alice", completedAt: at(4) });
    await concept.complete({ task: onTime, completedBy: "alice", completedAt: at(9) });
    expect(await concept._completionContext({ task: late })).toEqual([
      { group, item: definition.item, dueAt: at(6), completion: "COMPLETED", interval: interval(2, 3) },
    ]);
    expect(await concept._completionContext({ task: overdue })).toEqual([
      { group, item: definition.item, dueAt: at(7), completion: "INCOMPLETE" },
    ]);
    expect(await concept._status({ task: late, asOf: at(2) })).toEqual([{ status: "COMPLETED_LATE" }]);
    expect(await concept._status({ task: overdue, asOf: at(7) })).toEqual([{ status: "PENDING" }]);
    expect(await concept._status({ task: overdue, asOf: at(8) })).toEqual([{ status: "OVERDUE" }]);
    expect(await concept._incomplete({ task: overdue })).toEqual([{ group }]);
    expect((await concept._tasks({ group })).map(({ task }) => task)).toEqual([late, overdue, due, onTime]);
    expect((await concept._schedule({ group, from: at(6), until: at(8) })).map(({ task }) => task))
      .toEqual([late, overdue]);
    expect((await concept._pending({ group, asOf: at(6) })).map(({ task, status }) => ({ task, status })))
      .toEqual([{ task: overdue, status: "OVERDUE" }, { task: due, status: "PENDING" }]);
    expect((await concept._completed({ group, asOf: at(3) })).map(({ status }) => status))
      .toEqual(["COMPLETED_LATE", "COMPLETED"]);
    expect((await concept._completedByPerson({ group, person: "alice" })).map(({ task }) => task))
      .toEqual([late, onTime]);
    expect((await concept._completedInInterval({ group, from: at(4), until: at(9) })).map(({ task }) => task))
      .toEqual([late]);
    await expect(concept.updateDeadline({ task: late })).rejects.toBeInstanceOf(TaskStatusConflict);
    await expect(concept.updateInterval({ task: late })).rejects.toBeInstanceOf(TaskStatusConflict);
    await expect(concept.complete({ task: late, completedBy: "alice", completedAt: at(5) }))
      .rejects.toBeInstanceOf(TaskStatusConflict);
    await expect(concept.complete({ task: due, completedBy: "alice", completedAt: new Date(NaN) }))
      .rejects.toBeInstanceOf(CompletionTimeInvalid);
    expect(await concept.uncomplete({ task: late }))
      .toEqual({ task: late, lastCompletedBy: "alice", lastCompletedAt: at(4) });
    await expect(concept.uncomplete({ task: late })).rejects.toBeInstanceOf(TaskStatusConflict);
    await concept.archiveAssignment({ group, task: overdue });
    expect(await concept._incomplete({ task: overdue })).toEqual([]);
    expect(await concept._completionContext({ task: overdue })).toMatchObject([{ archived: true }]);
  });
});

describe("TaskScheduling availability and manual scheduling", () => {
  test("joins touching availability intervals and clears only affected incomplete assignments", async () => {
    const group = "availability";
    const person = "alice";
    const concept = new TaskSchedulingConcept(database);
    await expect(concept.addAvailability({ group, person, ...interval(1, 1) })).rejects.toBeInstanceOf(TaskIntervalInvalid);
    const { availability: right } = await concept.addAvailability({ group, person, ...interval(3, 5) });
    const { availability: left } = await concept.addAvailability({ group, person, ...interval(1, 3) });
    expect(await concept._availability({ group, person })).toEqual([
      { availability: left, interval: interval(1, 3) }, { availability: right, interval: interval(3, 5) },
    ]);
    const { task } = await concept.add({ group, ...definition, interval: interval(2, 4) });
    const { task: done } = await concept.add({ group, ...definition, interval: interval(2, 4) });
    const { task: stillCovered } = await concept.add({ group, ...definition, interval: interval(3, 4) });
    await concept.setSchedule({ group, entries: [task, done, stillCovered].map((task) => ({ task, assignee: person })) });
    await concept.complete({ task: done, completedBy: person, completedAt: at(4) });
    expect(await concept.removeAvailability({ availability: left })).toEqual({ freed: [{ task }] });
    await expect(concept.removeAvailability({ availability: left })).rejects.toBeInstanceOf(AvailabilityNotFound);
    expect(await concept.removePerson({ group, person })).toEqual({ freed: [{ task: stillCovered }] });
    expect(await concept.removePerson({ group, person })).toEqual({ freed: [] });
    expect(await concept._availability({ group, person })).toEqual([]);
    expect((await concept._get({ task: done }))[0]).toMatchObject({ completedBy: person, assignee: person, source: "MANUAL" });
    expect(await concept._workload({ group, person })).toEqual({ workload: 3 });
    await concept.uncomplete({ task: done });
    expect((await concept._get({ task: done }))[0].assignee).toBeUndefined();
    expect(await concept._workload({ group, person })).toEqual({ workload: 0 });
  });

  test("refuses a whole batch and supports manual reassignments and unassignment", async () => {
    const concept = new TaskSchedulingConcept(database);
    const group = "manual";
    await concept.addAvailability({ group, person: "alice", ...interval(1, 5) });
    await concept.addAvailability({ group, person: "bob", ...interval(1, 4) });
    const { task } = await concept.add({ group, ...definition, interval: interval(2, 3), deadline: at(6) });
    const { task: other } = await concept.add({ group, ...definition, interval: interval(4, 5) });
    const { task: unscheduled } = await concept.add({ group, ...definition, deadline: at(6) });
    const first = { task, assignee: "alice" };
    await expect(concept.setSchedule({ group, entries: [first, { task: other, assignee: "bob" }] }))
      .rejects.toBeInstanceOf(PersonNotAvailable);
    await expect(concept.setSchedule({ group, entries: [first, { task: "missing" }] }))
      .rejects.toBeInstanceOf(TaskNotFound);
    await expect(concept.setSchedule({ group, entries: [first, { task: unscheduled }] }))
      .rejects.toBeInstanceOf(TaskIntervalInvalid);
    await expect(concept.setSchedule({ group, entries: [first, { task, assignee: "bob" }] }))
      .rejects.toBeInstanceOf(ScheduleEntriesInvalid);
    expect((await concept._get({ task }))[0].assignee).toBeUndefined();
    expect(await concept.setSchedule({ group, entries: [first] })).toEqual({ entries: [first] });
    await concept.setSchedule({ group, entries: [{ task, assignee: "bob" }] });
    expect((await concept._get({ task }))[0]).toMatchObject({ assignee: "bob", source: "MANUAL" });
    await concept.updateInterval({ task, interval: interval(4, 5) });
    expect((await concept._get({ task }))[0].source).toBeUndefined();
    await concept.setSchedule({ group, entries: [first] });
    expect(await concept.setSchedule({ group, entries: [{ task }] })).toEqual({ entries: [{ task }] });
    await concept.setSchedule({ group, entries: [first] });
    await concept.updateInterval({ task });
    expect((await concept._get({ task }))[0].assignee).toBeUndefined();
    await concept.complete({ task: other, completedBy: "alice", completedAt: at(5) });
    await expect(concept.setSchedule({ group, entries: [{ task: other }] })).rejects.toBeInstanceOf(TaskStatusConflict);
  });
});

describe("TaskScheduling automatic scheduling", () => {
  test("balances workload with preferences, preserves manual and completed work, and resets automatic work", async () => {
    const concept = new TaskSchedulingConcept(database);
    const group = "automatic";
    const people = [{ person: "alice" }, { person: "bob" }];
    for (const { person } of people) await concept.addAvailability({ group, person, ...interval(0, 10) });
    const manual = (await concept.add({ group, ...definition, weight: 4, interval: interval(0, 1) })).task;
    await concept.setSchedule({ group, entries: [{ task: manual, assignee: "alice" }] });
    const first = (await concept.add({ group, ...definition, interval: interval(1, 2) })).task;
    const second = (await concept.add({ group, ...definition, interval: interval(2, 3) })).task;
    const unavailable = (await concept.add({ group, ...definition, interval: interval(11, 12) })).task;
    await concept.add({ group, ...definition, deadline: at(4) });
    const input = { group, people, from: at(0), until: at(12), preferences: [
      { person: "alice", category: definition.category, preferenceLevel: "PREFER" as const },
      { person: "bob", category: definition.category, preferenceLevel: "NEUTRAL" as const },
    ] };
    expect(await concept.autoSchedule({ ...input, onlyUnassigned: true })).toEqual({
      scheduled: [{ task: first, person: "bob" }, { task: second, person: "alice" }],
      unassigned: [{ task: unavailable }],
    });
    expect(await concept._workload({ group, person: "bob" })).toEqual({ workload: 3 });
    expect(await concept.autoSchedule({ ...input, onlyUnassigned: true }))
      .toEqual({ scheduled: [], unassigned: [{ task: unavailable }] });
    await concept.complete({ task: first, completedBy: "bob", completedAt: at(2) });
    const rerun = await concept.autoSchedule({ ...input, people: [{ person: "alice" }], preferences: [], onlyUnassigned: false });
    expect(rerun).toEqual({ scheduled: [{ task: second, person: "alice" }], unassigned: [{ task: unavailable }] });
    expect(await concept.reset(input)).toEqual({ cleared: [{ task: second }] });
    expect((await concept._get({ task: first }))[0]).toMatchObject({ assignee: "bob", source: "AUTO" });
    expect((await concept._get({ task: manual }))[0]).toMatchObject({ assignee: "alice", source: "MANUAL" });
    await expect(concept.reset({ ...input, until: at(0) })).rejects.toBeInstanceOf(ScheduleWindowInvalid);
    await expect(concept.autoSchedule({ ...input, from: at(12), onlyUnassigned: false }))
      .rejects.toBeInstanceOf(ScheduleWindowInvalid);
    await expect(concept.autoSchedule({ ...input, people: [], onlyUnassigned: false }))
      .rejects.toBeInstanceOf(PreferencesInvalid);
    await expect(concept.autoSchedule({
      ...input, preferences: [...input.preferences, { ...input.preferences[0], preferenceLevel: "AVOID" }],
      onlyUnassigned: false,
    })).rejects.toBeInstanceOf(PreferencesInvalid);
  });

  test("persists concurrent writes and never leaves an assignment unsupported by availability", async () => {
    const first = new TaskSchedulingConcept(database);
    const second = new TaskSchedulingConcept(database);
    const group = "concurrent";
    const [{ task }, { availability }] = await Promise.all([
      first.add({ group, ...definition, interval: interval(2, 3) }),
      second.addAvailability({ group, person: "alice", ...interval(1, 4) }),
    ]);
    const [assignment, removal] = await Promise.allSettled([
      first.setSchedule({ group, entries: [{ task, assignee: "alice" }] }),
      second.removeAvailability({ availability }),
    ]);
    expect(removal.status).toBe("fulfilled");
    if (assignment.status === "rejected") expect(assignment.reason).toBeInstanceOf(PersonNotAvailable);
    const client = new MongoClient(process.env.MONGODB_URI!);
    try {
      const reader = new TaskSchedulingConcept(() => client.db(database().databaseName));
      expect(await reader._availability({ group, person: "alice" })).toEqual([]);
      const [state] = await reader._get({ task });
      expect(state.interval).toEqual(interval(2, 3));
      expect(state.assignee).toBeUndefined();
      expect(await reader._workload({ group, person: "alice" })).toEqual({ workload: 0 });
    } finally {
      await client.close();
    }
  });
});
