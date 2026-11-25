import { MongoServerError, type Db } from "mongodb";
import { assignmentWindowsOverlap, maxAssignmentOccurrences, weekdays } from "../../shared/assignmentDates.ts";

import { isTimeZone, isWeeklyAvailability, type AvailabilityLevel, type WeekAvailability } from "../../shared/weeklyAvailability.ts";

export class WeeklyAvailabilityInvalid extends Error {}
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
type CompletionState = "INCOMPLETE" | "COMPLETED";
type PreferenceLevel = "PREFER" | "NEUTRAL" | "AVOID";
type TaskRef = { task: string };
type GroupRef = { group: string };
type PersonRef = { person: string };
type AvailabilityRef = { availability: string };
type Window = { from: Date; until: Date };
type ScheduleEntry = TaskRef & { assignee?: string };
type Preference = PersonRef & { category: string; preferenceLevel: PreferenceLevel };
type ChorePreference = PersonRef & { order: string[] };
type Completion = { completedBy: string; completedAt: Date };
type TaskDefinition = {
  item: string;
  category?: string;
  weight: number;
  deadline?: Date;
  interval?: Interval;
  timeZone?: string;
  flexibleDays?: boolean;
};
type Task = TaskRef & TaskDefinition & Partial<Completion> & { assignee?: string; source?: Source; archived?: boolean };
type TaskRow = Omit<Task, "interval" | "archived" | "timeZone" | "flexibleDays"> & { start?: Date; end?: Date };
type Availability = AvailabilityRef & PersonRef & { interval: Interval };
type WeeklyAvailability = { days: WeekAvailability; timeZone: string };
type TaskBatch = { batchId: string; tasks: TaskRef[]; repeatWeekly?: boolean };
type Assignment = { tasks: Task[]; batch?: TaskBatch };
type GroupState = {
  _id: string;
  version: number;
  tasks: Task[];
  availabilities: Availability[];
  weeklyAvailability?: (PersonRef & WeeklyAvailability)[];
  taskBatches?: TaskBatch[];
};

const taskMissing = "This task doesn't exist in the schedule.";
const availabilityMissing = "There is no such availability.";
const costMultiplier: Record<PreferenceLevel, number> = { PREFER: 0.5, NEUTRAL: 1, AVOID: 2 };

function requireWeight(weight: number): void {
  if (!Number.isFinite(weight) || weight < 1 || weight > 10) {
    throw new TaskWeightInvalid("Task weight must be between 1 and 10.");
  }
}

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

