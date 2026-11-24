export const maxAssignmentOccurrences = 104;

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
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

// Advance calendar dates first. Convert to local instants only after choosing the dates
// so a weekly 9 AM assignment stays at 9 AM when clocks change.
export function assignmentDates(weekday: number, from: string, through: string): string[] {
  if (!from || !through || through < from) return [];
  const day = calendarDay(from);
  const end = calendarDay(through);
  day.setUTCDate(day.getUTCDate() + (weekday - day.getUTCDay() + 7) % 7);

  const dates: string[] = [];
  while (day <= end && dates.length <= maxAssignmentOccurrences) {
    dates.push(dateString(day));
    day.setUTCDate(day.getUTCDate() + 7);
  }
  return dates;
}

export function assignmentInWeek(weekday: number, dateInWeek: string): string {
  const date = calendarDay(mondayOf(dateInWeek));
  date.setUTCDate(date.getUTCDate() + (weekday + 6) % 7);
  return dateString(date);
}

export function localAssignmentTime(day: string, time: string): Date {
  const date = new Date(day + "T" + time);
  const [hour, minute] = time.split(":").map(Number);
  if (date.getHours() !== hour || date.getMinutes() !== minute) {
    throw new Error("That time does not exist on " + day + " in your time zone. Choose a different time.");
  }
  return date;
}
