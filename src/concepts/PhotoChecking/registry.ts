import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/PhotoChecking.md" with { type: "text" };
import {
  AlreadyApproved,
  AlreadyPending,
  AlreadyReviewed,
  ManualReviewRequired,
  MissingReason,
  PhotoCheckingConcept,
  SubmissionNotFound,
  WrongReviewMethod,
} from "./PhotoChecking.ts";

// Sync-engine uses the spec and these error classes to return the declared refusal codes.
export const photoChecking = registerConcept({
  class: PhotoCheckingConcept,
  spec,
  refusals: {
    ALREADY_PENDING: AlreadyPending,
    ALREADY_APPROVED: AlreadyApproved,
    NOT_FOUND: SubmissionNotFound,
    ALREADY_REVIEWED: AlreadyReviewed,
    WRONG_REVIEW_METHOD: WrongReviewMethod,
    MANUAL_REVIEW_REQUIRED: ManualReviewRequired,
    MISSING_REASON: MissingReason,
  },
});
