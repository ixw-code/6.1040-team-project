import { weekdays, type Weekday } from "./assignmentDates.ts";

export const availabilityLevels = ["AVAILABLE", "SOMEWHAT_AVAILABLE", "NOT_AVAILABLE"] as const;
export type AvailabilityLevel = typeof availabilityLevels[number];
export type WeekAvailability = Record<Weekday, AvailabilityLevel>;

export const availabilityLabels: Record<AvailabilityLevel, string> = {
  AVAILABLE: "Available",
  SOMEWHAT_AVAILABLE: "Somewhat available",
  NOT_AVAILABLE: "Not available",
};

export function isWeeklyAvailability(value: unknown): value is WeekAvailability {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const days = value as Record<string, unknown>;
  return Object.keys(days).length === weekdays.length
    && weekdays.every(day => Object.hasOwn(days, day) && availabilityLevels.some(level => days[day] === level));
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
