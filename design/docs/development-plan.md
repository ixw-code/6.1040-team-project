# Development Plan (Beta)

| Stage | Deliverables |
| --- | --- |
| **Alpha Checkpoint – Nov 23** | - Deployed app with integrated Bun/MongoDB backend and Vue frontend with authentication, household management, scheduling, and manual photo-review infrastructure.<br>- Resident interfaces for tasks, availability, preferences, calendar, photo submissions, and swaps, currently using mock data.<br>- Overseer review queue and household creation interface.<br>- Remaining work: resolve API mismatches, complete missing frontend functionality, and verify the full manual workflow end-to-end. |
| **Beta Checkpoint – Dec 2** | - Complete and validate frontend/backend integration for household management, chore creation, scheduling, and photo verification.<br>- Complete CompletionChecking composition with task details, review, and review queues.<br>- Implement AI-assisted photo review through Reasoning, with feedback and referral of uncertain results to the Overseer.<br>- Support opt-in AI review with manual review always available.<br>- Polish existing frontend screens, ensure complete connection to household, scheduling, availability, preference, photo upload, and completion APIs.<br>- Add support for swap interactions through new Trading concept. |
| **User Testing – Dec 7** | - Test the complete workflow with a small household: create chores, set availability, schedule tasks, submit photos, and review completion.<br>- Compare AI and manual review accuracy, speed, and usability.<br>- Record incorrect decisions, confusing interactions, and integration failures.<br>- Fix significant issues before the final demonstration. |

## Responsibilities

* **Ivan:** AI verification (Reasoning), consent integration, and AI review frontend.
* **Hunnaid:** Household and chore management interfaces, frontend/backend API integration.
* **Ada:** CompletionChecking integration, PhotoChecking, Ranking, and manual review workflow.
* **Rowan:** Task scheduling interfaces, availability and preferences, resident UI polish.
* **Everyone:** Participate in end-to-end user testing to examine clunky, missing, or broken functionality.

Existing Registering, Authenticating, HouseholdManaging, ChoreCataloguing, and TaskScheduling implementations should be reused rather than redesigned. Recurring chores, notifications, and bounties are currently lower-priority extensions. If it seems likely, they will be appended to the Beta scope.

These represent primary responsibilities. Everyone will contribute approximately equally to design, implementation, testing, and code review.

## Risks and Fallback Options

| Risk | Mitigation | Fallback |
|---|---|---|
| Resident screens still use mock data. | Connect the core screens to the live scheduling, photo upload, and completion APIs first. Verify the browser workflow from task assignment through resident submission and overseer review. | Limit the demo to workflows verified against the live backend. |
| Migrating the remaining completion routes could break approval retries or evidence access. | Test that only authorized users can view evidence, retries use the original submission time, and each task earns credit once even after a partial failure. | Keep the existing HTTP routes for task details, review, and the review queue until their replacements pass the same tests. |
| AI review may be unreliable or unfinished. | Keep AI review opt-in. Compare assessments with human decisions, and route uncertain, failed, or malformed assessments to the overseer. Test that withdrawing consent stops pending AI review. | Disable AI review and use the manual review workflow. |
| Photos may be reused or may fail to show the completed chore. | Give residents clear criteria, baseline examples where available, and a preview before submitting. | Let the overseer reject the attempt with feedback and let the resident submit new evidence. |
| Optional work may delay the core Beta workflow. | Prioritize household and chore setup, scheduling, resident submission, and overseer review before adding optional features. | Defer swaps, recurring chores, notifications, and bounties. |
