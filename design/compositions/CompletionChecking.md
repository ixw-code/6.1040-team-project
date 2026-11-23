# Completion Checking

Completion Checking connects a resident’s submitted photo to their assigned task, its review decision, and contribution credit.

PhotoChecking stores submissions and decisions. TaskTracking records task completion. Ranking records contribution credit. Reasoning holds questions and answers for optional AI review.

## Submitting a completed task

A signed-in resident can submit evidence for an active task assigned to them in their household. The submission endpoint checks the session and assignment before recording the photo. The session identifies the submitter, so a resident cannot submit under another person’s identity.

The resident opens the task to see its completion criteria, photo instructions, and baseline image. Submitting records the photo, submission time, a saved copy of the criteria, and baseline for that attempt. Later changes to the task’s instructions do not change how an existing submission is reviewed.

A new submission starts as pending. Submitting a photo does not mark the task complete or award a point. A task with a pending or approved submission cannot receive another submission. If a submission is rejected, the resident can address the reason and submit another attempt.

Manual submissions enter the Overseer’s review queue without creating a Reasoning request.

## Reading submissions

Residents can read their own submissions. Overseers can read submissions for households they oversee. Other residents cannot open someone else’s submission.

The completion endpoint checks access before returning the task and its submissions. The `current` list holds at most one visible submission with its photo, status, feedback, submission time, and review time. Review time is empty while the submission is pending. Earlier attempts and their decisions appear in the submission history. Each record is checked against the reader's household role and the original submitter.

Submission time and review time remain separate. A resident who submitted before the deadline can show that even if the Overseer reviews it afterward.

Unauthorized requests return `NOT_FOUND` without revealing another household’s tasks or photos.

## Approving or rejecting a submission

Only an Overseer for the submission’s household can review it. The review endpoint checks the session and this permission before recording an approval or rejection.

The review queue lists current submissions awaiting manual review in that household. Each item includes the resident, task, photo, completion criteria, baseline, and submission time. The Overseer can inspect the evidence and approve or reject it from the same screen.

Approval records the reviewer and review time. Rejection also requires a reason explaining what needs to be corrected or shown more clearly. The resident sees that reason and can submit another attempt. The rejected submission and its feedback remain in the history.

Only pending submissions can receive a decision. An approved submission cannot be withdrawn, changed, or reviewed again. A rejected submission keeps its decision; another attempt creates a new submission.

## Completion and contribution credit

Approving the current submission calls the task completion hook. The completion identifies the supporting submission and keeps both its submission and approval times. Only an approval completes the task.

Once the hook confirms task completion, Ranking credits the submitting resident one point for that task occurrence. An Overseer can retry an approval to finish recording completion or credit after an interruption. A retry uses the original approval, and each task occurrence earns a single point.

## Manual API

All four endpoints accept JSON via `POST`.

| Path | Fields |
| --- | --- |
| `/api/completion/submit` | `session`, `task`, `photo` |
| `/api/completion/get` | `session`, `task` |
| `/api/completion/review` | `session`, `submission`, `decision`, optional `feedback` |
| `/api/completion/review-queue` | `session`, `household` |

CompletionChecking resolves the caller's session on the server and uses team-provided hooks for roles, task details, and completion. The application returns `UNAUTHORIZED` until those hooks are connected. The automated tests supply temporary data for these dependencies.

## Choosing AI review - Beta

When submitting a photo, the resident chooses manual review or automatic AI review. Manual review sends the submission directly to the Overseer’s review queue. AI review creates an assessment request through Reasoning and requires the resident’s consent.

Residents can turn AI review on or off.[enable][disable] Consenting records their choice under the use `check-chore-photos`. AI review starts as off because no consent exists initially.

The consent check determines whether AI review is allowed.[ai-access] The interface receives the same setting so it can show the resident’s current choice.[ai-setting] Even with AI review enabled, a resident can choose manual review for an individual submission.

Selecting AI review without consent is refused with `NOT_CONSENTED`. Manual and AI approvals give the same completion credit.

Turning AI review off calls `PhotoChecking.sendToOverseer` for pending AI submissions and abandons their waiting assessment requests through `Reasoning.abandon`, recording that AI review was turned off.[withdraw]


[enable]: reaction:CompletionChecking.EnableAI
[disable]: reaction:CompletionChecking.DisableAI
[ai-access]: view:CompletionChecking.AIReviewAllowed
[ai-setting]: former:CompletionChecking.AIReviewSetting
[withdraw]: reaction:CompletionChecking.StopPendingAIReviews

```endpoints
CompletionChecking.EnableAI at /completion/ai/on
CompletionChecking.DisableAI at /completion/ai/off
```

## Assessing photos - Beta

Submitting a photo for AI review creates an assessment request through Reasoning.[ask] The request identifies the specific submission and asks whether its photo meets the saved completion criteria, using the baseline as a reference. An open-request check prevents duplicate assessments of the same attempt.[open]

The checking agent takes the request and retrieves its photo, criteria, and baseline through the evidence endpoint.[evidence] The endpoint authenticates the agent and checks that it currently holds the request.

Evidence is returned only while the task is active, the submission is current and pending AI review, and the resident still consents. Otherwise, the agent stops processing the request.

The agent calls the model and records its answer through Reasoning. The answer must include an `approved` or `needs_review` outcome, a finding for each criterion, and feedback explaining the result.

[ask]: reaction:CompletionChecking.RequestAssessment
[open]: view:CompletionChecking.HasOpenAssessment
[evidence]: reaction:CompletionChecking.ReadAssessmentEvidence

```endpoints
CompletionChecking.ReadAssessmentEvidence at /completion/agent/evidence
```

## Applying assessments - Beta

A completed assessment can approve a submission only when its answer has the expected structure and reports that every criterion is met.[apply] Before applying it, the composition checks again that the task is active, the resident still consents, and the submission is current and pending AI review.

Incomplete or unclear results go to the Overseer for manual review.[refer] Failed or malformed assessments also enter the manual queue. These submissions remain pending; an AI referral does not reject them.

An assessment cannot change an approved or rejected submission, overwrite a human decision, or decide a submission that has moved to manual review.

[apply]: reaction:CompletionChecking.ApplyAssessment
[refer]: reaction:CompletionChecking.ReferForHumanReview