function coversInterval(state: GroupState, person: string, interval: Interval): boolean {
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

const availabilityRank: Record<AvailabilityLevel, number> = {
  AVAILABLE: 2, SOMEWHAT_AVAILABLE: 1, NOT_AVAILABLE: 0,
};

const calendarFormatters = new Map<string, Intl.DateTimeFormat>();
const dayInMilliseconds = 24 * 60 * 60 * 1000;

// A UTC midnight used only for calendar arithmetic on the local date.
function localCalendarDay(instant: Date, timeZone: string): Date {
  let formatter = calendarFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    calendarFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const year = parts.find(part => part.type === "year")!.value.padStart(4, "0");
  const month = parts.find(part => part.type === "month")!.value;
  const day = parts.find(part => part.type === "day")!.value;
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

function availabilityFor(state: GroupState, person: string, task: Task): number {
  const { interval } = task;
  if (!interval) return 0;
  const weekly = state.weeklyAvailability?.find(entry => entry.person === person);
  if (!weekly) {
    const available = task.flexibleDays
      ? state.availabilities.some(entry => entry.person === person
        && entry.interval.start < interval.end && entry.interval.end > interval.start)
      : coversInterval(state, person, interval);
    return available ? availabilityRank.AVAILABLE : 0;
  }

  const timeZone = task.timeZone ?? weekly.timeZone;
  const first = localCalendarDay(interval.start, timeZone);
  if (!task.flexibleDays) return availabilityRank[weekly.days[weekdays[first.getUTCDay()]]];
  // An end at midnight leaves no time to work on the following day.
  const last = localCalendarDay(new Date(interval.end.getTime() - 1), timeZone);
  const dayCount = Math.min(7, (last.getTime() - first.getTime()) / dayInMilliseconds + 1);
  let best = 0;
  for (let offset = 0; offset < dayCount && best < availabilityRank.AVAILABLE; offset++) {
    const day = weekdays[(first.getUTCDay() + offset) % 7];
    best = Math.max(best, availabilityRank[weekly.days[day]]);
  }
  return best;
}

function clearAssignments(tasks: Task[], matches: (task: Task) => boolean): TaskRef[] {
  const cleared: TaskRef[] = [];
  for (const task of tasks) {
    if (task.assignee !== undefined && !task.archived && !isCompleted(task) && matches(task)) {
      clearAssignment(task);
      cleared.push({ task: task.task });
    }
  }
  return cleared;
}

function workloadByPerson(tasks: Task[]): Map<string, number> {
  const workloads = new Map<string, number>();
  for (const task of tasks) {
    const { assignee, weight } = task;
    if (assignee !== undefined && (!task.archived || isCompleted(task))) {
      workloads.set(assignee, (workloads.get(assignee) ?? 0) + weight);
    }
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

function weeklyCadence(tasks: Task[]): boolean {
  if (tasks.length < 2 || tasks.some(task => !task.interval)) return false;
  const week = 7 * 24 * 60 * 60 * 1000;
  const first = taskStart(tasks[0]).getTime();
  let previousWeek = 0;
  for (const task of tasks.slice(1)) {
    const elapsed = taskStart(task).getTime() - first;
    const weeks = Math.round(elapsed / week);
    if (weeks <= previousWeek || Math.abs(elapsed - weeks * week) > 2 * 60 * 60 * 1000) return false;
    previousWeek = weeks;
  }
  return true;
}

function recurringAssignments(state: GroupState): Map<Task, Assignment> {
  const byId = new Map(state.tasks.map(task => [task.task, task]));
  const recurring = new Map<Task, Assignment>();
  for (const batch of state.taskBatches ?? []) {
    const tasks = batch.tasks.flatMap(({ task }) => byId.get(task) ?? []).sort(taskOrder);
    // Older weekly batches have no repeat flag. Recognize their stored weekly cadence.
    if (!(batch.repeatWeekly ?? weeklyCadence(tasks))) continue;
    const assignment: Assignment = { tasks, batch };
    for (const task of tasks) recurring.set(task, assignment);
  }
  return recurring;
}

function assignments(state: GroupState): Assignment[] {
  const recurring = recurringAssignments(state);
  const grouped = new Set<Assignment>();
  for (const task of state.tasks) grouped.add(recurring.get(task) ?? { tasks: [task] });
  return [...grouped].sort((left, right) => taskOrder(left.tasks[0], right.tasks[0]));
}

function openTasks(assignment: Assignment): Task[] {
  return assignment.tasks.filter(task => !task.archived && !isCompleted(task));
}

function touchesWindow(open: Task[], window: Window): boolean {
  return open.some(task => scheduledInWindow(task, window));
}

function canReset(open: Task[]): boolean {
  return open.every(task => task.source !== "MANUAL");
}

function clearUnavailable(state: GroupState, person: string): TaskRef[] {
  const recurring = recurringAssignments(state);
  return clearAssignments(state.tasks, task =>
    task.assignee === person && !recurring.has(task) && availabilityFor(state, person, task) === 0);
}

function completionOrder(a: Task & Completion, b: Task & Completion): number {
  return a.completedAt.getTime() - b.completedAt.getTime() || a.task.localeCompare(b.task);
}

function inWindow(value: Date | undefined, { from, until }: Window): boolean {
  return value !== undefined && value >= from && value < until;
}

function scheduledInWindow(task: Task, window: Window): boolean {
  if (task.flexibleDays && task.interval) return task.interval.start < window.until && task.interval.end > window.from;
  return inWindow(task.interval?.start, window);
}

function taskRow({ interval, archived: _archived, timeZone: _timeZone, flexibleDays: _flexibleDays, ...task }: Task): TaskRow {
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

  async #updateTask<Result>(task: string, change: (entry: Task, state: GroupState) => Result, includeArchived = false): Promise<Result> {
    const group = await this.#groups().findOne({ "tasks.task": task }, { projection: { _id: 1 } });
    if (!group) throw new TaskNotFound(taskMissing);
    return this.#update(group._id, (state) => {
      const entry = state.tasks.find((candidate) => candidate.task === task);
      if (!entry || (!includeArchived && entry.archived)) throw new TaskNotFound(taskMissing);
      return change(entry, state);
    });
  }

  async #tasks(group: string): Promise<Task[]> {
    const state = await this.#groups().findOne({ _id: group }, { projection: { tasks: 1 } });
    return state?.tasks ?? [];
  }

  async add({ group, item, category, weight, deadline, interval }: GroupRef & Omit<TaskDefinition, "timeZone" | "flexibleDays">): Promise<TaskRef> {
    requireWeight(weight);
    if (!validTiming(deadline, interval)) {
      throw new TaskIntervalInvalid("Provide a deadline or a valid interval that ends by the deadline when both are given.");
    }
    const task = crypto.randomUUID();
    const due = deadline ?? interval!.end;
    return this.#update(group, (state) => {
      state.tasks.push({ task, item, weight, deadline: due,
        ...(category !== undefined && { category }), ...(interval && { interval }),
      });
      return { task };
    }, true);
  }

  async addBatch({ group, item, category, weight, intervals, batchId, repeatWeekly = false, flexibleDays = false, timeZone }: GroupRef
    & Pick<TaskDefinition, "item" | "category" | "weight"> & {
      intervals: Interval[];
      batchId: string;
      repeatWeekly?: boolean;
      flexibleDays?: boolean;
      timeZone?: string | null;
    }): Promise<{ tasks: TaskRef[] }> {
    requireWeight(weight);
    if (!intervals.length || intervals.length > maxAssignmentOccurrences
      || intervals.some(({ start, end }) => !validInterval(start, end))) {
      throw new TaskIntervalInvalid(`Provide between 1 and ${maxAssignmentOccurrences} valid task intervals.`);
    }
    if (repeatWeekly && assignmentWindowsOverlap(intervals)) {
      throw new TaskIntervalInvalid("Weekly occurrences must not overlap.");
    }

    if (timeZone != null && !isTimeZone(timeZone)) throw new TaskIntervalInvalid("Provide a valid time zone for the task.");

    const entries = intervals.map(interval => ({
      task: crypto.randomUUID(), item, weight, deadline: interval.end, interval,
      ...(category !== undefined && { category }),
      ...(timeZone != null && { timeZone }),
      ...(flexibleDays && { flexibleDays }),
    }));
    const tasks = entries.map(({ task }) => ({ task }));
    return this.#update(group, state => {
      const previous = state.taskBatches?.find(batch => batch.batchId === batchId);
      if (previous) return { tasks: previous.tasks };
      state.tasks.push(...entries);
      (state.taskBatches ??= []).push({ batchId, tasks, repeatWeekly });
      return { tasks };
    }, true);
  }

  async archiveAssignment({ group, task }: GroupRef & TaskRef): Promise<TaskRef> {
    return this.#update(group, state => {
      const entry = state.tasks.find(candidate => candidate.task === task);
      if (!entry) throw new TaskNotFound(taskMissing);
      const series = recurringAssignments(state).get(entry);
      for (const occurrence of series?.tasks ?? [entry]) occurrence.archived = true;
      return { task };
    });
  }

  async remove({ task }: TaskRef): Promise<TaskRef> {
    return this.#updateTask(task, (entry, state) => {
      if (isCompleted(entry)) throw new TaskStatusConflict("A completed task cannot be removed.");
      const batch = recurringAssignments(state).get(entry)?.batch;
      if (batch) batch.repeatWeekly = true;
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
      const series = recurringAssignments(state).get(entry);
      if (!validTiming(entry.deadline, interval) || (series && interval === undefined)) {
        throw new TaskIntervalInvalid("Provide a valid interval that ends by the deadline, or keep a deadline when clearing a standalone interval.");
      }
      if (interval === undefined) {
        delete entry.interval;
        clearAssignment(entry);
      } else {
        if (series?.tasks.some(other => other !== entry && !other.archived && other.interval
          && interval.start < other.interval.end && interval.end > other.interval.start)) {
          throw new TaskIntervalInvalid("Weekly occurrences must not overlap.");
        }
        entry.interval = interval;
        if (series?.batch) series.batch.repeatWeekly = true;
        else if (entry.assignee !== undefined && availabilityFor(state, entry.assignee, entry) === 0) clearAssignment(entry);
      }
      return { task };
    });
  }

  async setWeeklyAvailability({ group, person, days, timeZone }: GroupRef & PersonRef & WeeklyAvailability): Promise<{ freed: TaskRef[] }> {
    if (!isWeeklyAvailability(days) || !isTimeZone(timeZone)) {
      throw new WeeklyAvailabilityInvalid("Provide an availability level for every weekday and a valid time zone.");
    }
    return this.#update(group, state => {
      const weekly = state.weeklyAvailability ??= [];
      const current = weekly.find(entry => entry.person === person);
      if (current) {
        current.days = { ...days };
        current.timeZone = timeZone;
      } else {
        weekly.push({ person, days: { ...days }, timeZone });
      }
      return { freed: clearUnavailable(state, person) };
    }, true);
  }

  async addAvailability({ group, person, start, end }: GroupRef & PersonRef & Interval): Promise<AvailabilityRef> {
    if (!validInterval(start, end)) throw new TaskIntervalInvalid("Availability interval must end after it starts.");
    const availability = crypto.randomUUID();
    return this.#update(group, (state) => {
      state.availabilities.push({ availability, person, interval: { start, end } });
      return { availability };
    }, true);
  }

  async editAvailability({ group, person, windows, adding }: GroupRef & PersonRef & {
    windows: Interval[]; adding: boolean;
  }): Promise<{ freed: TaskRef[] }> {
    if (!windows.length || windows.some(w => !validInterval(w.start, w.end))) {
      throw new TaskIntervalInvalid("Each availability window must end after it starts.");
    }
    return this.#update(group, state => {
      for (const interval of windows) {
        if (adding) {
          if (!coversInterval(state, person, interval)) {
            state.availabilities.push({ availability: crypto.randomUUID(), person, interval });
          }
          continue;
        }
        state.availabilities = state.availabilities.flatMap(block => {
          const { start, end } = block.interval;
          if (block.person !== person || start >= interval.end || end <= interval.start) return [block];
          const remaining: Availability[] = [];
          if (start < interval.start) remaining.push({ ...block, interval: { start, end: interval.start } });
          if (end > interval.end) remaining.push({
            availability: remaining.length ? crypto.randomUUID() : block.availability, person,
            interval: { start: interval.end, end },
          });
          return remaining;
        });
      }
      return { freed: adding ? [] : clearUnavailable(state, person) };
    }, adding);
  }

  async removeAvailability({ availability }: AvailabilityRef): Promise<{ freed: TaskRef[] }> {
    const group = await this.#groups().findOne({ "availabilities.availability": availability }, { projection: { _id: 1 } });
    if (!group) throw new AvailabilityNotFound(availabilityMissing);
    return this.#update(group._id, (state) => {
      const index = state.availabilities.findIndex((entry) => entry.availability === availability);
      if (index < 0) throw new AvailabilityNotFound(availabilityMissing);
      const [{ person }] = state.availabilities.splice(index, 1);
      return { freed: clearUnavailable(state, person) };
    });
  }

  async removePerson({ group, person }: GroupRef & PersonRef): Promise<{ freed: TaskRef[] }> {
    return this.#update(group, (state) => {
      state.availabilities = state.availabilities.filter((entry) => entry.person !== person);
      if (state.weeklyAvailability) state.weeklyAvailability = state.weeklyAvailability.filter(entry => entry.person !== person);
      return { freed: clearAssignments(state.tasks, (task) => task.assignee === person) };
    });
  }

  async setSchedule({ group, entries }: GroupRef & { entries: ScheduleEntry[] }): Promise<{ entries: ScheduleEntry[] }> {
    return this.#update(group, (state) => {
      const tasks = new Map(state.tasks.map((task) => [task.task, task]));
      const recurring = recurringAssignments(state);
      const selected = new Map<Task, string | undefined>();
      for (const entry of entries) {
        const task = tasks.get(entry.task);
        if (!task || task.archived) throw new TaskNotFound("One of these tasks is not on this schedule.");
        if (isCompleted(task)) throw new TaskStatusConflict("A completed task cannot be reassigned.");
        const series = recurring.get(task);
        for (const occurrence of series ? openTasks(series) : [task]) {
          if (!occurrence.interval) throw new TaskIntervalInvalid("Task must have a scheduled interval before assignment.");
          if (selected.has(occurrence) && selected.get(occurrence) !== entry.assignee) {
            throw new ScheduleEntriesInvalid("A task cannot have conflicting assignments in one batch.");
          }
          if (entry.assignee !== undefined) {
            const assignee = entry.assignee;
            const hasWeeklyAvailability = state.weeklyAvailability?.some(entry => entry.person === assignee);
            if ((!series || hasWeeklyAvailability) && availabilityFor(state, assignee, occurrence) === 0) {
              throw new PersonNotAvailable("An assignee is not available for this task.");
            }
          }
          selected.set(occurrence, entry.assignee);
        }
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

  async autoSchedule({ group, from, until, people, preferences, chorePreferences = [], onlyUnassigned }: GroupRef & Window & {
    people: PersonRef[];
    preferences: Preference[];
    chorePreferences?: ChorePreference[];
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

    const choreCosts = new Map<string, Map<string, number>>();
    for (const { person, order } of chorePreferences) {
      if (!candidates.has(person) || choreCosts.has(person) || new Set(order).size !== order.length) {
        throw new PreferencesInvalid("The supplied preferences are invalid.");
      }
      const lastRank = Math.max(order.length - 1, 1);
      choreCosts.set(person, new Map(order.map((chore, index) => [chore, 0.5 + index / lastRank])));
    }

    return this.#update(group, (state) => {
      const selected = assignments(state).flatMap(assignment => {
        const open = openTasks(assignment);
        const task = open.find(task => scheduledInWindow(task, window));
        return task ? [{ task, open }] : [];
      }).sort((left, right) => taskOrder(left.task, right.task));

      if (!onlyUnassigned) {
        for (const { open } of selected) {
          if (canReset(open)) clearAssignments(open, task => task.source === "AUTO");
        }
      }

      const workloads = workloadByPerson(state.tasks);
      const scheduled: (TaskRef & PersonRef)[] = [];
      const unassigned: TaskRef[] = [];
      for (const { task, open } of selected) {
        if (open.some(occurrence => occurrence.assignee !== undefined)) continue;
        let bestAvailability = 0;
        let lowestCost = Infinity;
        let tied: string[] = [];
        for (const [person, levels] of candidates) {
          const availability = Math.min(...open.map(occurrence => availabilityFor(state, person, occurrence)));
          if (availability === 0 || availability < bestAvailability) continue;
          const ranking = choreCosts.get(person);
          const multiplier = ranking
            ? ranking.get(task.item) ?? 1
            : costMultiplier[task.category ? levels.get(task.category) ?? "NEUTRAL" : "NEUTRAL"];
          const cost = (workloads.get(person) ?? 0) + task.weight * multiplier;
          if (availability > bestAvailability || cost < lowestCost) {
            bestAvailability = availability;
            lowestCost = cost;
            tied = [person];
          } else if (cost === lowestCost) tied.push(person);
        }
        if (tied.length === 0) {
          unassigned.push({ task: task.task });
          continue;
        }
        const person = tied[Math.floor(Math.random() * tied.length)];
        for (const occurrence of open) {
          occurrence.assignee = person;
          occurrence.source = "AUTO";
          workloads.set(person, (workloads.get(person) ?? 0) + occurrence.weight);
        }
        scheduled.push({ task: task.task, person });
      }
      return { scheduled, unassigned };
    });
  }

  async reset({ group, from, until }: GroupRef & Window): Promise<{ cleared: TaskRef[] }> {
    const window = { from, until };
    requireWindow(window);
    return this.#update(group, state => ({
      cleared: assignments(state).flatMap(assignment => {
        const open = openTasks(assignment);
        if (!touchesWindow(open, window) || !canReset(open)) return [];
        return clearAssignments(open, task => task.source === "AUTO");
      }),
    }));
  }

  async complete({ task, completedBy, completedAt }: TaskRef & Completion): Promise<TaskRef & Completion> {
    return this.#updateTask(task, (entry) => {
      if (isCompleted(entry)) throw new TaskStatusConflict("Task has already been completed.");
      if (!validDate(completedAt)) throw new CompletionTimeInvalid("Provide a valid completion time.");
      entry.completedBy = completedBy;
      entry.completedAt = completedAt;
      return { task, completedBy, completedAt };
    }, true);
  }

  async uncomplete({ task }: TaskRef): Promise<TaskRef & { lastCompletedBy: string; lastCompletedAt: Date }> {
    return this.#updateTask(task, (entry, state) => {
      if (!isCompleted(entry)) throw new TaskStatusConflict("This task is not completed.");
      const { completedBy: lastCompletedBy, completedAt: lastCompletedAt } = entry;
      const reopened: Task = entry;
      delete reopened.completedBy;
      delete reopened.completedAt;
      const series = recurringAssignments(state).get(entry);
      if (series) {
        const other = openTasks(series).find(task => task !== entry);
        if (other) {
          clearAssignment(entry);
          if (other.assignee !== undefined) {
            entry.assignee = other.assignee;
            entry.source = other.source;
          }
        }
      } else if (entry.assignee !== undefined && availabilityFor(state, entry.assignee, entry) === 0) {
        clearAssignment(entry);
      }
      return { task, lastCompletedBy, lastCompletedAt };
    });
  }

  async _assignments({ group, from, until }: GroupRef & Window) {
    const state = await this.#groups().findOne({ _id: group }, { projection: { tasks: 1, taskBatches: 1 } });
    const window = { from, until };
    const rows = (state ? assignments(state) : []).flatMap(assignment => {
      const { tasks, batch } = assignment;
      const visible = tasks.find(task => !task.archived
        && (scheduledInWindow(task, window) || inWindow(task.deadline, window)));
      if (!visible) return [];
      const open = openTasks(assignment);
      const assignees = new Set(open.map(task => task.assignee));
      const first = tasks[0];
      const last = tasks[tasks.length - 1];
      const representative = open.includes(visible) ? visible : open[0] ?? visible;
      return [{
        task: representative.task, item: first.item, weekly: Boolean(batch), occurrences: tasks.length, remaining: open.length,
        mixed: assignees.size > 1,
        assignee: open.length ? (assignees.size > 1 ? null : open[0].assignee ?? null) : last.completedBy ?? null,
        startsAt: taskStart(first),
        firstWindowEndsAt: first.interval?.end ?? first.deadline!,
        flexibleDays: Boolean(first.flexibleDays),
        timeZone: first.timeZone ?? null,
        endsAt: last.deadline ?? last.interval!.end,
      }];
    });
    return rows;
  }

  async _get({ task }: TaskRef): Promise<(GroupRef & Omit<Task, "task">)[]> {
    const state = await this.#groups().findOne({ "tasks.task": task }, { projection: { "tasks.$": 1 } });
    if (!state) return [];
    const [{ task: _task, ...details }] = state.tasks;
    return [{ group: state._id, ...details }];
  }

  async _completionContext({ task }: TaskRef): Promise<
    (GroupRef & Pick<Task, "item" | "assignee" | "interval" | "archived"> & { dueAt: Date; completion: CompletionState })[]
  > {
    const [details] = await this._get({ task });
    if (!details) return [];
    const { group, item, assignee, deadline, interval, archived } = details;
    return [{
      group, item, ...(assignee !== undefined && { assignee }),
      dueAt: deadline ?? interval!.end,
      completion: isCompleted(details) ? "COMPLETED" : "INCOMPLETE",
      ...(interval && { interval }), ...(archived !== undefined && { archived }),
    }];
  }

  async _status({ task, asOf }: TaskRef & { asOf: Date }): Promise<{ status: Status }[]> {
    const [details] = await this._get({ task });
    return details ? [{ status: statusAt(details, asOf) }] : [];
  }

  async _incomplete({ task }: TaskRef): Promise<GroupRef[]> {
    const [details] = await this._get({ task });
    return details && !details.archived && !isCompleted(details) ? [{ group: details.group }] : [];
  }

  async _activeTask({ task }: TaskRef): Promise<GroupRef[]> {
    const [entry] = await this._get({ task });
    return entry && !entry.archived ? [{ group: entry.group }] : [];
  }

  async _tasks({ group }: GroupRef): Promise<TaskRow[]> {
    return (await this.#tasks(group)).sort(taskOrder).map(taskRow);
  }

  async _schedule({ group, from, until }: GroupRef & Window): Promise<TaskRow[]> {
    const window = { from, until };
    return (await this.#tasks(group)).filter(task => !task.archived
      && (scheduledInWindow(task, window) || inWindow(task.deadline, window))).sort(taskOrder).map(taskRow);
  }

  async _pending({ group, asOf }: GroupRef & { asOf: Date }): Promise<
    (TaskRef & Pick<Task, "item" | "assignee" | "interval" | "deadline"> & { status: Status })[]
  > {
    const tasks = await this.#tasks(group);
    const now = this.now();
    return tasks.filter((task) => !task.archived && !isCompleted(task) && startsOrDueAfter(task, asOf)).sort(taskOrder)
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

  async _weeklyAvailability({ group, person }: GroupRef & PersonRef): Promise<{ days: WeekAvailability | null }> {
    const state = await this.#groups().findOne({ _id: group }, { projection: { weeklyAvailability: 1 } });
    return { days: state?.weeklyAvailability?.find(entry => entry.person === person)?.days ?? null };
  }

  async _hasAvailability({ group }: GroupRef): Promise<{ available: boolean }> {
    const state = await this.#groups().findOne({ _id: group }, { projection: { availabilities: 1, weeklyAvailability: 1 } });
    const weekly = state?.weeklyAvailability ?? [];
    const configured = new Set(weekly.map(entry => entry.person));
    return {
      available: weekly.some(entry => Object.values(entry.days).some(level => level !== "NOT_AVAILABLE"))
        || (state?.availabilities.some(entry => !configured.has(entry.person)) ?? false),
    };
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
