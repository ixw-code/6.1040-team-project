import { expect, test } from "bun:test";
import { assignmentDates, assignmentInWeek, localAssignmentTime, maxAssignmentOccurrences, mondayOf } from "../../src/shared/assignmentDates.ts";

test("a date picks the Monday-to-Sunday week, even across a year boundary", () => {
  expect(mondayOf("2027-01-03")).toBe("2026-12-28");
  expect(assignmentInWeek(3, "2027-01-03")).toBe("2026-12-30");
  expect(assignmentInWeek(0, "2027-01-01")).toBe("2027-01-03");
});

test("a weekly range includes both endpoints and keeps the local hour across clock changes", () => {
  const dates = assignmentDates(0, "2027-03-07", "2027-03-28");
  expect(dates).toEqual(["2027-03-07", "2027-03-14", "2027-03-21", "2027-03-28"]);
  for (const day of dates) expect(localAssignmentTime(day, "09:30").getHours()).toBe(9);
  expect(assignmentDates(1, "2027-03-02", "2027-03-07")).toEqual([]);
  expect(assignmentDates(1, "2027-04-01", "2027-03-01")).toEqual([]);
  expect(assignmentDates(1, "2027-01-01", "2100-01-01")).toHaveLength(maxAssignmentOccurrences + 1);
});
