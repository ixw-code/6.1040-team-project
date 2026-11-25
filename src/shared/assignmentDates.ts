export const maxAssignmentOccurrences = 104;

export const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type Weekday = typeof weekdays[number];
export const mondayFirstWeekdays = [1, 2, 3, 4, 5, 6, 0].map(day => ({ day, name: weekdays[day] }));

function calendarDay(value: string): Date {
  return new Date(value + "T00:00:00Z");
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function mondayOf(value: string): string {
  const date = calendarDay(value);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return dateString(date);
}

export type AssignmentDates = { startsOn: string; endsOn: string };
type AssignmentWindow = { start: Date | string; end: Date | string };

export function submissionWindowState(window: AssignmentWindow, now: number) {
  const start = new Date(window.start).getTime();
  if (now >= start && now <= new Date(window.end).getTime()) return "open";
  return now < start ? "upcoming" : "closed";
}

export function assignmentWindowsOverlap(windows: AssignmentWindow[]): boolean {
  const sorted = windows.map(({ start, end }) => ({ start: new Date(start), end: new Date(end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return sorted.some((window, index) => index > 0 && window.start < sorted[index - 1].end);
}

// Repeat whole calendar windows so local times stay steady across clock changes.
export function assignmentWindows(first: AssignmentDates, repeatThrough?: string): AssignmentDates[] {
  const { startsOn, endsOn } = first;
  if (!startsOn || !endsOn || endsOn < startsOn) return [];
  if (repeatThrough === undefined) return [first];

  const start = calendarDay(startsOn);
  const end = calendarDay(endsOn);
  const limit = calendarDay(repeatThrough);
  const windows: AssignmentDates[] = [];
  while (end <= limit && windows.length <= maxAssignmentOccurrences) {
    windows.push({ startsOn: dateString(start), endsOn: dateString(end) });
    start.setUTCDate(start.getUTCDate() + 7);
    end.setUTCDate(end.getUTCDate() + 7);
  }
  return windows;
}

export function localAssignmentTime(day: string, time: string): Date {
  const date = new Date(day + "T" + time);
  const [hour, minute] = time.split(":").map(Number);
  if (date.getHours() !== hour || date.getMinutes() !== minute) {
    throw new Error("That time does not exist on " + day + " in your time zone. Choose a different time.");
  }
  return date;
}
