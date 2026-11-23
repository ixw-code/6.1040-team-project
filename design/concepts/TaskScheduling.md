# TaskScheduling

## Purpose
Let people create and manually assign instances of work and track their completion by person and time. 

Let people also be automatically assigned for work such that everyone does an equal amount of effort, only at times they are available, and with their preferences respected where possible.

*Prevents*: people are unsure of task responsibilities and assigned work gets forgotten or mistaken for completed work; manual changes get disregarded; people are scheduled for times they are unavailable; work is distributed unfairly with regards to effort. 

## Principle
Allie, Caleb, and Millie join a household's schedule. Allie is available Monday through Thursday, Caleb on weekdays, and Millie only on weekends. Allie prefers kitchen work and Caleb wants to avoid bathrooms.

The week's jobs are added: Monday's sink (weight 1), Tuesday's bathroom (weight 3), and Saturday's trash (weight 1). Auto-scheduling puts Allie on Monday's sink because she is available and prefers it. Allie also gets Tuesday's bathroom because Caleb avoids it and Millie is unavailable. Millie gets Saturday's trash because she is the only one available. Next week, Caleb has done the least, so he gets the bathroom even though he would rather avoid it.

The planner tries to set Saturday's trash to Caleb, but it is refused because Caleb is not available on weekends. Instead, the planner takes the schedule, moves Tuesday's bathroom from Allie to Caleb, and sets it again. Auto-scheduling once more only fills empty jobs, so Caleb keeps the bathroom.

Later, Millie removes her Saturday availability. The trash goes back to being unscheduled, so it never stays with someone who can't do it. If Caleb's Saturday is available, he can self-assign himself, or the overseer can assign someone to do it too. When new residents are added to the household, the auto-scheduler will assign tasks for subsequent weeks accordingly. 

The task scheduler records tasks and their status, whether a task is still pending or if it has been completed and by whom and when.

## Types 
```types
external Group
    The context where work is being scheduled, such as a household.

external Person
  A user who can be scheduled for a task.

external Item
  A reusable work definition that can be instantiated and scheduled.

external Category
  What sort of work a job is, such as kitchen or bathroom.

opaque Interval
  A time interval with a start DateTime and an end DateTime.

enum PreferenceLevel is PREFER, NEUTRAL, or AVOID
  How a person feels about a category of work.

enum Source is AUTO or MANUAL
  Whether a job's assignment was set automatically or by hand.

enum Status is PENDING, OVERDUE, COMPLETED, or COMPLETED_LATE
  Whether atask has been completed or not, in regards to its deadline.
```

## State 
```state
a set of Availabilities with
  a group Group
  a person Person
  an interval Interval

a set of Tasks with 
  a group Group
  an item Item
  a category Category
  a weight Number
  an optional deadline DateTime
  an optional interval Interval
  an optional assignee Person
  an optional source Source
  an optional completedBy Person
  an optional completedAt DateTime

Rule: every interval must have start before end
Rule: a task with both a scheduled interval and a deadline must have its interval end no later than its deadline 
Rule: a task's weight is a positive float between 1-10, inclusive

Rule: a task has an assignee exactly when it has a source
Rule: a task with an assignee must have a scheduled interval
Rule: a task must have either a deadline or a scheduled interval
Rule: a person is 'available' for a task when their availability intervals in the group completely cover the task's scheduled interval 
Rule: all pending tasks' assignees must be available for the task's scheduled interval

Rule: a task must have completedBy set exactly when it has completedAt set
Rule: a task is completed when it has both completedBy and completedAt
Rule: an incomplete task is PENDING, or OVERDUE if the current time is past its end interval or deadline
Rule: a complete task is COMPLETED, or COMPLETED_LATE if its completedAt time is past its end interval or deadline

Rule: a person's total assigned workload in a group is the sum of all weights of the tasks assigned to them in that group, zero if no tasks are assigned
```

