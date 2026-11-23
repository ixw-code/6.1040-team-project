# Chore Assignments

Chore Assignments turns a household's catalogued chores into dated tasks and assigns each task to a resident who is available for it. It spreads the work fairly by difficulty.

ChoreCataloguing stores reusable chores with their category, difficulty weight, requirements, and reference photos. TaskScheduling stores each dated task, its deadline and optional scheduled interval, assignee, and completion information; it also owns availability and the automatic assignment algorithm. HouseholdManaging stores residents, the overseer, categories, and resident preferences.

## Joining and leaving the schedule

When a person becomes a resident of a household through `HouseholdManaging`, they are automatically eligible for automatic chore assignment. The household overseer is also a resident and is eligible for assignment. (Oversight currently handled by HouseholdManaging, while explicit eligibility policies and Roling concept is not yet supported).

When a resident leaves the household or the overseer removes them, they also leave the schedule and their availability and any assigned incomplete tasks need to be cleared. The [ResidentRemoved reaction](reaction:ChoreAssignments.ResidentRemoved) reaction to a successful `HouseholdManaging.removeResident` by invoking `TaskScheduling.removePerson`. The latter clears the resident availability and their incomplete assignments, and returns the freed tasks; completed tasks remain in history. Scheduling can be rerun by the overseer on the freed tasks, or for the next week's assignments. Overseers must transfer their oversight before leaving the household.

The composition handles permission checks and partial failures/retries between the two concepts.

## Setting availability

A signed-in resident can [add](reaction:ChoreAssignments.AddAvailability) and [remove](reaction:ChoreAssignments.RemoveAvailability) their own availability windows through `TaskScheduling` and set preferences for categories of work in their household through `HouseholdManaging`. Removing availability causes TaskScheduling to clear incomplete assignments that are no longer valid. Completed tasks retain their assignment history. Requests are refused with `TASK_INTERVAL_INVALID` for invalid intervals or `NOT_FOUND` for nonexistent availability.

The [can-edit-availability view](view:ChoreAssignments.CanEditAvailability) checks the resident's identity or session, so only the overseer or the resident themselves can change someone else's availability. Unauthorized requests are refused with `ACCESS_DENIED`; unauthenticated requests with `UNAUTHENTICATED`.

Residents without availability cannot be assigned automatically. The schedule page can warn residents and the overseer when availability is missing. (Through UI behavior, Notifying concept currently isn't supported).

```endpoints
ChoreAssignments.AddAvailability at /assignments/availability/add
ChoreAssignments.RemoveAvailability at /assignments/availability/remove
```

## Creating tasks from chores

Only the household overseer can create tasks for their household. The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) checks their authorization. The [ValidHouseholdChore view](view:ChoreAssignments.ValidHouseholdChore) checks that the selected chore belongs to the household and its category is valid, using `ChoreCataloguing._get` and `HouseholdManaging`.

The [create-a-task endpoint](reaction:ChoreAssignments.CreateTask) coordinates the permission checks and invokes `TaskScheduling.add` with the chore's identity, category, difficulty weight, deadline, and optional interval. Later changes to the chore's weight or category in its definition in `ChoreCataloguing` do not change tasks already created. A resident's total reflects the weight each task had when it was created.

The overseer can also remove incomplete tasks or update their deadlines and scheduled intervals. The [AssignmentIsModifiable view](view:ChoreAssignments.AssignmentIsModifiable) checks that the task belongs to the household and is incomplete before allowing modification, and the endpoints use the corresponding `TaskScheduling` actions.

Requests are refused with `TASK_WEIGHT_INVALID` for invalid weights, `TASK_INTERVAL_INVALID` for invalid timing, `NOT_FOUND` for nonexistent tasks, or `TASK_STATUS_CONFLICT` for modifications to completed tasks. Invalid chore references are refused with `NOT_FOUND`; unauthorized requests with `ACCESS_DENIED`, and unauthenticated requests with `UNAUTHENTICATED`.

