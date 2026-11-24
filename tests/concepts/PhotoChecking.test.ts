import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import { AlreadyPending, AlreadyReviewed, PhotoCheckingConcept } from "../../src/concepts/PhotoChecking/PhotoChecking.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const evidence = {
  person: "alice",
  photo: "first-photo.jpg",
  criteria: "Clear the sink.",
  baseline: "original-baseline.jpg",
  method: "MANUAL" as const,
};

describe("PhotoChecking", () => {
  const getTestDb = useMongoTestDb("photo_checking");

  test("reads an older submission with an empty baseline as having no reference", async () => {
    const checking = new PhotoCheckingConcept(getTestDb);
    const { submission } = await checking.submit({ ...evidence, subject: "legacy-no-reference" });
    await getTestDb().collection<{ _id: string }>("photo_checking_submissions")
      .updateOne({ _id: submission }, { $set: { baseline: "" } });
    const [saved] = await checking._submission({ submission });
    expect(saved).toMatchObject({ photo: evidence.photo, criteria: evidence.criteria });
    expect(saved).not.toHaveProperty("baseline");
  });

  test("preserves rejected evidence when a resident resubmits and receives approval", async () => {
    const { concepts: { PhotoChecking } } = assembleApplication(getTestDb);
    const subject = "monday-sink";
    expect(await PhotoChecking._current({ subject })).toEqual([]);
    expect(await PhotoChecking._history({ subject })).toEqual([]);

    const first = await PhotoChecking.submit({ ...evidence, subject });
    if ("error" in first) throw new Error(first.error);
    expect(await PhotoChecking.submit({ ...evidence, subject })).toMatchObject({ error: "ALREADY_PENDING" });
    expect(await PhotoChecking._pending({ method: "MANUAL" })).toContainEqual({
      ...first, subject, person: evidence.person, submittedAt: expect.any(Date),
    });

    const [pending] = await PhotoChecking._submission(first);
    expect(pending).toEqual({
      person: evidence.person,
      subject,
      photo: evidence.photo,
      criteria: evidence.criteria,
      baseline: evidence.baseline,
      selectedMethod: "MANUAL",
      reviewMethod: "MANUAL",
      status: "PENDING",
      submittedAt: expect.any(Date),
      feedback: "",
    });
    const reviewer = "overseer";
    expect(await PhotoChecking.reject({ ...first, reviewer, reason: " \n " })).toMatchObject({
      error: "MISSING_REASON",
    });
    const reason = "There are still dishes in the sink.";
    expect(await PhotoChecking.reject({ ...first, reviewer, reason })).toEqual({
      ...first, subject, person: evidence.person,
    });

    const second = await PhotoChecking.submit({
      ...evidence, subject, photo: "second-photo.jpg", criteria: "Show both sinks.", baseline: "new-baseline.jpg",
    });
    if ("error" in second) throw new Error(second.error);
    expect(second).not.toEqual(first);
    expect(await PhotoChecking._current({ subject })).toEqual([second]);
    const approval = { reviewer, method: "MANUAL" as const, feedback: "Both sinks are clear." };
    expect(await PhotoChecking.approve({ ...first, ...approval })).toMatchObject({ error: "ALREADY_REVIEWED" });
    expect(await PhotoChecking.approve({ ...second, ...approval })).toEqual({
      ...second, subject, person: evidence.person,
    });
    expect(await PhotoChecking.submit({ ...evidence, subject })).toMatchObject({ error: "ALREADY_APPROVED" });
    expect(await PhotoChecking.reject({ ...second, reviewer, reason })).toMatchObject({ error: "ALREADY_REVIEWED" });

    expect(await PhotoChecking._submission(first)).toEqual([{
      ...pending, reviewer, status: "REJECTED", reviewedAt: expect.any(Date), feedback: reason,
    }]);
    expect(await PhotoChecking._submission(second)).toMatchObject([{
      photo: "second-photo.jpg",
      criteria: "Show both sinks.",
      baseline: "new-baseline.jpg",
      reviewer,
      status: "APPROVED",
    }]);
    expect(await PhotoChecking._history({ subject })).toEqual([
      { ...second, status: "APPROVED", submittedAt: expect.any(Date), reviewedAt: expect.any(Date), feedback: approval.feedback },
      { ...first, status: "REJECTED", submittedAt: pending.submittedAt, reviewedAt: expect.any(Date), feedback: reason },
    ]);
    const manualQueue = await PhotoChecking._pending({ method: "MANUAL" });
    expect(manualQueue.some((row) => row.subject === subject)).toBe(false);
  });

  test("routes an automatic attempt to manual review and preserves the selected method", async () => {
    const { concepts: { PhotoChecking } } = assembleApplication(getTestDb);
    const subject = "automatic-task";
    const ref = await PhotoChecking.submit({ ...evidence, subject, method: "AUTOMATIC" });
    if ("error" in ref) throw new Error(ref.error);
    const reviewer = "overseer";
    expect(await PhotoChecking._pending({ method: "AUTOMATIC" })).toContainEqual({
      ...ref, subject, person: evidence.person, submittedAt: expect.any(Date),
    });
    expect(await PhotoChecking.reject({ ...ref, reviewer, reason: "Missing evidence" })).toMatchObject({
      error: "MANUAL_REVIEW_REQUIRED",
    });
    expect(await PhotoChecking.approve({ ...ref, reviewer, method: "MANUAL", feedback: "" })).toMatchObject({
      error: "WRONG_REVIEW_METHOD",
    });
    expect(await PhotoChecking.sendToOverseer(ref)).toEqual(ref);
    expect(await PhotoChecking.sendToOverseer(ref)).toEqual(ref);
    const automaticQueue = await PhotoChecking._pending({ method: "AUTOMATIC" });
    expect(automaticQueue.some((row) => row.subject === subject)).toBe(false);
    expect(await PhotoChecking._pending({ method: "MANUAL" })).toContainEqual({
      ...ref, subject, person: evidence.person, submittedAt: expect.any(Date),
    });
    const [referred] = await PhotoChecking._submission(ref);
    expect(referred).toMatchObject({ selectedMethod: "AUTOMATIC", reviewMethod: "MANUAL", status: "PENDING" });
    expect(referred.reviewedAt).toBeUndefined();
    expect(await PhotoChecking.approve({ ...ref, reviewer: "agent", method: "AUTOMATIC", feedback: "" })).toMatchObject({
      error: "WRONG_REVIEW_METHOD",
    });
    expect(await PhotoChecking.approve({ ...ref, reviewer, method: "MANUAL", feedback: "" })).toEqual({
      ...ref, subject, person: evidence.person,
    });
    expect(await PhotoChecking.sendToOverseer(ref)).toMatchObject({ error: "ALREADY_REVIEWED" });
  });

  test("supports automatic approval and refuses actions on unknown submissions", async () => {
    const { concepts: { PhotoChecking } } = assembleApplication(getTestDb);
    const reviewer = "agent";
    const unknown = { submission: "unknown" };
    expect(await PhotoChecking._submission(unknown)).toEqual([]);
    expect(await PhotoChecking.approve({ ...unknown, reviewer, method: "AUTOMATIC", feedback: "" })).toMatchObject({
      error: "NOT_FOUND",
    });
    expect(await PhotoChecking.reject({ ...unknown, reviewer, reason: "Missing evidence" })).toMatchObject({
      error: "NOT_FOUND",
    });
    expect(await PhotoChecking.sendToOverseer(unknown)).toMatchObject({ error: "NOT_FOUND" });

    const subject = "automatically-approved-task";
    const ref = await PhotoChecking.submit({ ...evidence, subject, method: "AUTOMATIC" });
    if ("error" in ref) throw new Error(ref.error);
    expect(await PhotoChecking.approve({ ...ref, reviewer, method: "AUTOMATIC", feedback: "" })).toEqual({
      ...ref, subject, person: evidence.person,
    });
    expect(await PhotoChecking._submission(ref)).toMatchObject([{ reviewer, status: "APPROVED" }]);
  });

  test("accepts only one concurrent attempt, including on resubmission", async () => {
    const first = new PhotoCheckingConcept(getTestDb);
    const second = new PhotoCheckingConcept(getTestDb);
    const subject = "concurrent-submissions";

    async function raceSubmissions() {
      const outcomes = await Promise.allSettled([
        first.submit({ ...evidence, subject }),
        second.submit({ ...evidence, subject, photo: "other-photo.jpg" }),
      ]);
      const winner = outcomes.find((outcome) => outcome.status === "fulfilled");
      const refusal = outcomes.find((outcome) => outcome.status === "rejected");
      if (!winner || !refusal) throw new Error("Expected exactly one submission to succeed.");
      expect(refusal.reason).toBeInstanceOf(AlreadyPending);
      expect(await first._current({ subject })).toEqual([winner.value]);
      return winner.value;
    }

    const initial = await raceSubmissions();
    await first.reject({ ...initial, reviewer: "overseer", reason: "Try again" });
    const retry = await raceSubmissions();
    expect(await second._history({ subject })).toMatchObject([
      { ...retry, status: "PENDING" },
      { ...initial, status: "REJECTED" },
    ]);
  });

  test("keeps one final decision when approval and rejection happen concurrently", async () => {
    const first = new PhotoCheckingConcept(getTestDb);
    const second = new PhotoCheckingConcept(getTestDb);
    const subject = "concurrent-review";
    const ref = await first.submit({ ...evidence, subject });
    const approval = { ...ref, reviewer: "approver", method: "MANUAL" as const, feedback: "Sink is clear" };
    const rejection = { ...ref, reviewer: "rejecter", reason: "Try again" };
    const [approved, rejected] = await Promise.allSettled([first.approve(approval), second.reject(rejection)]);
    const outcomes = [approved, rejected];
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") expect(outcome.reason).toBeInstanceOf(AlreadyReviewed);
    }
    const [detail] = await second._submission(ref);
    expect(detail).toMatchObject(approved.status === "fulfilled"
      ? { status: "APPROVED", reviewer: approval.reviewer, feedback: approval.feedback }
      : { status: "REJECTED", reviewer: rejection.reviewer, feedback: rejection.reason });
  });
});
