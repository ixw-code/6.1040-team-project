# Chore Assignments

Chore Assignments turns a household's catalogued chores into dated tasks and assigns each task to a resident who is available for it. It spreads the work fairly by difficulty.

ChoreCataloguing stores chores with their type, difficulty weight, and default preference weights. TaskTracking stores each dated occurrence of a chore, who it is assigned to, and whether it is done. Scheduling plans who does each occurrence from residents' availability, preferences, and how much weight they have done so far. Roling decides who can manage the schedule and who receives chores.

## Joining and leaving the schedule

When a person is given the Resident role in a household, they join that household's schedule.[join] Coordinators do not join unless they also hold the Resident role, so they never get chores automatically.

When a resident leaves the household or loses the Resident role, they leave the schedule.[leave] Their upcoming tasks are unassigned in TaskTracking and become unfilled.[free] Completed tasks stay with them as history. The Coordinator sees the freed tasks. The next weekly run fills them, or the Coordinator can auto-schedule right away.

[join]: reaction:ChoreAssignments.JoinSchedule
[leave]: reaction:ChoreAssignments.LeaveSchedule
[free]: reaction:ChoreAssignments.FreeTasks

## Setting availability and preferences

A signed-in resident can add and remove their own availability windows and set preferences for chores in their household.[self-access] The endpoint checks the session, so a resident cannot change someone else's availability. An Coordinator can also enter availability for residents in their household, for example from everyone's class schedules at the start of term.[overseer-access]

Each chore starts with the default preference weight from ChoreCataloguing. A resident's stated preference replaces the default for them only.[defaults] A resident with no availability is never assigned automatically, and the schedule page warns both them and the Coordinator.[no-availability]

[self-access]: view:ChoreAssignments.CanEditOwnAvailability
[overseer-access]: view:ChoreAssignments.CanEditHouseholdAvailability
[defaults]: former:ChoreAssignments.EffectivePreferences
[no-availability]: former:ChoreAssignments.MissingAvailability

```endpoints
ChoreAssignments.AddAvailability at /assignments/availability/add
ChoreAssignments.RemoveAvailability at /assignments/availability/remove
ChoreAssignments.SetPreference at /assignments/preference
```

## Creating tasks from chores

Only an Coordinator can create tasks for their household.[manage-access] The Coordinator chooses a catalogued chore and gives the task a start and a due time. TaskTracking records the occurrence with the chore's completion criteria and baseline photo.[create]

Creating a task adds it to Scheduling with the chore's type as its category and the chore's difficulty weight as its weight.[add-item] Later changes to the chore's weight in ChoreCataloguing do not change tasks already created. A resident's total reflects the weight each task had when it was created.

Removing a task that is not done also removes it from Scheduling.[remove] A completed task cannot be removed.

When a resident removes availability, any task they can no longer do is unassigned in TaskTracking and becomes unfilled.[unavailable]

[manage-access]: view:ChoreAssignments.CanManageSchedule
[create]: reaction:ChoreAssignments.CreateTask
[add-item]: reaction:ChoreAssignments.AddToSchedule
[remove]: reaction:ChoreAssignments.RemoveTask
[unavailable]: reaction:ChoreAssignments.FreeUnavailableTasks

```endpoints
ChoreAssignments.CreateTask at /assignments/tasks/create
ChoreAssignments.RemoveTask at /assignments/tasks/remove
```

## Auto-scheduling

Every Sunday night, the coming week is auto-scheduled for each household, so no one has to remember to do it.[weekly] Scheduling gives each unassigned task to an available resident. It picks the one with the lowest total weight after adjusting for their preference. Each planned task is assigned to that resident in TaskTracking, so they see it with its due time and criteria.[record]

Auto-scheduling again only fills tasks that are still unassigned. Earlier choices stay in place, so residents' plans don't shift without warning. To redo a period, the Coordinator resets it first. This removes only auto-scheduled assignments for tasks that are not done.[reset]

The Coordinator can also auto-schedule a period right away, for example after adding tasks late in the week or after a resident leaves.[auto]

Tasks that no available resident could take are listed as unfilled for the Coordinator to assign by hand.[unfilled]

[weekly]: reaction:ChoreAssignments.WeeklyAutoSchedule
[auto]: reaction:ChoreAssignments.AutoSchedule
[record]: reaction:ChoreAssignments.RecordAssignment
[reset]: reaction:ChoreAssignments.Reset
[unfilled]: former:ChoreAssignments.UnfilledTasks