```endpoints
ChoreAssignments.CreateTask at /assignments/tasks/create
ChoreAssignments.RemoveTask at /assignments/tasks/remove
ChoreAssignments.UpdateDeadline at /assignments/tasks/deadline
ChoreAssignments.UpdateInterval at /assignments/tasks/interval
```

## Auto-scheduling

Every Sunday night, the coming week is auto-scheduled for each household, so no one has to remember to do it. Scheduling gives each unassigned task to an available resident. The [WeeklyAutoSchedule endpoint](reaction:ChoreAssignments.WeeklyAutoSchedule) is triggered by an external scheduler and invokes `TaskScheduling.autoSchedule` with `onlyUnassigned = true`, preserving existing assignments.

The overseer can also auto-schedule a manually selected period on demand. The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) verifies their permission. The [AutoSchedule endpoint](reaction:ChoreAssignments.AutoSchedule) invokes `TaskScheduling.autoSchedule` with the selected period and `onlyUnassigned` flag. When true, existing assignments are preserved; otherwise, automatic assignments are recalculated. Manual assignments and completed tasks always remain unchanged.

Both endpoints use the [HouseholdPreferences former](former:ChoreAssignments.HouseholdPreferences), which assembles the household's residents and their category preferences from `HouseholdManaging`. Tasks without eligible assignees remain unassigned and are returned to the overseer for manual scheduling. Requests are refused with `SCHEDULE_WINDOW_INVALID` for invalid periods or `PREFERENCES_INVALID` for inconsistent preference inputs. Unauthorized requests are refused with `ACCESS_DENIED`; unauthenticated requests with `UNAUTHENTICATED`.

The overseer can also reset a selected period without immediately reassigning tasks. The [Reset endpoint](reaction:ChoreAssignments.Reset) checks CanManageSchedule and invokes `TaskScheduling.reset`, clearing only automatic assignments on incomplete tasks while preserving manual assignments and completed tasks.

```endpoints
ChoreAssignments.AutoSchedule at /assignments/auto-schedule
ChoreAssignments.WeeklyAutoSchedule at /assignments/weekly
ChoreAssignments.Reset at /assignments/reset
```

## Manual scheduling

The overseer can manually assign, reassign, or unassign residents for incomplete tasks that are scheduled over an interval. They retrieve the current schedule through the [HouseholdSchedule former](former:ChoreAssignments.HouseholdSchedule), edit or clear any assignments and submit changes all at once through the [SetSchedule endpoint](reaction:ChoreAssignments.SetSchedule).

The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) verifies their permission, while the [AssignmentIsModifiable view](view:ChoreAssignments.AssignmentIsModifiable) verifies that each task belongs to the household and has not been completed.

