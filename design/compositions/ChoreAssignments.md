# Chore Assignments

Chore Assignments turns a household's catalogued chores into dated tasks and assigns each task to a resident who is available for it. It spreads the work fairly by difficulty.

ChoreCataloguing stores reusable chores with their difficulty weight, requirements, and reference photos. TaskScheduling stores each dated task, its deadline and optional scheduled interval, assignee, and completion information; it also owns availability and the automatic assignment algorithm. HouseholdManaging stores residents, the overseer, and resident chore rankings.

## Joining and leaving the schedule

When a person becomes a resident of a household through `HouseholdManaging`, they are automatically eligible for automatic chore assignment. The household overseer is also a resident and is eligible for assignment. (Oversight currently handled by HouseholdManaging, while explicit eligibility policies and Roling concept is not yet supported).

When a resident leaves the household or the overseer removes them, they also leave the schedule and their availability and any assigned incomplete tasks need to be cleared. The [ResidentRemoved reaction](reaction:ChoreAssignments.ResidentRemoved) reacts to a successful `HouseholdManaging.removeResident` by invoking `TaskScheduling.removePerson`. The latter clears the resident availability and their incomplete assignments, and returns the freed tasks; completed tasks remain in history. Scheduling can be rerun by the overseer on the freed tasks, or for the next week's assignments. Overseers must transfer their oversight before leaving the household.

The reaction checks that the person is still absent from the household before clearing their schedule. If cleanup fails after the removal succeeds, the overseer can use the [RetryResidentCleanup endpoint](reaction:ChoreAssignments.RetryResidentCleanup) to retry. Repeating cleanup for a former resident is safe. Requests for a current resident are refused with `RESIDENT_STILL_PRESENT`.

```endpoints
ChoreAssignments.RetryResidentCleanup at /assignments/residents/cleanup
```

## Setting availability

A signed-in resident uses [SetWeeklyAvailability](reaction:ChoreAssignments.SetWeeklyAvailability) to select one level for each weekday. Available means routinely able to handle a task on that day. Somewhat available means the resident can sometimes handle a task on that day. Not available excludes them. The [GetWeeklyAvailability endpoint](reaction:ChoreAssignments.GetWeeklyAvailability) reads the saved pattern. The scheduler uses the task’s scheduling time zone when supplied. For a specific day it checks the starting weekday. For a completion window it uses the best availability on any day with time inside that window.

The [add](reaction:ChoreAssignments.AddAvailability) and [remove](reaction:ChoreAssignments.RemoveAvailability) endpoints continue to support legacy interval data for residents who have yet to set a weekly pattern. Removing eligible availability clears affected standalone assignments. Weekly series keep the resident already assigned.

The [can-edit-availability view](view:ChoreAssignments.CanEditAvailability) allows an overseer to edit any current resident's availability and allows residents to edit their own. Removal matches the supplied availability identity against the target resident's availability in that household. Unauthorized requests are refused with `ACCESS_DENIED`; unauthenticated requests with `UNAUTHENTICATED`.

Residents without availability cannot be assigned automatically. The schedule page can warn residents and the overseer when availability is missing. (Through UI behavior, Notifying concept currently isn't supported).

```endpoints
ChoreAssignments.SetWeeklyAvailability at /assignments/availability/weekly/set
ChoreAssignments.GetWeeklyAvailability at /assignments/availability/weekly
ChoreAssignments.EditAvailability at /assignments/availability/edit
ChoreAssignments.AddAvailability at /assignments/availability/add
ChoreAssignments.RemoveAvailability at /assignments/availability/remove
```

## Creating tasks from chores

Only the household overseer can create tasks for their household. The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) checks their authorization. The [ValidHouseholdChore view](view:ChoreAssignments.ValidHouseholdChore) checks that the selected chore belongs to the household and its category is valid when present, using `ChoreCataloguing._get` and `HouseholdManaging`.

The [create-a-task endpoint](reaction:ChoreAssignments.CreateTask) coordinates the permission checks and invokes `TaskScheduling.add` with the chore's identity, category, difficulty weight, and at least one of a deadline and interval. The endpoint reads category and difficulty from the catalogue rather than accepting them in the request. Omission or null clears timing on the respective update endpoint, subject to the task's timing invariants. Later changes to the chore's weight or category in its definition in `ChoreCataloguing` do not change tasks already created. A resident's total reflects the weight each task had when it was created.

