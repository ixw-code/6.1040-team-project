# PhotoChecking

## Purpose

Let people submit photo evidence for a task and receive an approval or rejection with feedback.

*Prevents:* a submission loses its connection to the work it represents; someone receives a rejection without an explanation; a final decision is overwritten; another attempt removes the earlier submission.

## Principle

Alice submits a photo showing her completed task and chooses manual review. The submission is pending until an Overseer reviews it. The Overseer rejects it because dishes remain in the sink and records that as the reason.

Alice reads the feedback, finishes the work, and submits another photo. The earlier attempt and its rejection stay in the history. The Overseer approves the new submission. Another submission for the same task is refused automatically because it is already marked as approved.

Sam chooses automatic review. If the automated reviewer can approve his submission, it records approval. Otherwise, the submission moves to manual review and remains pending until a human approves or rejects it.

In Shift Happens, each subject is a specific task occurrence. The composition supplies the completion criteria validated when the chore was created.

## Types

```types
external Person
  The person submitting evidence.

external Subject
  The item or occurrence the evidence concerns.

external Photo
  A reference to a photo.

external Reviewer
  The person or automated reviewer making a decision.

ReviewMethod is MANUAL or AUTOMATIC

Status is PENDING or APPROVED or REJECTED
```

## State

```state
a set of Submissions with
  a person Person
  a subject Subject
  a photo Photo
  a criteria String
  a baseline Photo
  a selectedMethod ReviewMethod
  a reviewMethod ReviewMethod
  a status Status
  a submittedAt DateTime
  an optional reviewer Reviewer
  an optional reviewedAt DateTime
  a feedback String

Rule: each Subject has at most one current Submission.

Rule: a new submission starts pending with empty feedback, no reviewer, and no review time.

Rule: selectedMethod records the person's original choice. reviewMethod records how the submission is currently being reviewed.

Rule: a pending automatic submission can move to manual review. It cannot move back to automatic review.

Rule: approved and rejected submissions cannot be changed.

Rule: a new attempt becomes the current submission, earlier submissions remain in the history.

Rule: a submission's person, subject, photo, criteria, baseline, selectedMethod, and submission time do not change after submission.
```

## Actions

```actions
submit(person: Person, subject: Subject, photo: Photo, criteria: String, baseline: Photo, method: ReviewMethod, submittedAt?: DateTime) : returns (submission: Submission)
    where the subject's current submission is pending
    then
      refuses ALREADY_PENDING "This subject already has a pending submission."

    where the subject's current submission is approved
    then
      refuses ALREADY_APPROVED "This subject already has an approved submission."

    where the subject has no current submission or its current submission is rejected
    then
      add a new submission with person, subject, photo, criteria,
        baseline, selectedMethod method, reviewMethod method,
        status pending, the submission time supplied by the composition or now if omitted, and empty feedback
      make the new submission current for subject
      preserve earlier submissions
      returns submission

approve(submission: Submission, reviewer: Reviewer, method: ReviewMethod, feedback: String) : returns (submission: Submission, subject: Subject, person: Person)
  where submission does not exist
  then
    refuses NOT_FOUND "This submission does not exist."

  where submission exists and is not pending
  then
    refuses ALREADY_REVIEWED "This submission already has a final decision."

  where submission is pending and method does not match its reviewMethod
  then
    refuses WRONG_REVIEW_METHOD "This submission is awaiting a different review method."

  where submission is pending and method matches its reviewMethod
  then
    set its status to approved
    set its reviewer to reviewer
    set its reviewedAt to now
    set its feedback to feedback
    returns submission, subject, person

reject(submission: Submission, reviewer: Reviewer, reason: String) : returns (submission: Submission, subject: Subject, person: Person)
  where submission does not exist
  then
    refuses NOT_FOUND "This submission does not exist."

  where submission exists and is not pending
  then
    refuses ALREADY_REVIEWED "This submission already has a final decision."

  where submission is pending and its reviewMethod is automatic
  then
    refuses MANUAL_REVIEW_REQUIRED "This submission must move to manual review before rejection."

  where submission is pending and its reviewMethod is manual and reason is blank
  then
    refuses MISSING_REASON "Explain why the submission was rejected."

  where submission is pending and its reviewMethod is manual and reason is not blank
  then
    set its status to rejected
    set its reviewer to reviewer
    set its reviewedAt to now
    set its feedback to reason
    returns submission, subject, person


sendToOverseer(submission: Submission) : returns (submission: Submission)
  where submission does not exist
  then
    refuses NOT_FOUND "This submission does not exist."

  where submission exists and is not pending
  then
    refuses ALREADY_REVIEWED "This submission already has a final decision."

  where submission is pending and its reviewMethod is manual
  then
    returns submission

  where submission is pending and its reviewMethod is automatic
  then
    set its reviewMethod to manual
    returns submission
```

## Queries

```queries
_current(subject: Subject) : optional (submission: Submission)
  Returns the subject's current submission, or no row if it has none.

_submission(submission: Submission) : optional (person: Person, subject: Subject, photo: Photo, criteria: String, baseline: Photo, selectedMethod: ReviewMethod, reviewMethod: ReviewMethod, status: Status, submittedAt: DateTime, reviewer?: Reviewer, reviewedAt?: DateTime, feedback: String)
  Returns the submission's evidence and review details, or no row if it does not exist.

_history(subject: Subject) : many (submission: Submission, status: Status, submittedAt: DateTime, reviewedAt?: DateTime, feedback: String)
  Returns all submissions for the subject, newest attempt first, or no rows when there are none.

_pending(method: ReviewMethod) : many (submission: Submission, subject: Subject, person: Person, submittedAt: DateTime)
  Returns current pending submissions awaiting the given review method, oldest first.
  Breaks timestamp ties by submission identifier. Returns no rows when none match.
```
