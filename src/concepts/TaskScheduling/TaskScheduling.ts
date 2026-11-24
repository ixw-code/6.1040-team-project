import { MongoServerError, type Db } from "mongodb";

export class TaskNotFound extends Error {}
export class TaskWeightInvalid extends Error {}
export class TaskIntervalInvalid extends Error {}
export class TaskStatusConflict extends Error {}
export class AvailabilityNotFound extends Error {}
export class PersonNotAvailable extends Error {}
export class ScheduleEntriesInvalid extends Error {}
export class ScheduleWindowInvalid extends Error {}
export class PreferencesInvalid extends Error {}
export class CompletionTimeInvalid extends Error {}

type Interval = { start: Date; end: Date };
type Source = "AUTO" | "MANUAL";
type Status = "PENDING" | "OVERDUE" | "COMPLETED" | "COMPLETED_LATE";
type PreferenceLevel = "PREFER" | "NEUTRAL" | "AVOID";
type TaskRef = { task: string };
type GroupRef = { group: string };
type PersonRef = { person: string };
type AvailabilityRef = { availability: string };
type Window = { from: Date; until: Date };
type ScheduleEntry = TaskRef & { assignee?: string };
type Preference = PersonRef & { category: string; preferenceLevel: PreferenceLevel };
type Completion = { completedBy: string; completedAt: Date };
type TaskDefinition = {
  item: string;
  category: string;
  weight: number;
  deadline?: Date;
  interval?: Interval;
};
type Task = TaskRef & TaskDefinition & Partial<Completion> & { assignee?: string; source?: Source };
type TaskRow = Omit<Task, "interval"> & { start?: Date; end?: Date };
type Availability = AvailabilityRef & PersonRef & { interval: Interval };
type GroupState = { _id: string; version: number; tasks: Task[]; availabilities: Availability[] };

const taskMissing = "This task doesn't exist in the schedule.";
const availabilityMissing = "There is no such availability.";
const costMultiplier: Record<PreferenceLevel, number> = { PREFER: 0.5, NEUTRAL: 1, AVOID: 2 };

function validDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validInterval(start: Date, end: Date): boolean {
  return validDate(start) && validDate(end) && start < end;
}

function validTiming(deadline?: Date, interval?: Interval): boolean {
  return (deadline !== undefined || interval !== undefined)
    && (deadline === undefined || validDate(deadline))
    && (interval === undefined || (validInterval(interval.start, interval.end)
      && (deadline === undefined || interval.end <= deadline)));
}

function requireWindow({ from, until }: Window): void {
  if (!validInterval(from, until)) throw new ScheduleWindowInvalid("The period must end after it starts.");
}

function clearAssignment(task: Task): void {
  delete task.assignee;
  delete task.source;
}

function isCompleted<T extends Partial<Completion>>(task: T): task is T & Completion {
  return task.completedAt !== undefined && task.completedBy !== undefined;
}

function availableFor(state: GroupState, person: string, interval: Interval): boolean {
  const windows = state.availabilities.filter((entry) => entry.person === person)
    .sort((a, b) => a.interval.start.getTime() - b.interval.start.getTime());
  let coveredUntil = interval.start;
  for (const window of windows) {
    if (window.interval.start > coveredUntil) break;
    if (window.interval.end > coveredUntil) coveredUntil = window.interval.end;
    if (coveredUntil >= interval.end) return true;
  }
  return false;
}

function clearAssignments(tasks: Task[], matches: (task: Task) => boolean): TaskRef[] {
  const cleared: TaskRef[] = [];
  for (const task of tasks) {
    if (task.assignee !== undefined && !isCompleted(task) && matches(task)) {
      clearAssignment(task);
      cleared.push({ task: task.task });
    }
  }
  return cleared;
}

function workloadByPerson(tasks: Task[]): Map<string, number> {
  const workloads = new Map<string, number>();
  for (const { assignee, weight } of tasks) {
    if (assignee !== undefined) workloads.set(assignee, (workloads.get(assignee) ?? 0) + weight);
  }
  return workloads;
}

// Timing validation guarantees that at least one of the interval and deadline exists.
function taskStart(task: Task): Date {
  return task.interval?.start ?? task.deadline!;
}