```endpoints
ChoreAssignments.AutoSchedule at /assignments/auto-schedule
ChoreAssignments.Reset at /assignments/reset
```

## Setting the schedule by hand

The Coordinator can change the schedule by hand. They take the current schedule, edit any tasks that are not done, and set it again. All changes apply together, or none do.[set] Each change is recorded in TaskTracking the same way as an auto-scheduled assignment.[record] Completed tasks cannot be reassigned.[done-check]

A task can only be set to a resident who is available for it. Otherwise the whole change is refused with `NOT_AVAILABLE`, and the Coordinator sees which task and resident caused it.

[set]: reaction:ChoreAssignments.SetSchedule
[done-check]: view:ChoreAssignments.IsChangeable

```endpoints
ChoreAssignments.SetSchedule at /assignments/set
```

## Reading the schedule

Residents see their own tasks and the household's schedule. Coordinators also see each resident's total weight, availability, and preferences.[read-access] The schedule endpoint returns each task with its chore, start, due time, assignee, and whether it is done.[schedule] Residents cannot see other residents' availability or preferences.

Requests for another household's schedule return `NOT_FOUND`, without revealing that household's tasks.

[read-access]: view:ChoreAssignments.CanReadSchedule
[schedule]: former:ChoreAssignments.HouseholdSchedule

```endpoints
ChoreAssignments.GetSchedule at /assignments/schedule
ChoreAssignments.GetMyTasks at /assignments/mine
ChoreAssignments.GetTotals at /assignments/totals
```

## Notes

Alpha supports joining, availability, creating tasks, weekly auto-scheduling balanced by weight with random tie-breaks, setting the schedule by hand, and reading the schedule. Beta adds preferences. Swaps are below.

Household access and role checks belong in the composition. Scheduling uses generic groups and people and does not depend on household roles.

This composition assumes that TaskTracking has `add`, `remove`, `assign`, and `unassign`, and that it can be asked whether a task is done. It also assumes that ChoreCataloguing exposes each chore's type, difficulty weight, and default preference weight. These names must be agreed on with Ivan.

Swaps use the Trading concept (`design/concepts/Trading.md`). A swap can give one or more tasks for one or more tasks. Concept actions can't take a list, so an offer is built as a draft: `propose` creates it, `addItem` adds each task to the OFFERED or REQUESTED side, and `send` opens it for an answer. Trading is implemented. The wiring below waits on Scheduling and TaskTracking being implemented, because it needs to look up who holds a single task:

- **Offering a swap.** The endpoint takes the session plus a recipient and two lists of tasks. It calls `Trading.propose`, then `Trading.addItem` once per task, then `Trading.send`. Before `addItem`, it checks that the task is in the same household and not done, and that the proposer holds each OFFERED task and the recipient holds each REQUESTED task. A task may appear on both sides.
- **Accepting.** The endpoint checks that the signed-in resident is the offer's recipient and the offer is pending (`Trading._offer`), and reads its tasks with `Trading._items`. It gives every OFFERED task to the recipient and every REQUESTED task to the proposer in one `Scheduling.setSchedule` call. That call refuses `NOT_AVAILABLE` if anyone is unavailable for a new task. Only after it succeeds does the endpoint call `Trading.accept`, then `TaskTracking.assign` for each task. Doing the schedule change first means a trade is never marked accepted unless the schedule changed. Accepting withdraws every other pending offer that shares any of its tasks.
- **Declining and cancelling.** These call `Trading.decline` and `Trading.cancel` with the session's person. The concept refuses the wrong person. Cancelling works on drafts and pending offers.
- **Keeping offers current.** When a task changes hands any other way (the Coordinator sets the schedule, availability is removed, the task is removed or completed), a reaction calls `Trading.withdraw` for that task. Drafts are left alone, because `send` rechecks who holds each task.
- **Reading.** `Trading._incoming` and `Trading._outgoing` drive a resident's swap inbox, and `Trading._items` lists the tasks in each offer.

Scheduling needs a query that returns one job's person (for example `_job(job)`) for these checks.

The weekly run needs the coming week's tasks to exist first. Recurring chores (for example, "sink every Monday") could create tasks for each week automatically. Recurrence belongs in ChoreCataloguing or TaskTracking, not Scheduling. Until that is decided, the Coordinator creates each period's tasks.