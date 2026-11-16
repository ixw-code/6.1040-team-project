# Development Plan

| Stage | Deliverables
| --- | --- |
| Alpha Checkpoint - Nov 23 | - A deployed web app that supports the manual review workflow.<br>- The Overseer can create assignments with deadlines, completion criteria, and baseline photos.<br>- Members are able to submit photos for review, the Overseer can approve or reject them with reason. Approval updates the completion status.<br>- The members are able to set their availability and preferences for chores and then get assigned randomly based on the provided information.<br>- Baseline with no AI integration yet. |
| Beta Checkpoint - Nov 30 | - Add AI integration to complete the workflow for AI photo review with feedback for Overseer if the result is uncertain.<br>- Allow opt out option for members who prefer to get manual review by the Overseer. |
| User Testing - Dec 7 | - Test on a small scale with a chore and members to compare to current work flow, observe points of confusion, and record incorrect decisions from the AI photo review.<br>- Fix significant issues before the final demo. |

## Responsibilities

* Ivan: ChoreCataloguing, TaskTracking (Ada support on both)
* Hunnaid: CompletionChecking, PhotoTracking, Reasoning, Ranking (Rowan support on both)
* Ada: ChoreAssignments, Scheduling (Ivan support on both)
* Rowan: Copying User & Roling stuff over, Bounties, UI design (Ada support on UI)

Users, Authenticating, Sessioning, Registering, and Roling can be adapted/copied from previous designs.

These represent primary responsibility. Everyone will contribute approximately equally to the design, implementation, and code review.

## Risk & fallback options

* Photos are reused or do not show enough of the completed chore.
    - Mitigation: Provide clear photo instructions and a baseline example showing the expected result. Let members preview and retake photos if needed. Taking a photo in the app reduces the risk of someone reusing a photo.
    - Fallback: The Overseer can reject the photo and request another photo or a better angle.
* AI integration becomes unreliable.
    - Mitigation: Test complete, incomplete, and badly framed against the Overseer’s judgement. Send uncertain results for manual review and let the Overseer correct decisions.
    - Fallback: Disable automatic approval and use AI only for suggestions, or return to the manual workflow established in the Alpha.
* Time saved between manually verifying and AI reviewing is little to none.
    - Mitigation: Compare the current process, the app’s manual review queue, and AI review. Consider the number of times AI is uncertain when comparing whether AI is useful or not for review.
    - Fallback: Focus on the manual review workflow, where photos, assignments, and completion decisions stay together. Keep AI optional if it doesn’t provide a significant benefit.
