# Concepts that make up *Shift Happens*

The concept map shows the original design for *Shift Happens*. The core features below describe the Alpha implementation.

![Concept Map](../attachments/concept-map.png)

## Core features

### Households and the chore catalog

An overseer creates a household and adds residents by username. `HouseholdManaging` records membership, the household's overseer, and each resident's preferred order of chores. `ChoreCataloguing` stores reusable chores with a description, an effort rating, completion criteria, and an optional baseline photo that shows residents what their evidence should capture. Each resident ranks a catalog chore once, even when several tasks use it. [Household Management](../compositions/HouseholdManagement.md)

### Availability and assignments

`ChoreAssignments` connects the catalog to `TaskScheduling` to address **unclear assignments** and **uneven workloads**. An overseer creates an assignment for a specific day or a date range and can repeat that window weekly through a chosen end date. A series appears as one assignment in **Manage**. The same resident is assigned to its open occurrences, each with its own submission window and completion record.

Residents mark each weekday Available, Somewhat available, or Not available. For a date range, a resident can qualify on any permitted day. The overseer can choose an assignee or use **Manage → Assign available residents** for the selected week. Automatic assignment tries Available residents first and considers Somewhat available residents when needed. Within each availability level it weighs workload, chore effort, and chore preferences. [Chore Assignments](../compositions/ChoreAssignments.md)

Only the overseer can delete chores or assignments. Deleting a chore hides it from the catalog and preferences while preserving its details for existing tasks. Deleting a weekly assignment removes the series from the schedule and preserves reviewed evidence and credit.

### Evidence review and credit

`CompletionChecking` connects the task to photo evidence so the overseer can verify completion in the app. Its Sync Engine submit reaction verifies the assignment, photo ownership, and that the occurrence's scheduled window is open. `PhotoChecking` saves the submitted photo, criteria, and any baseline used for that attempt. The overseer can approve the photo or reject it with feedback. A resident can resubmit after rejection while the window is open.

On approval, `TaskScheduling` records the original submission time as the completion time. `PhotoChecking` keeps the submission and its separate review time. `Ranking` awards the submitting resident one point per approved occurrence. Overseers can see past decisions in **Reviewed** and household points in **Manage**. [Completion Checking](../compositions/CompletionChecking.md)

## Planned extensions

Possible Beta extensions include opt-in AI review through `Reasoning`, persistent swaps through `Trading`, scheduled weekly runs, and more granular permissions through `Roling`. In Alpha, overseers review evidence, run weekly scheduling, and handle swaps by reassigning tasks.

## Bonus features

The orange boxes on the concept map represent second-priority features. If the other features are working, we will add:

`Reminding` to notify users if the deadline for their chore is approaching and it is still incomplete.

`Rewarding` would include household-determined rewards, such as extra rank or a discount on utilities (for example), to users who complete a particular set of chores or a quantity of chores.

`Bounties`, which are like making a pact between users to do extra chores, combine either rewards from `Rewarding` with chore completion, or two users' chore completion together. For example, Alice can post a bounty saying, "I will wash all the dishes if someone will clear all the drying racks before I get home at 6pm." `BountyPosting` tracks the bounty's creation and progress, and `Rewarding` associates any additional rewards to it.

`Posting` is another bonus concept that would allow a Venmo-like feed for residents to view and react to each others' chores. This is meant to diminish the impersonal nature of a chore-tracking app over accountability via human interaction, and promote gratitude within the community.

# Potential issues

Two light chores can represent less work than one difficult chore. `TaskScheduling` uses the overseer's effort ratings to balance workload. `Ranking` awards one point per approved task occurrence. User testing can show whether the effort ratings produce a workload residents find fair.
