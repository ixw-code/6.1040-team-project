# Development Plan (Beta)

| Stage | Deliverables |
| --- | --- |
| **Alpha Checkpoint – Nov 23** | - Deployed app with integrated Bun/MongoDB backend and Vue frontend with authentication, household management, scheduling, and manual photo-review infrastructure.<br>- Resident interfaces for tasks, availability, preferences, calendar, photo submissions, and swaps.<br>- Overseer review queue and household creation interface.<br>- Remaining work: resolve API mismatches, complete CompletionChecking hooks, and verify the full manual workflow end-to-end. |
| **Beta Checkpoint – Dec 2** | - Complete frontend/backend integration for household management, chore creation, scheduling, and photo verification.<br>- Connect CompletionChecking with TaskScheduling, HouseholdManaging, PhotoChecking, and Ranking.<br>- Implement AI-assisted photo review through Reasoning, with feedback and referral of uncertain results to the Overseer.<br>- Support opt-in AI review with manual review always available.<br>- Polish existing frontend screens and resolve incomplete functionality, including any unsupported swap interactions. |
| **User Testing – Dec 7** | - Test the complete workflow with a small household: create chores, set availability, schedule tasks, submit photos, and review completion.<br>- Compare AI and manual review accuracy, speed, and usability.<br>- Record incorrect decisions, confusing interactions, and integration failures.<br>- Fix significant issues before the final demonstration. |

## Responsibilities

* **Ivan:** AI verification (Reasoning), consent integration, and AI review frontend (Hunnaid support).
* **Hunnaid:** Household and chore management interfaces, frontend/backend API integration (Ada support).
* **Ada:** CompletionChecking integration, PhotoChecking, Ranking, and manual review workflow (Rowan support).
* **Rowan:** Task scheduling interfaces, availability and preferences, resident UI polish, and end-to-end testing (Ivan support).

Existing Registering, Authenticating, HouseholdManaging, ChoreCataloguing, and TaskScheduling implementations should be reused rather than redesigned. Recurring chores, resident-initiated trading, and notifications are lower-priority extensions.

These represent primary responsibilities. Everyone will contribute approximately equally to design, implementation, testing, and code review.

## Risk & Fallback Options

* **Frontend/backend integration remains incomplete.**
  - Mitigation: Verify actual API contracts, fix CompletionChecking hooks, and prioritize end-to-end testing over new features.
  - Fallback: Limit the demo to working household scheduling and manual photo verification.

* **Photos are reused or do not sufficiently show completed chores.**
  - Mitigation: Provide baseline examples, clear instructions, and photo preview/retake functionality.
  - Fallback: The Overseer can reject submissions and request better evidence.

* **AI verification is unreliable or takes longer than expected.**
  - Mitigation: Compare AI assessments against human decisions and refer uncertain results for manual review.
  - Fallback: Disable automatic approval and use AI only for suggestions, or retain the manual workflow.

* **Optional features delay core functionality.**
  - Mitigation: Prioritize household management, scheduling, submission, and review.
  - Fallback: Defer swaps, recurring assignments, and notifications until after the final demonstration.