The [CreateTaskBatch endpoint](reaction:ChoreAssignments.CreateTaskBatch) creates all dated occurrences of the selected chore in one write. When weekly repetition is selected, the occurrences form one assignment with a shared assignee. Each occurrence keeps its own evidence and completion record. An occurrence can be on a specific day or span a completion window. The browser repeats the entire window weekly and sends the resulting UTC intervals. Weekly occurrences may touch at their endpoints. Overlapping windows are refused. Reusing a request ID within the household returns the task IDs from the original batch.

The [DeleteAssignment endpoint](reaction:ChoreAssignments.DeleteAssignment) removes a standalone assignment or whole weekly series from the schedule. It retains approved evidence and completion records. The overseer can also [remove incomplete tasks](reaction:ChoreAssignments.RemoveTask), [update deadlines](reaction:ChoreAssignments.UpdateDeadline), or [update scheduled intervals](reaction:ChoreAssignments.UpdateInterval). The [AssignmentIsModifiable view](view:ChoreAssignments.AssignmentIsModifiable) checks that the task belongs to the household and is incomplete before allowing modification, and the endpoints use the corresponding `TaskScheduling` actions.

Requests are refused with `TASK_WEIGHT_INVALID` for invalid weights, `TASK_INTERVAL_INVALID` for invalid timing, `NOT_FOUND` for nonexistent tasks, or `TASK_STATUS_CONFLICT` for modifications to completed tasks. Invalid chore references are refused with `NOT_FOUND`; unauthorized requests with `ACCESS_DENIED`, and unauthenticated requests with `UNAUTHENTICATED`.

```endpoints
ChoreAssignments.CreateTask at /assignments/tasks/create
ChoreAssignments.CreateTaskBatch at /assignments/tasks/create-batch
ChoreAssignments.RemoveTask at /assignments/tasks/remove
ChoreAssignments.DeleteAssignment at /assignments/tasks/delete
ChoreAssignments.UpdateDeadline at /assignments/tasks/deadline
ChoreAssignments.UpdateInterval at /assignments/tasks/interval
```

## Auto-scheduling

In alpha, the overseer selects a week in **Manage** and clicks **Assign available residents**. The frontend sends the household and the selected week's UTC boundaries to the [WeeklyAutoSchedule endpoint](reaction:ChoreAssignments.WeeklyAutoSchedule). The endpoint checks the overseer's session and invokes `TaskScheduling.autoSchedule` with `onlyUnassigned = true` to fill open assignments.

The overseer can also auto-schedule a manually selected period on demand. The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) verifies their permission. The [AutoSchedule endpoint](reaction:ChoreAssignments.AutoSchedule) invokes `TaskScheduling.autoSchedule` with the selected period and `onlyUnassigned` flag. When true, existing assignments are preserved; otherwise, automatic assignments are recalculated. Manual assignments and completed tasks always remain unchanged.

Both endpoints use `HouseholdManaging._schedulingInputs` to read candidates and their chore rankings from one household snapshot. Existing category preferences are used for a resident until they save a chore ranking. Tasks without eligible assignees remain unassigned and are returned to the overseer for manual scheduling. Requests are refused with `SCHEDULE_WINDOW_INVALID` for invalid periods or `PREFERENCES_INVALID` for inconsistent preference inputs. Unauthorized requests are refused with `ACCESS_DENIED`; unauthenticated requests with `UNAUTHENTICATED`.

The overseer can also reset a selected period without immediately reassigning tasks. The [Reset endpoint](reaction:ChoreAssignments.Reset) checks CanManageSchedule and invokes `TaskScheduling.reset`, clearing only automatic assignments on incomplete tasks while preserving manual assignments and completed tasks.

```endpoints
ChoreAssignments.AutoSchedule at /assignments/auto-schedule
ChoreAssignments.WeeklyAutoSchedule at /assignments/weekly
ChoreAssignments.Reset at /assignments/reset
```

## Manual scheduling

