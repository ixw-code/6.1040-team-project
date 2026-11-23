<!-- Generated from the Shift Happens assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Shift Happens — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### PhotoChecking

Defined in [PhotoChecking](../design/concepts/PhotoChecking.md), line 1.

#### Actions

- `submit(person: Person, subject: Subject, photo: Photo, criteria: String, baseline: Photo, method: ReviewMethod) : returns (submission: Submission)`
  - Refuses `ALREADY_PENDING`: This subject already has a pending submission.
  - Refuses `ALREADY_APPROVED`: This subject already has an approved submission.
- `approve(submission: Submission, reviewer: Reviewer, method: ReviewMethod, feedback: String) : returns (submission: Submission, subject: Subject, person: Person)`
  - Refuses `NOT_FOUND`: This submission does not exist.
  - Refuses `ALREADY_REVIEWED`: This submission already has a final decision.
  - Refuses `WRONG_REVIEW_METHOD`: This submission is awaiting a different review method.
- `reject(submission: Submission, reviewer: Reviewer, reason: String) : returns (submission: Submission, subject: Subject, person: Person)`
  - Refuses `NOT_FOUND`: This submission does not exist.
  - Refuses `ALREADY_REVIEWED`: This submission already has a final decision.
  - Refuses `MANUAL_REVIEW_REQUIRED`: This submission must move to manual review before rejection.
  - Refuses `MISSING_REASON`: Explain why the submission was rejected.
- `sendToOverseer(submission: Submission) : returns (submission: Submission)`
  - Refuses `NOT_FOUND`: This submission does not exist.
  - Refuses `ALREADY_REVIEWED`: This submission already has a final decision.

#### Queries

- `_current(subject: Subject) : optional (submission: Submission)`
- `_submission(submission: Submission) : optional (person: Person, subject: Subject, photo: Photo, criteria: String, baseline: Photo, selectedMethod: ReviewMethod, reviewMethod: ReviewMethod, status: Status, submittedAt: DateTime, reviewer?: Reviewer, reviewedAt?: DateTime, feedback: String)`
- `_history(subject: Subject) : many (submission: Submission, status: Status, submittedAt: DateTime, reviewedAt?: DateTime, feedback: String)`
- `_pending(method: ReviewMethod) : many (submission: Submission, subject: Subject, person: Person, submittedAt: DateTime)`

#### Instances

- `PhotoChecking` — instance of `PhotoChecking` — [Shift Happens Application Types](../design/types.md), line 26.
  - `Person` is `Person` — [Shift Happens Application Types](../design/types.md), line 27.
  - `Photo` is `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 29.
  - `Reviewer` is `ReviewerIdentity` — [Shift Happens Application Types](../design/types.md), line 30.
  - `Subject` is `TaskOccurrence` — [Shift Happens Application Types](../design/types.md), line 28.

### Ranking

Defined in [Ranking](../design/concepts/Ranking.md), line 1.

#### Actions

- `credit(group: Group, person: Person, contribution: Contribution) : returns (group: Group, contribution: Contribution)`

#### Queries

- `_score(group: Group, person: Person) : one (score: Number)`
- `_ranking(group: Group) : many (person: Person, score: Number, rank: Number)`

#### Instances

- `Ranking` — instance of `Ranking` — [Shift Happens Application Types](../design/types.md), line 21.
  - `Contribution` is `TaskOccurrence` — [Shift Happens Application Types](../design/types.md), line 24.
  - `Group` is `Household` — [Shift Happens Application Types](../design/types.md), line 22.
  - `Person` is `Person` — [Shift Happens Application Types](../design/types.md), line 23.

## Application types

Concrete types:

- `Household` — [Shift Happens Application Types](../design/types.md), line 4.
- `Person` — [Shift Happens Application Types](../design/types.md), line 7.
- `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 13.
- `ReviewerIdentity` — [Shift Happens Application Types](../design/types.md), line 16.
- `TaskOccurrence` — [Shift Happens Application Types](../design/types.md), line 10.

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