Requests are refused with `NOT_FOUND`, `TASK_STATUS_CONFLICT`, `TASK_INTERVAL_INVALID`, or `PERSON_NOT_AVAILABLE`, as applicable. The entire batch is refused without partial changes. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
ChoreAssignments.SetSchedule at /assignments/set
```

## Swapping assignments (WIP)

A resident can propose swapping one of their incomplete assigned tasks with another resident's incomplete assigned task. The [CanProposeSwap view](view:ChoreAssignments.CanProposeSwap) checks that both tasks belong to the household, have scheduled intervals, and are assigned to the proposing resident and the intended recipient respectively.

The [ProposeSwap endpoint](reaction:ChoreAssignments.ProposeSwap) records an offer for the other resident to accept or reject. The [RespondToSwap endpoint](reaction:ChoreAssignments.RespondToSwap) allows only that resident to respond. On acceptance, the [SwapAccepted reaction](reaction:ChoreAssignments.SwapAccepted) invokes `TaskScheduling.setSchedule` with both assignees exchanged. Both residents must be available for their new tasks; successful assignments receive source `MANUAL`.

Requests are refused if either task is nonexistent, completed, unassigned, or no longer assigned to the expected resident, or if either resident is unavailable for the new interval. No assignment changes on rejection or a failed swap. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

(TBA: persistent offers, acceptance, and rejection require a Trading concept for managing state)

```endpoints
ChoreAssignments.ProposeSwap at /assignments/swaps/propose
ChoreAssignments.RespondToSwap at /assignments/swaps/respond
ChoreAssignments.CancelSwap at /assignments/swaps/cancel
```

## Reading the schedule

Signed-in residents see the whole household's schedule through the [GetSchedule endpoint](reaction:ChoreAssignments.GetSchedule). It uses a [HouseholdSchedule former](former:ChoreAssignments.HouseholdSchedule) combining `TaskScheduling._schedule` with chore details from `ChoreCataloguing` and category information from `HouseholdManaging`, returning each task's chore, deadline, scheduled interval, assignee, assignment source (`AUTO` or `MANUAL`), and completion status. A [CanReadSchedule view](view:ChoreAssignments.CanReadSchedule) verifies household membership. Requests from non-residents for another household's schedule return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

Residents can also see their own tasks through the [MyTasks endpoint](reaction:ChoreAssignments.GetMyTasks). It uses a [MyTasks former](former:ChoreAssignments.MyTasks) to retrieve a filterable task list of either tasks assigned to or completed by the requesting resident.

The overseer can view every resident's workload, availability, and category preferences through the [GetHouseholdOverview endpoint](reaction:ChoreAssignments.GetHouseholdOverview). The [HouseholdOverview former](former:ChoreAssignments.HouseholdOverview) combines the resident list and preferences from `HouseholdManaging` with each resident's workload and availability from `TaskScheduling._workloads` and `TaskScheduling._availability`. The [CanManageSchedule view](view:ChoreAssignments.CanManageSchedule) verifies overseer authorization.

Residents can see their own [availability](reaction:ChoreAssignments.GetAvailability) and [total](reaction:ChoreAssignments.GetTotal) workload, but not those of other residents. Residents and the overseer are authorized for this through the [CanReadHouseholdDetails view](view:ChoreAssignments.CanReadHouseholdDetails).

Requests are refused with `NOT_FOUND` when the household, task, or requested resident does not exist, `ACCESS_DENIED` when the requester lacks permission to access the information, or `UNAUTHENTICATED` when the requester is not signed in.

```endpoints
ChoreAssignments.GetSchedule at /assignments/schedule
ChoreAssignments.GetMyTasks at /assignments/mine
ChoreAssignments.GetTotal at /assignments/total
ChoreAssignments.GetAvailability at /assignments/availability
ChoreAssignments.GetHouseholdOverview at /assignments/overview
```

## Notes
### Assumptions
The composition assumes that all household residents, including the overseer, are eligible for assignment. HouseholdManaging owns membership, oversight, and preferences, while TaskScheduling owns availability, assignments, and completion state. Authorization is checked by the composition.

We also assume that tasks are created manually for a given week by the overseer prior to assignment. 

Alpha supports the join/leave, availability-setting, task creation, weekly and manual scheduling, and schedule reading behavior for the current ChoreAssignment app. Swapping between two parties can be coordinated primitively, ie external to the app and overseers manually reassign them.

### Extensions
Beta will add the following:

Roles are limited to one overseer and residents handled by `HouseholdManaging`, while a future `Roling` concept may make access to features more granular or give multiple residents overseer-level permissions.

Currently, swapping is described in theory primitive but will require a new `Trading` concept to record offers from one resident and the other's acceptance as well as cancellation. This concept will be essential for handling race conditions.

Currently, chores are manually created and scheduled, while the "auto-scheduler" only automatically assigns them. In the future, chores can be instantiated as tasks with an external scheduler that uses a new `Recurring` concept to store state about chores that recur every week, perhaps. Chores can then be differentiated as "recurring" or "one-time."

In the future, a `Notifying` concept and/or a `Notifications` composition will react to the actions concerned in this `ChoreAssignments` composition to make the overall experience smoother.