The overseer can manually assign, reassign, or unassign residents for incomplete tasks that are scheduled over an interval. They retrieve the current schedule through the [HouseholdSchedule former](former:ChoreAssignments.HouseholdSchedule), edit or clear any assignments and submit changes all at once through the [SetSchedule endpoint](reaction:ChoreAssignments.SetSchedule).

The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) verifies their permission, while `HouseholdManaging._allResidents` checks the supplied assignees as a set. `TaskScheduling.setSchedule` verifies task ownership and open status as part of the atomic batch. Omit the assignee to unassign a task. Setting the assignee on an open weekly occurrence applies the same choice to all open dates in that series. The overseer can commit a resident to a weekly assignment before future availability is entered. Automatic assignment evaluates every open date and prefers fully available residents. Somewhat available remains eligible when nobody rates Available for at least one permitted day of every occurrence. The overseer can assign a series before a resident has saved a weekly pattern. A saved Not available day rules out that resident for a new manual assignment.

Requests for missing assignees are refused with `NOT_FOUND`. A missing or out-of-household task is refused by TaskScheduling with `TASK_NOT_FOUND`, which maps to HTTP 404. Other requests are refused with `TASK_STATUS_CONFLICT`, `TASK_INTERVAL_INVALID`, `SCHEDULE_ENTRIES_INVALID`, or `PERSON_NOT_AVAILABLE`, as applicable. The entire batch is refused without partial changes. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
ChoreAssignments.SetSchedule at /assignments/set
```

## Swapping assignments (WIP)

A resident could propose swapping one of their incomplete assigned tasks with another resident's incomplete assigned task. The offer would identify both tasks and their current assignees. Only the intended recipient could respond. Acceptance would use a single `TaskScheduling.setSchedule` batch to exchange assignees, after verifying that both tasks remain assigned as expected and both residents remain eligible.

Persistent offers, acceptance, rejection, and cancellation require Trading. Swap endpoints are deferred.

## Reading the schedule

The [GetAssignments endpoint](reaction:ChoreAssignments.GetAssignments) returns the overseer’s assignment list through the [AssignmentList former](former:ChoreAssignments.AssignmentList) with one row per weekly series or standalone task. Each row summarizes the complete series even when the selected week contains only one occurrence.

The [GetTask endpoint](reaction:ChoreAssignments.GetTask) returns one task with the same household membership check and schedule details. Signed-in residents see the whole household's schedule through the [GetSchedule endpoint](reaction:ChoreAssignments.GetSchedule). It uses a [HouseholdSchedule former](former:ChoreAssignments.HouseholdSchedule) combining `TaskScheduling._schedule` with chore details from `ChoreCataloguing` and category information from `HouseholdManaging`, returning each task's chore, deadline, scheduled interval, assignee, assignment source (`AUTO` or `MANUAL`), and completion status. The [ScheduleTaskDetails former](former:ChoreAssignments.ScheduleTaskDetails) preserves the task's category and weight snapshot and uses the [ChoreDetails former](former:ChoreAssignments.ChoreDetails) for current catalogue details. A missing catalogue entry or category name does not hide the task. A [CanReadSchedule view](view:ChoreAssignments.CanReadSchedule) verifies household membership. Requests from non-residents for another household's schedule return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

Residents can also see their own tasks through the [MyTasks endpoint](reaction:ChoreAssignments.GetMyTasks). It uses a [MyTasks former](former:ChoreAssignments.MyTasks) to retrieve tasks assigned to or completed by the requesting resident. The [PersonalTaskMatches view](view:ChoreAssignments.PersonalTaskMatches) selects assigned tasks, completed tasks, or both using the optional mode. Queries use a supplied UTC window and return `SCHEDULE_WINDOW_INVALID` if the start is not before the end.

The overseer can view every resident's workload, availability, and category preferences through the [GetHouseholdOverview endpoint](reaction:ChoreAssignments.GetHouseholdOverview). The [HouseholdOverview former](former:ChoreAssignments.HouseholdOverview) includes the weekly pattern through the [PersonWeeklyAvailability former](former:ChoreAssignments.PersonWeeklyAvailability) and combines the resident list and preferences from `HouseholdManaging` with each resident's workload and availability from `TaskScheduling._workload` and `TaskScheduling._availability`. The [ResidentWorkload former](former:ChoreAssignments.ResidentWorkload), [PersonAvailability former](former:ChoreAssignments.PersonAvailability), and [HouseholdPreferences former](former:ChoreAssignments.HouseholdPreferences) supply these fields for each resident. The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) verifies overseer authorization.

Residents can see their own [availability](reaction:ChoreAssignments.GetAvailability) and [total](reaction:ChoreAssignments.GetTotal) workload. The overseer can read these for any current resident through the [CanReadHouseholdDetails view](view:ChoreAssignments.CanReadHouseholdDetails).

Requests are refused with `NOT_FOUND` when the household, task, or requested resident does not exist, `ACCESS_DENIED` when the requester lacks permission to access the information, or `UNAUTHENTICATED` when the requester is not signed in.

```endpoints
ChoreAssignments.GetAssignments at /assignments/list
ChoreAssignments.GetTask at /assignments/task
ChoreAssignments.GetSchedule at /assignments/schedule
ChoreAssignments.GetMyTasks at /assignments/mine
ChoreAssignments.GetTotal at /assignments/total
ChoreAssignments.GetAvailability at /assignments/availability
ChoreAssignments.GetHouseholdOverview at /assignments/overview
```

The [EditAvailability endpoint](reaction:ChoreAssignments.EditAvailability) applies a resident’s selected dates together. Removing part of a time block preserves the free time on either side.

## Notes
### Assumptions
The composition assumes that all household residents, including the overseer, are eligible for assignment. HouseholdManaging owns membership, oversight, and preferences, while TaskScheduling owns availability, assignments, and completion state. Authorization is checked by the composition using `Sessioning.use` on the existing session cookie. Signed-out requests use the shared `NOT_SIGNED_IN` refusal for the unauthenticated case. The HTTP policy maps it to 401 and preserves the standard HTTP categories for the other domain refusals.

We also assume that the overseer creates tasks for one week or a bounded date range before assigning residents. Timing inputs use UTC ISO timestamps and intervals use start and end. The request flow supplies the clock for display status.

```computations
availabilityWindows(windows: IntervalInputs) : IntervalSet
  Converts a batch of UTC timestamp pairs into scheduling or availability intervals.
