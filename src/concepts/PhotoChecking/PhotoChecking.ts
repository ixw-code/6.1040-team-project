import { MongoServerError, type Db } from "mongodb";

export class AlreadyPending extends Error {}
export class AlreadyApproved extends Error {}
export class SubmissionNotFound extends Error {}
export class AlreadyReviewed extends Error {}
export class WrongReviewMethod extends Error {}
export class ManualReviewRequired extends Error {}
export class MissingReason extends Error {}

type ReviewMethod = "MANUAL" | "AUTOMATIC";
type Status = "PENDING" | "APPROVED" | "REJECTED";

// Copy the evidence and criteria into each attempt so earlier reviews keep their original context.
type Evidence = { person: string; subject: string; photo: string; criteria: string; baseline?: string };
type SubmissionDetails = Evidence & {
  selectedMethod: ReviewMethod;
  reviewMethod: ReviewMethod;
  status: Status;
  submittedAt: Date;
  reviewer?: string;
  reviewedAt?: Date;
  feedback: string;
};
type Submission = SubmissionDetails & { _id: string; attempt: number };
type SubmissionRef = { submission: string };
type ReviewResult = SubmissionRef & { subject: string; person: string };
type HistoryRow = SubmissionRef & Pick<SubmissionDetails, "status" | "submittedAt" | "reviewedAt" | "feedback">;
type PendingRow = SubmissionRef & Pick<SubmissionDetails, "subject" | "person" | "submittedAt">;
type ReviewUpdate =
  | { reviewMethod: "MANUAL" }
  | { status: "APPROVED" | "REJECTED"; reviewer: string; reviewedAt: Date; feedback: string };

export class PhotoCheckingConcept {
  #attemptIndex?: Promise<string>;

  constructor(private readonly getDb: () => Db) {}

  #submissions() {
    return this.getDb().collection<Submission>("photo_checking_submissions");
  }

  // The highest attempt number identifies the current submission, even when timestamps tie.
  #latest(subject: string) {
    return this.#submissions().findOne<Pick<Submission, "_id" | "attempt" | "status">>(
      { subject },
      { sort: { attempt: -1 }, projection: { attempt: 1, status: 1 } },
    );
  }

  async submit({ person, subject, photo, criteria, baseline, method, submittedAt = new Date() }: Evidence & {
    method: ReviewMethod;
    submittedAt?: Date;
  }): Promise<SubmissionRef> {
    const submissions = this.#submissions();
    // Create the unique index on first use so concurrent writers cannot claim the same attempt number.
    this.#attemptIndex ??= submissions.createIndex({ subject: 1, attempt: -1 }, { unique: true })
      .catch((error: unknown) => {
        this.#attemptIndex = undefined;
        throw error;
      });
    await this.#attemptIndex;

    while (true) {
      const current = await this.#latest(subject);
      if (current?.status === "PENDING") {
        throw new AlreadyPending("This subject already has a pending submission.");
      }
      if (current?.status === "APPROVED") {
        throw new AlreadyApproved("This subject already has an approved submission.");
      }

      const submission = crypto.randomUUID();
      try {
        await submissions.insertOne({
          _id: submission,
          attempt: (current?.attempt ?? 0) + 1,
          person,
          subject,
          photo,
          criteria,
          ...(baseline && { baseline }),
          selectedMethod: method,
          reviewMethod: method,
          status: "PENDING",
          submittedAt,
          feedback: "",
        });
        return { submission };
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
        // A concurrent insert won the next attempt number. Check its state before retrying.
      }
    }
  }

  async #changePending(
    submission: string,
    decide: (reviewMethod: ReviewMethod) => ReviewUpdate | undefined,
  ): Promise<ReviewResult> {
    const submissions = this.#submissions();
    while (true) {
      const current = await submissions.findOne({ _id: submission });
      if (!current) throw new SubmissionNotFound("This submission does not exist.");
      if (current.status !== "PENDING") {
        throw new AlreadyReviewed("This submission already has a final decision.");
      }

      const result = { submission, subject: current.subject, person: current.person };
      const update = decide(current.reviewMethod);
      if (!update) return result;

      // Write only if the submission still has the state we read. Otherwise, recheck the latest state.
      const changed = await submissions.updateOne(
        { _id: submission, status: "PENDING", reviewMethod: current.reviewMethod },
        { $set: update },
      );
      if (changed.matchedCount === 1) return result;
    }
  }

  async approve({ submission, reviewer, method, feedback }: SubmissionRef & {
    reviewer: string;
    method: ReviewMethod;
    feedback: string;
  }): Promise<ReviewResult> {
    return this.#changePending(submission, (reviewMethod) => {
      if (method !== reviewMethod) {
        throw new WrongReviewMethod("This submission is awaiting a different review method.");
      }
      return { status: "APPROVED", reviewer, reviewedAt: new Date(), feedback };
    });
  }

  async reject({ submission, reviewer, reason }: SubmissionRef & {
    reviewer: string;
    reason: string;
  }): Promise<ReviewResult> {
    return this.#changePending(submission, (reviewMethod) => {
      if (reviewMethod === "AUTOMATIC") {
        throw new ManualReviewRequired("This submission must move to manual review before rejection.");
      }
      if (!reason.trim()) throw new MissingReason("Explain why the submission was rejected.");
      return { status: "REJECTED", reviewer, reviewedAt: new Date(), feedback: reason };
    });
  }

  async sendToOverseer({ submission }: SubmissionRef): Promise<SubmissionRef> {
    await this.#changePending(submission, (reviewMethod) => {
      // Preserve the resident's original choice and keep the submission pending for manual review.
      if (reviewMethod === "AUTOMATIC") return { reviewMethod: "MANUAL" };
    });
    return { submission };
  }

  async _current({ subject }: { subject: string }): Promise<SubmissionRef[]> {
    const current = await this.#latest(subject);
    return current ? [{ submission: current._id }] : [];
  }

  async _submission({ submission }: SubmissionRef): Promise<SubmissionDetails[]> {
    const row = await this.#submissions().findOne<SubmissionDetails>(
      { _id: submission }, { projection: { _id: 0, attempt: 0 } },
    );
    if (!row) return [];
    // Earlier submissions used an empty string when the chore had no reference photo.
    if (row.baseline === "") delete row.baseline;
    return [row];
  }

  async _history({ subject }: { subject: string }): Promise<HistoryRow[]> {
    return this.#submissions().aggregate<HistoryRow>([
      { $match: { subject } },
      { $sort: { attempt: -1 } },
      { $project: { _id: 0, submission: "$_id", status: 1, submittedAt: 1, reviewedAt: 1, feedback: 1 } },
    ]).toArray();
  }

  async _pending({ method }: { method: ReviewMethod }): Promise<PendingRow[]> {
    // A pending attempt is always current because another attempt requires a rejection first.
    return this.#submissions().aggregate<PendingRow>([
      { $match: { status: "PENDING", reviewMethod: method } },
      { $sort: { submittedAt: 1, _id: 1 } },
      { $project: { _id: 0, submission: "$_id", subject: 1, person: 1, submittedAt: 1 } },
    ]).toArray();
  }
}
