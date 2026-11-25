# Completion Checking

Completion Checking connects a resident’s submitted photo to their assigned task, its review decision, and contribution credit.

PhotoChecking stores submissions and decisions. TaskScheduling records task completion. Ranking records contribution credit. Reasoning holds questions and answers for optional AI review.

## Submitting a completed task

A signed-in resident can submit evidence for an active task assigned to them in their household. The submission endpoint checks the session and assignment before recording the photo. The session identifies the submitter, so a resident cannot submit under another person’s identity.

The server accepts evidence from the scheduled start through the scheduled end of that task occurrence. Each occurrence of a weekly assignment has its own window. The reaction refuses early submissions with `SUBMISSION_NOT_OPEN` and late submissions with `SUBMISSION_CLOSED`. Both map to HTTP 409 `CONFLICT`. The server records the time it used to make this check.

The resident uploads the image first and receives a photo ID. Submitting that ID attaches the stored image to the task after CompletionChecking verifies that the signed-in resident uploaded it.

The resident opens the task to see its completion criteria and photo instructions. The overseer can provide a baseline photo as a guide. PhotoChecking saves each attempt’s photo, submission time, criteria, and any available baseline reference so the review uses the criteria and reference from that attempt.

A new submission starts as pending. Submitting a photo does not mark the task complete or award a point. A task with a pending or approved submission cannot receive another submission. If a submission is rejected, the resident can address the reason and submit another attempt while that occurrence’s window is still open.

Manual submissions enter the Overseer’s review queue without creating a Reasoning request.

## Reading submissions

Residents can read their own submissions. Overseers can read submissions for households they oversee. Other residents cannot open someone else’s submission.

The completion endpoint checks access before returning the task and its submissions. The `current` list holds at most one visible submission with its photo, status, feedback, submission time, and review time. Review time is empty while the submission is pending. Earlier attempts and their decisions appear in the submission history. Each record is checked against the reader's household role and the original submitter.

Submission time and review time remain separate. A resident who submitted before the deadline can show that even if the Overseer reviews it afterward.

Unauthorized requests return `NOT_FOUND` without revealing another household’s tasks or photos.

The image route takes a submission ID and checks the submission's household before returning the original image. The submitting resident and the household's Overseer can open the image through this route.

## Approving or rejecting a submission

Only an Overseer for the submission’s household can review it. The review endpoint checks the session and this permission before recording an approval or rejection.

The review queue lists current submissions awaiting manual review in that household. Each item includes the resident, task, photo, completion criteria, and submission time. When the attempt has a baseline, the queue shows it alongside the submitted photo. The Overseer can inspect the evidence and approve or reject it from the same screen.

Approval records the reviewer and review time. Rejection also requires a reason explaining what needs to be corrected or shown more clearly. The resident sees that reason and can submit another attempt while the window is open. The rejected submission and its feedback remain in the history.

Only pending submissions can receive a decision. An approved submission cannot be withdrawn, changed, or reviewed again. A rejected submission keeps its decision; another attempt creates a new submission.

## Completion and contribution credit

Approving the current submission calls the task completion hook. TaskScheduling stores `completedBy` and `completedAt` on the task, using the original `submittedAt` value for `completedAt`. PhotoChecking stores the submission ID, the task ID as `subject`, and the `submittedAt` and `reviewedAt` timestamps. Only an approval completes the task.

Once the hook confirms task completion, Ranking credits the submitting resident one point for that task occurrence. An Overseer can retry an approval to finish recording completion or credit after an interruption. A retry uses the original approval, and each task occurrence earns a single point.

## Manual API

CompletionChecking uses the login cookie to identify the caller. `POST` routes accept JSON.

| Method | Path | Fields |
| --- | --- | --- |
| `POST` | `/api/completion/submit` | `task`, uploaded `photo` ID |
| `POST` | `/api/completion/get` | `task` |
| `POST` | `/api/completion/review` | `submission`, `decision`, optional `feedback` |
| `POST` | `/api/completion/review-queue` | `household` |
| `POST` | `/api/completion/reviewed` | `household` |
| `GET` | `/api/completion/submissions/:submission/baseline` | saved baseline, or `404` when the attempt has no baseline |
| `GET` | `/api/completion/submissions/:submission/photo` | `submission` in the path |

