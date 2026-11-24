import { expect, test } from "bun:test";
import { assignmentWindows, localAssignmentTime, maxAssignmentOccurrences, mondayOf } from "../../src/shared/assignmentDates.ts";

test("a specific day and a date range each create one assignment occurrence", () => {
  const day = { startsOn: "2027-01-03", endsOn: "2027-01-03" };
  const span = { startsOn: "2026-12-31", endsOn: "2027-01-03" };
  expect(assignmentWindows(day)).toEqual([day]);
  expect(assignmentWindows(span)).toEqual([span]);
  expect(mondayOf(day.startsOn)).toBe("2026-12-28");
  expect(assignmentWindows({ startsOn: span.endsOn, endsOn: span.startsOn })).toEqual([]);
});

test("weekly scheduling repeats complete date windows across clock changes", () => {
  const first = { startsOn: "2027-03-12", endsOn: "2027-03-14" };
  const second = { startsOn: "2027-03-19", endsOn: "2027-03-21" };
  expect(assignmentWindows(first, "2027-03-13")).toEqual([]);
  expect(assignmentWindows(first, "2027-03-20")).toEqual([first]);
  expect(assignmentWindows(first, second.endsOn)).toEqual([first, second]);
  for (const { endsOn } of assignmentWindows(first, second.endsOn)) {
    expect(localAssignmentTime(endsOn, "09:30").getHours()).toBe(9);
  }
  expect(assignmentWindows(first, "2100-01-01")).toHaveLength(maxAssignmentOccurrences + 1);
});
