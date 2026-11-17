# Completion Checking

Completion Checking connects a resident’s submitted photo to their assigned task, its review decision, and contribution credit.

PhotoChecking stores submissions and decisions. TaskTracking records task completion. Ranking records contribution credit. Reasoning holds questions and answers for optional AI review.

## Submitting a completed task

A signed-in resident can submit evidence for an active task assigned to them in their household.[submit-access] The submission endpoint checks the session and assignment before recording the photo.[submit] The session identifies the submitter, so a resident cannot submit under another person’s identity.

The resident opens the task to see its completion criteria, photo instructions, and baseline image. Submitting records the photo, submission time, a saved copy of the criteria, and baseline for that attempt. Later changes to the task’s instructions do not change how an existing submission is reviewed.

A new submission starts as pending. Submitting a photo does not mark the task complete or award a point. A task with a pending or approved submission cannot receive another submission. If a submission is rejected, the resident can address the reason and submit another attempt.

Manual submissions enter the Overseer’s review queue without creating a Reasoning request.

[submit-access]: view:CompletionChecking.CanSubmit
[submit]: reaction:CompletionChecking.Submit

```endpoints
CompletionChecking.Submit at /completion/submit
```

## Reading submissions

Residents can read their own submissions. Overseers can read submissions for households they oversee.[read-access] Other residents cannot open someone else’s submission.

The completion endpoint checks access before returning the task and its submissions.[get] The current submission includes its photo, status, feedback, submission time, and review time.[details] Review time is empty while the submission is pending. Earlier attempts and their decisions appear in the submission history.[history]

Submission time and review time remain separate. A resident who submitted before the deadline can show that even if the Overseer reviews it afterward.

Unauthorized requests return `NOT_FOUND` without revealing another household’s tasks or photos.

[read-access]: view:CompletionChecking.CanRead
[get]: reaction:CompletionChecking.GetCompletion
[details]: former:CompletionChecking.CompletionDetails
[history]: former:CompletionChecking.SubmissionHistory

```endpoints
CompletionChecking.GetCompletion at /completion/get
```

## Approving or rejecting a submission

Only an Overseer for the submission’s household can review it.[review-access] The review endpoint checks the session and this permission before recording a decision.[review]

The review queue lists current submissions awaiting manual review in that household.[queue] Each item includes the resident, task, photo, completion criteria, baseline, and submission time.[queue-details] The Overseer can inspect the evidence and approve or reject it from the same screen.

Approval records the reviewer and review time. Rejection also requires a reason explaining what needs to be corrected or shown more clearly. The resident sees that reason and can submit another attempt. The rejected submission and its feedback remain in the history.

Only pending submissions can receive a decision. An approved submission cannot be withdrawn, changed, or reviewed again. A rejected submission keeps its decision; another attempt creates a new submission.

[review-access]: view:CompletionChecking.CanReview
[review]: reaction:CompletionChecking.Review
[queue]: reaction:CompletionChecking.ListReviewQueue
[queue-details]: former:CompletionChecking.ReviewQueue

```endpoints
CompletionChecking.Review at /completion/review
CompletionChecking.ListReviewQueue at /completion/review-queue
```

## Completion and contribution credit

Approving the current submission records the task as complete in TaskTracking.[complete] The completion identifies the supporting submission and keeps both its submission and approval times. A rejected or pending submission does not complete the task.

Recording task completion gives the submitting resident one point through Ranking.[credit] The point belongs to the specific task occurrence, rather than each photo or review. Repeated processing of the same approval does not award extra points. Completing another occurrence of the same chore can earn another point.

[complete]: reaction:CompletionChecking.RecordCompletion
[credit]: reaction:CompletionChecking.AwardCredit

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

## Notes

Alpha supports photo submission, manual approval or rejection, completion tracking, and contribution credit. Beta adds optional AI review.

Household access and role checks belong in the composition. PhotoChecking uses generic people and subjects without depending on household roles.

The TaskTracking action names and completion events must be agreed on with its designer. Ranking must prevent duplicate credit for the same task occurrence.