The application reads tasks and assignments from TaskScheduling, membership and oversight from HouseholdManaging, and evidence instructions from ChoreCataloguing.

## Registered manual submission

The [Submit endpoint](reaction:CompletionChecking.Submit) uses the [CanSubmit view](view:CompletionChecking.CanSubmit) to verify that the signed-in resident is assigned to an active, incomplete task with a scheduled window and owns the uploaded photo. Missing or unauthorized resources return `NOT_FOUND`. The reaction binds the server’s current instant, checks the scheduled window, and passes that same instant to `PhotoChecking.submit`.

```endpoints
CompletionChecking.Submit at /completion/submit
```

```computations
evidenceInstructions(requirements: Requirements, references: Photos) : EvidenceInstructions
  Joins the current requirements and selects the first baseline reference when supplied.
evidenceWindow(interval: Interval, submittedAt: DateTime) : EvidenceWindow
  Determines whether the submitted time is before, inside, or after the occurrence’s scheduled interval, including both endpoints.
```

## Choosing AI review - Beta

When submitting a photo, the resident chooses manual review or automatic AI review. Manual review sends the submission directly to the Overseer’s review queue. AI review creates an assessment request through Reasoning and requires the resident’s consent.

Residents can turn AI review on or off. (`CompletionChecking.EnableAI`) (`CompletionChecking.DisableAI`) Consenting records their choice under the use `check-chore-photos`. AI review starts as off because no consent exists initially.

The consent check determines whether AI review is allowed. (`CompletionChecking.AIReviewAllowed`) The interface receives the same setting so it can show the resident’s current choice. (`CompletionChecking.AIReviewSetting`) Even with AI review enabled, a resident can choose manual review for an individual submission.

Selecting AI review without consent is refused with `NOT_CONSENTED`. Manual and AI approvals give the same completion credit.

Turning AI review off calls `PhotoChecking.sendToOverseer` for pending AI submissions and abandons their waiting assessment requests through `Reasoning.abandon`, recording that AI review was turned off. (`CompletionChecking.StopPendingAIReviews`)

```text
CompletionChecking.EnableAI at /completion/ai/on
CompletionChecking.DisableAI at /completion/ai/off
```

## Assessing photos - Beta

Submitting a photo for AI review creates an assessment request through Reasoning. (`CompletionChecking.RequestAssessment`) The request identifies the specific submission and asks whether its photo meets the saved completion criteria, using the baseline as a reference when provided. An open-request check prevents duplicate assessments of the same attempt. (`CompletionChecking.HasOpenAssessment`)

The checking agent takes the request and retrieves its photo, criteria, and any baseline through the evidence endpoint. (`CompletionChecking.ReadAssessmentEvidence`) The endpoint authenticates the agent and checks that it currently holds the request.

Evidence is returned only while the task is active, the submission is current and pending AI review, and the resident still consents. Otherwise, the agent stops processing the request.

The agent calls the model and records its answer through Reasoning. The answer must include an `approved` or `needs_review` outcome, a finding for each criterion, and feedback explaining the result.

```text
CompletionChecking.ReadAssessmentEvidence at /completion/agent/evidence
```

## Applying assessments - Beta

A completed assessment can approve a submission only when its answer has the expected structure and reports that every criterion is met. (`CompletionChecking.ApplyAssessment`) Before applying it, the composition checks again that the task is active, the resident still consents, and the submission is current and pending AI review.

Incomplete or unclear results go to the Overseer for manual review. (`CompletionChecking.ReferForHumanReview`) Failed or malformed assessments also enter the manual queue. These submissions remain pending; an AI referral does not reject them.

An assessment cannot change an approved or rejected submission, overwrite a human decision, or decide a submission that has moved to manual review.