activeChorePreferences(chorePreferences: ChorePreferences, items: ChoreSet) : ChorePreferenceSet
  Excludes archived chores from the ordered preferences used for scheduling.
assignmentCategory(category?: Category) : CategorySelection
  Resolves the optional legacy category and records whether it exists.
assignmentDate(value: String) : DateTime
  Converts a validated UTC timestamp to a date, or maps null to an absent optional date.
assignmentInterval(value: IntervalInput) : Interval
  Converts the two validated UTC timestamps, or maps null to an absent optional interval.
assignmentPeople(entries: ScheduleEntries) : People
  Returns the distinct assignees supplied in the batch.
matchesPersonalTask(person: String, assignee?: String, completedBy?: String, mode: String) : TaskMatch
  Reports whether the resident matches the assignment or completion filter.
assignmentStatus(deadline?: DateTime, interval?: Interval, completedAt?: DateTime, asOf: DateTime) : String
  Derives the task status using the same cutoff as TaskScheduling.
assignmentIsIncomplete(completedAt?: DateTime) : IncompleteMatch
  Reports whether the task has no completion timestamp.
```

Alpha supports joining and leaving households, setting availability, creating tasks, assigning tasks manually or automatically for a selected week, and reading the schedule. Residents can arrange a swap outside the app and ask the overseer to reassign the tasks.

### Extensions
Possible Beta extensions include scheduling an automatic Sunday-night assignment run for each household and introducing a `Roling` concept for more granular permissions or multiple overseers. Alpha uses `HouseholdManaging` for membership and one overseer per household.

Currently, swapping is described in theory primitive but will require a new `Trading` concept to record offers from one resident and the other's acceptance as well as cancellation. This concept will be essential for handling race conditions.

Alpha lets the overseer create one-time tasks and weekly series with a selected end date. A future `Recurring` concept could generate more occurrences as an ongoing series continues.

In the future, a `Notifying` concept and/or a `Notifications` composition will react to the actions concerned in this `ChoreAssignments` composition to make the overall experience smoother.