## Actions 
```actions
add(group: Group, item: Item, category: Category, weight: Number, deadline: DateTime?, interval: Interval?): returns (task: Task)
  where item doesn't belong to group
  then
    refuse TASK_ITEM_NOT_FOUND "Task item does not exist."
  where weight is outside [1, 10]
  then
    refuse TASK_WEIGHT_INVALID "Task weight must be between 1 and 10."
  where neither deadline or interval are given 
  then
    refuse TASK_INTERVAL_INVALID "Please provide either a deadline or a valid time interval."
  where interval is given and its start is not before its end
  then
    refuse TASK_INTERVAL_INVALID "The scheduled interval is invalid."
  where interval and deadline are given and interval ends after deadline
  then
    refuse TASK_INTERVAL_INVALID "The scheduled interval cannot end after the deadline."
  where either deadline or interval are given and valid
    if deadline is not given,
      sets deadline as interval's end date
    create a new task with group, item, category, weight,
      deadline, interval, no assignee, no source,
      no completedBy, and no completedAt
    return task

remove(task: Task): returns (task : Task)
where task doesn't exist
then
  refuse TASK_NOT_FOUND "There is no such task on the schedule."
where task exists
then
  remove job
  returns job

updateDeadline(task: Task, deadline: DateTime?): returns (task: Task)
  where task doesn't exist
  then
    refuse TASK_NOT_FOUND "There is no such task on the schedule."
  where task is already completed
  then
    refuse TASK_STATUS_CONFLICT "A completed task's deadline cannot be changed."
  where deadline is None and task interval is None
  then
    refuse TASK_INTERVAL_INVALID "Task must have either a deadline or an interval."
  where deadline is given and task has an interval whose end is after deadline
  then
    refuse TASK_INTERVAL_INVALID "The deadline cannot precede the scheduled interval's end."
  otherwise
    update task's deadline
    return task

updateInterval(task: Task, interval: Interval?): returns (task: Task)
  where task doesn't exist
  then
    refuse TASK_NOT_FOUND "There is no such task on the schedule."
  where task is already completed 
  then
    refuse TASK_STATUS_CONFLICT "A completed task cannot be rescheduled."
  where interval is given and start is not before its end
  then
    refuse TASK_INTERVAL_INVALID "The scheduled interval is invalid."
  where interval is given and task deadline is before interval's end
  then
    refuse TASK_INTERVAL_INVALID "The scheduled interval cannot end after deadline."
  where interval is None and task deadline is None
  then
    refuse TASK_INTERVAL_INVALID "Task must be scheduled for either a deadline or an interval."
  where interval is None and task has a deadline
  then
    clear task assignee, interval, and source to None
    return task
  where interval is valid
  then
    update task interval
    if current assignee is unavailable for the new interval, then clears task's assignee and source to None
    return task

addAvailability(group: Group, person: Person, start: DateTime, end: DateTime): returns (availability: Availability)
  where person does not belong to group
  then
    refuse PERSON_NOT_FOUND "Person is not on this schedule."
  where start is not before end
  then
    refuse TASK_INTERVAL_INVALID "Availability interval must end after it starts."
  where person belongs to group and interval is valid
  then
    add a new availability with the group, person, and interval [start, end)
    return availability

removeAvailability(availability: Availability): returns (freed: set (task: Task) )
  where availability doesn't exist
  then
    refuse AVAILABILITY_NOT_FOUND "There is no such availability."
  where availability exists
  then
    remove availability
    clear person and source from every task not already completed and previously assigned to person in group that they are no longer available for
    return the tasks that were cleared

removePerson(group: Group, person: Person): returns (freed: set (task: Task) )
  where person doesn't belong in group
  then
    refuse PERSON_NOT_FOUND "Person is not on this schedule."
  where true
  then
    remove all availabilities for person in group
    clear assignee and source from tasks not already completed and previously assigned to person in group
    return the tasks that were cleared

autoSchedule(
  group: Group, 
  from: DateTime, 
  until: DateTime, 
  people: set (person: Person), 
  preferences: set (
    person: Person, 
    preferenceLevel: PreferenceLevel, 
    category: Category
  )
  onlyUnassigned: Flag
): returns (
  scheduled: set (task: Task, person: Person),
  unassigned: set (task: Task)
)
  where from is not before until
  then
    refuse SCHEDULE_WINDOW_INVALID "The period must end after it starts."
  where preferences references a person not in people or multiple preference levels are given for one person and category
  then
    refuse PREFERENCES_INVALID "The supplied preferences are invalid."
  where [from, until) is a valid interval
  then
    if onlyUnassigned is false
      clear assignee and source from every incomplete task in group
      whose scheduled interval starts in [from, until) and whose source is AUTO
    for each incomplete task in group whose interval start is in [from, until) in order of start:
      if task source is MANUAL or (onlyUnassigned is true and task has an assignee)
        skip rescheduling for this task 
      otherwise
      among users available for the job, choose the one with the lowest
        cost = their total + the job's weight × (0.5 if prefer, 1 if neutral, 2 if avoid),
        breaking remaining ties at random
      if someone was chosen, set the job's person to them and its source to AUTO
      otherwise leave the task unassigned
    return the newly scheduled tasks and the unassigned tasks

setSchedule(group: Group, entries: set (task: Task, assignee: Person?) ): returns (entries: set (task: Task, assignee: Person?) )
  where some entry's task doesn't exist in group
  then
    refuse TASK_NOT_FOUND "One of these tasks is not on this schedule."
  where some entry's task is already completed
  then
    refuse TASK_STATUS_CONFLICT "A completed task cannot be reassigned."
  where some entry's task doesn't have a scheduled interval
  then
    refuse TASK_INTERVAL_INVALID "Task must have a scheduled interval before assignment."
  where some entry's assignee is given and doesn't belong in group
  then
    refuse PERSON_NOT_FOUND "One of these people is not on this schedule."
  where some entry's person is given and is not available for its job
  then
    refuse PERSON_NOT_AVAILABLE "An assignee is not available for this task."
  where every entry's task exists and every assignee belongs in group and is available for their task
  then
    for every entry:
      if an assignee is given
        set the task's assignee to the entry's assignee and set source to MANUAL,
      otherwise
        clear both task's assignee and source
    return entries

reset(group: Group, from: DateTime, until: DateTime) : returns (cleared: set (job: Job))
  where from is not before until
  then
    refuses SCHEDULE_WINDOW_INVALID "The period must end after it starts."
  where from is before until
  then
    clear assignee and source from every incomplete task in group whose scheduled interval starts in [from, until) and whose source is AUTO
    return the jobs that were cleared

complete(task: Task, completedBy: Person, completedAt: DateTime): returns (task: Task, completedBy: Person, completedAt: DateTime) 
  where task doesn't exist
  then 
    refuse TASK_NOT_FOUND "This task doesn't exist in the schedule." 
  where person doesn't exist in the task's group 
  then 
    refuse PERSON_NOT_FOUND "This person is not on this schedule."
  where task is already completed
  then 
    refuse TASK_STATUS_CONFLICT "Task has already been completed." 
  where task is not completed
  then 
    set the task's completedBy and completedAt
    return task, completedBy, and completedAt

uncomplete(task: Task): returns (task: Task, lastCompletedBy: Person, lastCompletedAt: DateTime)
  where task does not exist
  then
    refuses TASK_NOT_FOUND "This task doesn't exist in the schedule."
  where task is not completed
  then
    refuses TASK_STATUS_CONFLICT "This task is not completed."
  where task is completed
    record the previous completedBy and completedAt
    clear completedBy and completedAt
    returns task, lastCompletedBy, and lastCompletedAt
```

