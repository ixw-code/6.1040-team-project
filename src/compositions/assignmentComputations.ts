import { statusAt } from "../concepts/TaskScheduling/TaskScheduling.ts";

export function assignmentDate({ value }: { value: string | null }): Date | undefined {
  return value === null ? undefined : new Date(value);
}

export function assignmentInterval({
  value,
}: { value: { start: string; end: string } | null }): { start: Date; end: Date } | undefined {
  return value === null ? undefined : { start: new Date(value.start), end: new Date(value.end) };
}

export function assignmentPeople({
  entries,
}: { entries: { task: string; assignee?: string }[] }): string[] {
  return [...new Set(entries.flatMap(({ assignee }) => assignee === undefined ? [] : [assignee]))];
}

export function matchesPersonalTask({
  person, assignee, completedBy, mode,
}: { person: string; assignee?: string; completedBy?: string; mode: string }): { matches: boolean } {
  return { matches: (mode !== "completed" && assignee === person) || (mode !== "assigned" && completedBy === person) };
}

export function assignmentStatus({
  deadline, interval, completedAt, asOf,
}: { deadline?: Date; interval?: { start: Date; end: Date }; completedAt?: Date; asOf: Date }): string {
  return statusAt({ deadline, interval, completedAt }, asOf);
}

export function assignmentIsIncomplete({ completedAt }: { completedAt?: Date }): { incomplete: boolean } {
  return { incomplete: completedAt == null };
}

export function availabilityWindows({ windows }: { windows: { start: string; end: string }[] }) {
  return windows.map(({ start, end }) => ({ start: new Date(start), end: new Date(end) }));
}
