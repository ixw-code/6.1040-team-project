import { expect, test } from "bun:test";
import {
  assignmentWindows, localAssignmentTime, maxAssignmentOccurrences, mondayOf, submissionWindowState,
} from "../../src/shared/assignmentDates.ts";

test("a specific day and a date range each create one assignment occurrence", () => {
  const day = { startsOn: "2027-01-03", endsOn: "2027-01-03" };
  const span = { startsOn: "2026-12-31", endsOn: "2027-01-03" };
  expect(assignmentWindows(day)).toEqual([day]);
  expect(assignmentWindows(span)).toEqual([span]);
  expect(mondayOf(day.startsOn)).toBe("2026-12-28");
  expect(assignmentWindows({ startsOn: span.endsOn, endsOn: span.startsOn })).toEqual([]);
});

test("weekly scheduling stops at the last whole window before the repeat limit", () => {
  const first = { startsOn: "2027-03-12", endsOn: "2027-03-14" };
  const second = { startsOn: "2027-03-19", endsOn: "2027-03-21" };
  expect(assignmentWindows(first, "2027-03-13")).toEqual([]);
  expect(assignmentWindows(first, "2027-03-20")).toEqual([first]);
  expect(assignmentWindows(first, second.endsOn)).toEqual([first, second]);
  expect(assignmentWindows(first, "2100-01-01")).toHaveLength(maxAssignmentOccurrences + 1);
});

test("weekly windows use the same local start and deadline across daylight-saving changes", () => {
  const oldZone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const windows = assignmentWindows({ startsOn: "2027-03-12", endsOn: "2027-03-14" }, "2027-03-21");
    expect(windows.map(({ startsOn, endsOn }) => [
      localAssignmentTime(startsOn, "09:30").toISOString(),
      localAssignmentTime(endsOn, "23:59").toISOString(),
    ])).toEqual([
      ["2027-03-12T14:30:00.000Z", "2027-03-15T03:59:00.000Z"],
      ["2027-03-19T13:30:00.000Z", "2027-03-22T03:59:00.000Z"],
    ]);
    expect(() => localAssignmentTime("2027-03-14", "02:30")).toThrow("That time does not exist");
    expect(localAssignmentTime("2027-11-07", "01:30").toISOString()).toBe("2027-11-07T05:30:00.000Z");
  } finally {
    if (oldZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldZone;
  }
});

test("a submission window includes each occurrence's exact start and deadline", () => {
  const springForward = { start: "2027-03-14T00:00:00-05:00", end: "2027-03-14T23:59:00-04:00" };
  const stateAt = (iso: string) => submissionWindowState(springForward, Date.parse(iso));
  expect(stateAt("2027-03-14T04:59:59.999Z")).toBe("upcoming");
  expect(stateAt("2027-03-14T05:00:00.000Z")).toBe("open");
  expect(stateAt("2027-03-15T03:59:00.000Z")).toBe("open");
  expect(stateAt("2027-03-15T03:59:00.001Z")).toBe("closed");
  expect(submissionWindowState({ ...springForward, end: "invalid" }, Date.parse(springForward.start))).toBe("closed");
});