function statusAt(task: Pick<Task, "interval" | "deadline" | "completedAt">, now: Date): Status {
  const cutoff = task.interval?.end ?? task.deadline!;
  if (task.completedAt) return task.completedAt > cutoff ? "COMPLETED_LATE" : "COMPLETED";
  return now > cutoff ? "OVERDUE" : "PENDING";
}

function taskOrder(a: Task, b: Task): number {
  return taskStart(a).getTime() - taskStart(b).getTime() || a.task.localeCompare(b.task);
}

function completionOrder(a: Task & Completion, b: Task & Completion): number {
  return a.completedAt.getTime() - b.completedAt.getTime() || a.task.localeCompare(b.task);
}

function inWindow(value: Date | undefined, { from, until }: Window): boolean {
  return value !== undefined && value >= from && value < until;
}

function taskRow({ interval, ...task }: Task): TaskRow {
  return interval ? { ...task, start: interval.start, end: interval.end } : task;
}

export class TaskSchedulingConcept {
  constructor(private readonly getDb: () => Db, private readonly now = () => new Date()) {}

  #groups() {
    return this.getDb().collection<GroupState>("task_scheduling_groups");
  }

  // Match the version read so all changes in a group, including multi-task batches,
  // commit together. A competing writer causes validation to run again on fresh state.
  async #update<Result>(group: string, change: (state: GroupState) => Result, create = false): Promise<Result> {
    const groups = this.#groups();
    while (true) {
      const existing = await groups.findOne({ _id: group });
      const state = existing ?? { _id: group, version: 0, tasks: [], availabilities: [] };
      const version = state.version;
      const result = change(state);
      if (!existing) {
        if (!create) return result;
        try {
          await groups.insertOne(state);
          return result;
        } catch (error) {
          if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
          continue;
        }
      }
      state.version += 1;
      const write = await groups.replaceOne({ _id: group, version }, state);
      if (write.matchedCount === 1) return result;
    }
  }

  async #updateTask<Result>(task: string, change: (entry: Task, state: GroupState) => Result): Promise<Result> {
    const group = await this.#groups().findOne({ "tasks.task": task }, { projection: { _id: 1 } });
    if (!group) throw new TaskNotFound(taskMissing);
    return this.#update(group._id, (state) => {
      const entry = state.tasks.find((candidate) => candidate.task === task);
      if (!entry) throw new TaskNotFound(taskMissing);
      return change(entry, state);
    });
  }

  async #tasks(group: string): Promise<Task[]> {
    const state = await this.#groups().findOne({ _id: group }, { projection: { tasks: 1 } });
    return state?.tasks ?? [];
  }

  async add({ group, item, category, weight, deadline, interval }: GroupRef & TaskDefinition): Promise<TaskRef> {
    if (!Number.isFinite(weight) || weight < 1 || weight > 10) {
      throw new TaskWeightInvalid("Task weight must be between 1 and 10.");
    }
    if (!validTiming(deadline, interval)) {
      throw new TaskIntervalInvalid("Provide a deadline or a valid interval that ends by the deadline when both are given.");
    }
    const task = crypto.randomUUID();
    const due = deadline ?? interval!.end;
    return this.#update(group, (state) => {
      state.tasks.push({ task, item, category, weight, deadline: due, ...(interval && { interval }) });
      return { task };
    }, true);
  }

  async remove({ task }: TaskRef): Promise<TaskRef> {
    return this.#updateTask(task, (entry, state) => {
      if (isCompleted(entry)) throw new TaskStatusConflict("A completed task cannot be removed.");
      state.tasks.splice(state.tasks.indexOf(entry), 1);
      return { task };
    });
  }

  async updateDeadline({ task, deadline }: TaskRef & { deadline?: Date }): Promise<TaskRef> {
    return this.#updateTask(task, (entry) => {
      if (isCompleted(entry)) throw new TaskStatusConflict("A completed task's deadline cannot be changed.");
      if (!validTiming(deadline, entry.interval)) {
        throw new TaskIntervalInvalid("A task needs a deadline or an interval, and the deadline cannot precede the interval end.");
      }
      if (deadline === undefined) delete entry.deadline;
      else entry.deadline = deadline;
      return { task };
    });
  }

  async updateInterval({ task, interval }: TaskRef & { interval?: Interval }): Promise<TaskRef> {
    return this.#updateTask(task, (entry, state) => {
      if (isCompleted(entry)) throw new TaskStatusConflict("A completed task cannot be rescheduled.");
      if (!validTiming(entry.deadline, interval)) {
        throw new TaskIntervalInvalid("Provide a valid interval that ends by the deadline, or keep a deadline when clearing the interval.");
      }
      if (interval === undefined) {
        delete entry.interval;
        clearAssignment(entry);
      } else {
        entry.interval = interval;
        if (entry.assignee !== undefined && !availableFor(state, entry.assignee, interval)) clearAssignment(entry);
      }
      return { task };
    });
  }

  async addAvailability({ group, person, start, end }: GroupRef & PersonRef & Interval): Promise<AvailabilityRef> {
    if (!validInterval(start, end)) throw new TaskIntervalInvalid("Availability interval must end after it starts.");
    const availability = crypto.randomUUID();
    return this.#update(group, (state) => {
      state.availabilities.push({ availability, person, interval: { start, end } });
      return { availability };
    }, true);
  }

  async removeAvailability({ availability }: AvailabilityRef): Promise<{ freed: TaskRef[] }> {
    const group = await this.#groups().findOne({ "availabilities.availability": availability }, { projection: { _id: 1 } });
    if (!group) throw new AvailabilityNotFound(availabilityMissing);
    return this.#update(group._id, (state) => {
      const index = state.availabilities.findIndex((entry) => entry.availability === availability);
      if (index < 0) throw new AvailabilityNotFound(availabilityMissing);
      const [{ person }] = state.availabilities.splice(index, 1);
      return { freed: clearAssignments(state.tasks, (task) =>
        task.assignee === person && !availableFor(state, person, task.interval!),
      ) };
    });
  }

  async removePerson({ group, person }: GroupRef & PersonRef): Promise<{ freed: TaskRef[] }> {
    return this.#update(group, (state) => {
      state.availabilities = state.availabilities.filter((entry) => entry.person !== person);
      return { freed: clearAssignments(state.tasks, (task) => task.assignee === person) };
    });
  }

  async setSchedule({ group, entries }: GroupRef & { entries: ScheduleEntry[] }): Promise<{ entries: ScheduleEntry[] }> {
    return this.#update(group, (state) => {
      const tasks = new Map(state.tasks.map((task) => [task.task, task]));
      const selected = new Map<Task, string | undefined>();
      for (const entry of entries) {
        const task = tasks.get(entry.task);
        if (!task) throw new TaskNotFound("One of these tasks is not on this schedule.");
        if (isCompleted(task)) throw new TaskStatusConflict("A completed task cannot be reassigned.");
        if (!task.interval) throw new TaskIntervalInvalid("Task must have a scheduled interval before assignment.");
        if (selected.has(task) && selected.get(task) !== entry.assignee) {
          throw new ScheduleEntriesInvalid("A task cannot have conflicting assignments in one batch.");
        }
        if (entry.assignee !== undefined && !availableFor(state, entry.assignee, task.interval)) {
          throw new PersonNotAvailable("An assignee is not available for this task.");
        }
        selected.set(task, entry.assignee);
      }
      for (const [task, assignee] of selected) {
        if (assignee === undefined) clearAssignment(task);
        else {
          task.assignee = assignee;
          task.source = "MANUAL";
        }
      }
      return { entries };
    });
  }

  async autoSchedule({ group, from, until, people, preferences, onlyUnassigned }: GroupRef & Window & {
    people: PersonRef[];
    preferences: Preference[];
    onlyUnassigned: boolean;
  }): Promise<{ scheduled: (TaskRef & PersonRef)[]; unassigned: TaskRef[] }> {
    const window = { from, until };
    requireWindow(window);
    const candidates = new Map(people.map(({ person }) => [person, new Map<string, PreferenceLevel>()]));
    for (const { person, category, preferenceLevel } of preferences) {
      const levels = candidates.get(person);
      const previous = levels?.get(category);
      if (!levels || !Object.hasOwn(costMultiplier, preferenceLevel)
        || (previous !== undefined && previous !== preferenceLevel)) {
        throw new PreferencesInvalid("The supplied preferences are invalid.");
      }
      levels.set(category, preferenceLevel);
    }

    return this.#update(group, (state) => {
      const tasks = state.tasks.filter((task) => !isCompleted(task) && inWindow(task.interval?.start, window))
        .sort(taskOrder);
      if (!onlyUnassigned) clearAssignments(tasks, (task) => task.source === "AUTO");

      const workloads = workloadByPerson(state.tasks);
      const scheduled: (TaskRef & PersonRef)[] = [];
      const unassigned: TaskRef[] = [];
      for (const task of tasks) {
        if (task.assignee !== undefined) continue;
        let lowestCost = Infinity;
        let tied: string[] = [];
        for (const [person, levels] of candidates) {
          if (!availableFor(state, person, task.interval!)) continue;
          const multiplier = costMultiplier[levels.get(task.category) ?? "NEUTRAL"];
          const cost = (workloads.get(person) ?? 0) + task.weight * multiplier;
          if (cost < lowestCost) {
            lowestCost = cost;
            tied = [person];
          } else if (cost === lowestCost) tied.push(person);
        }
        if (tied.length === 0) {
          unassigned.push({ task: task.task });
          continue;
        }
        const person = tied[Math.floor(Math.random() * tied.length)];
        task.assignee = person;
        task.source = "AUTO";
        workloads.set(person, (workloads.get(person) ?? 0) + task.weight);
        scheduled.push({ task: task.task, person });
      }
      return { scheduled, unassigned };
    });
  }

  async reset({ group, from, until }: GroupRef & Window): Promise<{ cleared: TaskRef[] }> {
    const window = { from, until };
    requireWindow(window);
    return this.#update(group, (state) => ({
      cleared: clearAssignments(state.tasks, (task) => task.source === "AUTO" && inWindow(task.interval?.start, window)),
    }));
  }

  async complete({ task, completedBy, completedAt }: TaskRef & Completion): Promise<TaskRef & Completion> {
    return this.#updateTask(task, (entry) => {
      if (isCompleted(entry)) throw new TaskStatusConflict("Task has already been completed.");
      if (!validDate(completedAt)) throw new CompletionTimeInvalid("Provide a valid completion time.");
      entry.completedBy = completedBy;
      entry.completedAt = completedAt;
      return { task, completedBy, completedAt };
    });
  }

  async uncomplete({ task }: TaskRef): Promise<TaskRef & { lastCompletedBy: string; lastCompletedAt: Date }> {
    return this.#updateTask(task, (entry, state) => {
      if (!isCompleted(entry)) throw new TaskStatusConflict("This task is not completed.");
      const { completedBy: lastCompletedBy, completedAt: lastCompletedAt } = entry;
      const reopened: Task = entry;
      delete reopened.completedBy;
      delete reopened.completedAt;
      if (entry.assignee !== undefined && !availableFor(state, entry.assignee, entry.interval!)) clearAssignment(entry);
      return { task, lastCompletedBy, lastCompletedAt };
    });
  }

  async _get({ task }: TaskRef): Promise<(GroupRef & Omit<Task, "task">)[]> {
    const state = await this.#groups().findOne({ "tasks.task": task }, { projection: { "tasks.$": 1 } });
    if (!state) return [];
    const [{ task: _task, ...details }] = state.tasks;
    return [{ group: state._id, ...details }];
  }

  async _completionContext({ task }: TaskRef): Promise<
    (GroupRef & { item: string; assignee?: string; dueAt: Date; completion: "INCOMPLETE" | "COMPLETED" })[]
  > {
    const [details] = await this._get({ task });
    if (!details) return [];
    const { group, item, assignee, deadline, interval } = details;
    return [{
      group, item, ...(assignee !== undefined && { assignee }),
      dueAt: deadline ?? interval!.end,
      completion: isCompleted(details) ? "COMPLETED" : "INCOMPLETE",
    }];
  }

  async _status({ task, asOf }: TaskRef & { asOf: Date }): Promise<{ status: Status }[]> {
    const [details] = await this._get({ task });
    return details ? [{ status: statusAt(details, asOf) }] : [];
  }

  async _incomplete({ task }: TaskRef): Promise<GroupRef[]> {
    const [details] = await this._get({ task });
    return details && !isCompleted(details) ? [{ group: details.group }] : [];
  }

  async _tasks({ group }: GroupRef): Promise<TaskRow[]> {
    return (await this.#tasks(group)).sort(taskOrder).map(taskRow);
  }

  async _schedule({ group, from, until }: GroupRef & Window): Promise<TaskRow[]> {
    const window = { from, until };
    return (await this.#tasks(group)).filter((task) => inWindow(task.interval?.start, window)
      || inWindow(task.deadline, window)).sort(taskOrder).map(taskRow);
  }

  async _pending({ group, asOf }: GroupRef & { asOf: Date }): Promise<
    (TaskRef & Pick<Task, "item" | "assignee" | "interval" | "deadline"> & { status: Status })[]
  > {
    const tasks = await this.#tasks(group);
    const now = this.now();
    return tasks.filter((task) => !isCompleted(task) && startsOrDueAfter(task, asOf)).sort(taskOrder)
      .map((task) => ({
        task: task.task,
        item: task.item,
        ...(task.assignee !== undefined && { assignee: task.assignee }),
        ...(task.interval && { interval: task.interval }),
        ...(task.deadline && { deadline: task.deadline }),
        status: statusAt(task, now),
      }));
  }

  async _completed({ group, asOf }: GroupRef & { asOf: Date }): Promise<
    (TaskRef & Completion & { item: string; status: Status })[]
  > {
    return (await this.#tasks(group)).filter(isCompleted).filter((task) => startsOrDueAfter(task, asOf))
      .sort(taskOrder).map((task) => ({ ...completionRow(task), item: task.item }));
  }

  async _completedByPerson({ group, person }: GroupRef & PersonRef): Promise<
    (TaskRef & { completedAt: Date; status: Status })[]
  > {
    return (await this.#tasks(group)).filter(isCompleted).filter((task) => task.completedBy === person)
      .sort(completionOrder).map((task) => ({
        task: task.task, completedAt: task.completedAt,
        status: statusAt(task, task.completedAt),
      }));
  }

  async _completedInInterval({ group, from, until }: GroupRef & Window): Promise<
    (TaskRef & Completion & { status: Status })[]
  > {
    const window = { from, until };
    return (await this.#tasks(group)).filter(isCompleted).filter((task) => inWindow(task.completedAt, window))
      .sort(completionOrder).map(completionRow);
  }

  async _availability({ group, person }: GroupRef & PersonRef): Promise<(AvailabilityRef & { interval: Interval })[]> {
    const state = await this.#groups().findOne({ _id: group }, { projection: { availabilities: 1 } });
    return (state?.availabilities ?? []).filter((entry) => entry.person === person)
      .sort((a, b) => a.interval.start.getTime() - b.interval.start.getTime() || a.availability.localeCompare(b.availability))
      .map(({ availability, interval }) => ({ availability, interval }));
  }

  async _hasAvailability({ group }: GroupRef): Promise<{ available: boolean }> {
    const found = await this.#groups().findOne({ _id: group, "availabilities.0": { $exists: true } }, {
      projection: { _id: 1 },
    });
    return { available: found !== null };
  }

  async _workload({ group, person }: GroupRef & PersonRef): Promise<{ workload: number }> {
    return { workload: workloadByPerson(await this.#tasks(group)).get(person) ?? 0 };
  }
}

function startsOrDueAfter(task: Task, cutoff: Date): boolean {
  return (task.interval !== undefined && task.interval.start > cutoff)
    || (task.deadline !== undefined && task.deadline > cutoff);
}

function completionRow(task: Task & Completion): TaskRef & Completion & { status: Status } {
  return {
    task: task.task,
    completedBy: task.completedBy,
    completedAt: task.completedAt,
    status: statusAt(task, task.completedAt),
  };
}
