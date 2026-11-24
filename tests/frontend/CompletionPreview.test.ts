import { describe, expect, test } from "bun:test";
import {
  createPreviewAttempts, residentChore, reviewAttempt, statusOf, submitPhoto,
} from "../../web/src/review-preview.ts";

describe("manual review preview", () => {
  test("requires rejection feedback and preserves the recorded decision", () => {
    const [attempt] = createPreviewAttempts();
    expect(reviewAttempt(attempt, "rejected", " \n ")).toBe("missing-feedback");
    expect(statusOf(attempt)).toBe("pending");

    expect(reviewAttempt(attempt, "rejected", " Show the dish rack. ")).toBe("saved");
    expect(reviewAttempt(attempt, "approved", "")).toBe("already-reviewed");
    expect(attempt.review).toMatchObject({ decision: "rejected", feedback: "Show the dish rack." });
  });

  test("accepts a resubmission after rejection and closes the chore after approval", () => {
    const attempts = createPreviewAttempts();
    const [first] = attempts;
    const { id, baseline } = residentChore;
    expect(submitPhoto(attempts, id, baseline)).toBe(false);

    reviewAttempt(first, "rejected", "Show the dish rack.");
    expect(submitPhoto(attempts, id, baseline)).toBe(true);
    const retry = attempts[2];
    expect(retry).toMatchObject({ taskId: id, photo: baseline });
    expect(statusOf(retry)).toBe("pending");
    expect(statusOf(first)).toBe("rejected");

    reviewAttempt(retry, "approved", "");
    expect(statusOf(retry)).toBe("approved");
    expect(submitPhoto(attempts, id, baseline)).toBe(false);
  });
});