## Queries
```queries
_get(task: Task) : (
  group: Group,
  item: Item,
  category: Category,
  weight: Number,
  deadline: DateTime?,
  interval: Interval?,
  assignee: Person?,
  source: Source?,
  completedBy: Person?,
  completedAt: DateTime?
)
  Returns task details if task exists.

_tasks(group: Group) : many (
  task: Task,
  item: Item,
  category: Category,
  weight: Number,
  deadline: DateTime?,
  start: DateTime?,
  end: DateTime?,
  assignee: Person?,
  source: Source?,
  completedBy: Person?,
  completedAt: DateTime?
)
  Returns all tasks belonging to a group, ordered by earliest start date first.

_schedule(group: Group, from: DateTime, until: DateTime) : many (
  task: Task,
  item: Item,
  category: Category,
  weight: Number,
  deadline: DateTime?,
  start: DateTime?,
  end: DateTime?,
  assignee: Person?,
  source: Source?,
  completedBy: Person?,
  completedAt: DateTime?
)
  Returns all tasks in group with their scheduled interval start or their deadline in [start, until), ordered by earliest start date or deadline. 

_pending(group: Group, asOf: DateTime) : many (
  task: Task,
  item: Item,
  assignee: Person?,
  interval: Interval?,
  deadline: DateTime?,
  status: Status
)
  Returns all incomplete tasks with interval starts or deadlines after asOf, along with a PENDING or OVERDUE status by comparing the current time and the interval end date or deadline.

_completed(group: Group, asOf: DateTime) : many (
  task: Task,
  item: Item,
  completedBy: Person,
  completedAt: DateTime,
  status: Status
)
 Returns all completed tasks with interval starts or deadlines after asOf, along with a COMPLETED or COMPLETED_LATE status by comparing the completedAt time and the interval end date or deadline.

_completedByPerson(group: Group, person: Person) : many (
  task: Task,
  completedAt: DateTime,
  status: Status
)
  Returns tasks completed by person in the group, along with their COMPLETED or COMPLETED_LATE status.

_completedInInterval(group: Group, from: DateTime, until: DateTime) : many (
  task: Task,
  completedBy: Person,
  completedAt: DateTime,
  status: Status
)
  Returns tasks completed during [from, until), along with their completion status.

_availability(group: Group, person: Person) : many (
  availability: Availability,
  interval: Interval
) 
  Returns the person's availabilities, ordered by earliest start.

_workload(group: Group, person: Person) : (workload: Number)
  Returns the calculated total assigned workload of a person in the group.
```

