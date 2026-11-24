<!-- Generated from the Shift Happens assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Shift Happens — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `set(user: User, password: String) : returns (user: User)`
  - Refuses `INVALID_PASSWORD`: A password must have 8 to 128 characters.
  - Refuses `PASSWORD_SET`: This account already has a password.
- `authenticate(user: User, password: String) : returns (user: User)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Queries

- `_acceptable(password: String) : one (acceptable: Flag)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [Shift Happens Application Types](../design/types.md), line 39.
  - `User` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 40.

### ChoreCataloguing

Defined in [ChoreCataloguing](../design/concepts/ChoreCataloguing.md), line 1.

#### Actions

- `create(group: Group, name: String, description: String, category: Category, difficulty: Number, requirements: RequirementSet, references: PhotoSet) : returns (chore: Chore)`
  - Refuses `CHORE_NAME_CONFLICT`: Chore with the same name already exists.
  - Refuses `CHORE_NAME_INVALID`: Chore name is invalid.
  - Refuses `CHORE_DIFFICULTY_INVALID`: Chore difficulty must be in the range [1, 10].
- `updateDifficulty(chore: Chore, group: Group, difficulty: Number) : returns (chore: Chore)`
  - Refuses `CHORE_DOESNT_EXIST`: This chore doesn't exist in the catalog.
  - Refuses `CHORE_DIFFICULTY_INVALID`: Chore difficulty must be in the range [1, 10].
- `updateDetails(chore: Chore, group: Group, newCategory: Category, newName: String, newDescription: String) : returns (chore: Chore)`
  - Refuses `CHORE_DOESNT_EXIST`: This chore doesn't exist in the catalog.
  - Refuses `CHORE_NAME_INVALID`: Chore name is invalid.
  - Refuses `CHORE_NAME_CONFLICT`: Chore with the same name already exists.
- `updateRequirements(chore: Chore, group: Group, requirements: RequirementSet) : returns (chore: Chore)`
  - Refuses `CHORE_DOESNT_EXIST`: This chore doesn't exist in the catalog.
- `updateReferencePhotos(chore: Chore, group: Group, references: PhotoSet) : returns (chore: Chore)`
  - Refuses `CHORE_DOESNT_EXIST`: This chore doesn't exist in the catalog.
- `remove(chore: Chore, group: Group) : returns (chore: Chore, group: Group)`
  - Refuses `CHORE_DOESNT_EXIST`: This chore doesn't exist in the catalog.

#### Queries

- `_get(chore: Chore) : optional (group: Group, name: String, category: Category, difficulty: Number, description: String, requirements: RequirementSet, references: PhotoSet)`
- `_chores(group: Group, sortByDifficulty: Flag) : many (chore: Chore, name: String, description: String, category: Category, difficulty: Number, requirements: RequirementSet, references: PhotoSet)`
- `_choresByCategory(group: Group, category: Category, sortByDifficulty: Flag) : many (chore: Chore, name: String, description: String, difficulty: Number, requirements: RequirementSet, references: PhotoSet)`

#### Instances

- `ChoreCataloguing` — instance of `ChoreCataloguing` — [Shift Happens Application Types](../design/types.md), line 15.
  - `Category` is `HouseholdManaging.Category` — [Shift Happens Application Types](../design/types.md), line 17.
  - `Group` is `HouseholdManaging.Household` — [Shift Happens Application Types](../design/types.md), line 16.
  - `Photo` is `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 18.

### HouseholdManaging

Defined in [HouseholdManaging](../design/concepts/HouseholdManaging.md), line 1.

#### Actions

- `create(name: String, overseer: Person) : returns (household: Household)`
  - Refuses `HOUSEHOLD_NAME_INVALID`: Household name cannot be empty.
- `rename(household: Household, name: String) : returns (household: Household)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `HOUSEHOLD_NAME_INVALID`: Household name is invalid.
- `addResident(household: Household, person: Person) : returns (residency: Residency)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `HOUSEHOLD_RESIDENT_CONFLICT`: This person is already a resident.
- `removeResident(household: Household, person: Person) : returns (residency: Residency, household: Household, person: Person)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `HOUSEHOLD_RESIDENT_NOT_FOUND`: This person does not belong to the household.
  - Refuses `HOUSEHOLD_OVERSEER_CONFLICT`: Household oversight must be transferred before removal.
- `setOverseer(household: Household, person: Person) : returns (household: Household)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `HOUSEHOLD_RESIDENT_NOT_FOUND`: The overseer must belong to the household.
- `addCategory(household: Household, name: String) : returns (category: Category)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `CATEGORY_NAME_INVALID`: Category name is invalid.
  - Refuses `CATEGORY_NAME_CONFLICT`: A category with this name already exists.
- `renameCategory(household: Household, category: Category, name: String) : returns (category: Category)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `CATEGORY_NOT_FOUND`: This category does not belong to the household.
  - Refuses `CATEGORY_NAME_INVALID`: Category name cannot be empty.
  - Refuses `CATEGORY_NAME_CONFLICT`: A category with this name already exists.
- `removeCategory(household: Household, category: Category) : returns (category: Category)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.
  - Refuses `CATEGORY_NOT_FOUND`: This category does not belong to the household.
- `setPreference(household: Household, person: Person, category: Category, preferenceLevel: PreferenceLevel) : returns (preference: Preference)`
  - Refuses `HOUSEHOLD_RESIDENT_NOT_FOUND`: This person is not a resident.
  - Refuses `CATEGORY_NOT_FOUND`: This category does not belong to the household.
  - Refuses `PREFERENCE_LEVEL_INVALID`: Preference level must be PREFER, NEUTRAL, or AVOID.
- `remove(household: Household) : returns (household: Household)`
  - Refuses `HOUSEHOLD_NOT_FOUND`: This household does not exist.

#### Queries

- `_household(household: Household) : optional (name: String, overseer: Person)`
- `_householdsByPerson(person: Person) : many (household: Household, name: String, overseer: Person, categories: CategorySet)`
- `_categories(household: Household) : many (category: Category, name: String)`
- `_residents(household: Household) : many (person: Person)`
- `_schedulingInputs(household: Household) : one (people: ResidentRows, preferences: SchedulingPreferences)`
- `_allResidents(household: Household, people: PersonSet) : one (all: Flag)`
- `_preferences(household: Household, person: Person) : many (category: Category, preferenceLevel: PreferenceLevel)`

#### Instances

- `HouseholdManaging` — instance of `HouseholdManaging` — [Shift Happens Application Types](../design/types.md), line 12.
  - `Person` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 13.

### PhotoChecking

Defined in [PhotoChecking](../design/concepts/PhotoChecking.md), line 1.

#### Actions

- `submit(person: Person, subject: Subject, photo: Photo, criteria: String, baseline: Photo, method: ReviewMethod) : returns (submission: Submission)`
  - Refuses `ALREADY_PENDING`: This subject already has a pending submission.
  - Refuses `ALREADY_APPROVED`: This subject already has an approved submission.
- `approve(submission: Submission, reviewer: Reviewer, method: ReviewMethod, feedback: String) : returns (submission: Submission, subject: Subject, person: Person)`
  - Refuses `NOT_FOUND`: This submission does not exist.
  - Refuses `ALREADY_REVIEWED`: This submission already has a final decision.
  - Refuses `WRONG_REVIEW_METHOD`: This submission is awaiting a different review method.
- `reject(submission: Submission, reviewer: Reviewer, reason: String) : returns (submission: Submission, subject: Subject, person: Person)`
  - Refuses `NOT_FOUND`: This submission does not exist.
  - Refuses `ALREADY_REVIEWED`: This submission already has a final decision.
  - Refuses `MANUAL_REVIEW_REQUIRED`: This submission must move to manual review before rejection.
  - Refuses `MISSING_REASON`: Explain why the submission was rejected.
- `sendToOverseer(submission: Submission) : returns (submission: Submission)`
  - Refuses `NOT_FOUND`: This submission does not exist.
  - Refuses `ALREADY_REVIEWED`: This submission already has a final decision.

#### Queries

- `_current(subject: Subject) : optional (submission: Submission)`
- `_submission(submission: Submission) : optional (person: Person, subject: Subject, photo: Photo, criteria: String, baseline: Photo, selectedMethod: ReviewMethod, reviewMethod: ReviewMethod, status: Status, submittedAt: DateTime, reviewer?: Reviewer, reviewedAt?: DateTime, feedback: String)`
- `_history(subject: Subject) : many (submission: Submission, status: Status, submittedAt: DateTime, reviewedAt?: DateTime, feedback: String)`
- `_pending(method: ReviewMethod) : many (submission: Submission, subject: Subject, person: Person, submittedAt: DateTime)`

#### Instances

- `PhotoChecking` — instance of `PhotoChecking` — [Shift Happens Application Types](../design/types.md), line 31.
  - `Person` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 32.
  - `Photo` is `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 34.
  - `Reviewer` is `ReviewerIdentity` — [Shift Happens Application Types](../design/types.md), line 35.
  - `Subject` is `TaskScheduling.Task` — [Shift Happens Application Types](../design/types.md), line 33.

### Ranking

Defined in [Ranking](../design/concepts/Ranking.md), line 1.

#### Actions

- `credit(group: Group, person: Person, contribution: Contribution) : returns (group: Group, contribution: Contribution)`

#### Queries

- `_score(group: Group, person: Person) : one (score: Number)`
- `_ranking(group: Group) : many (person: Person, score: Number, rank: Number)`

#### Instances

- `Ranking` — instance of `Ranking` — [Shift Happens Application Types](../design/types.md), line 26.
  - `Contribution` is `TaskScheduling.Task` — [Shift Happens Application Types](../design/types.md), line 29.
  - `Group` is `HouseholdManaging.Household` — [Shift Happens Application Types](../design/types.md), line 27.
  - `Person` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 28.

### Registering

Defined in [Registering](../design/concepts/Registering.md), line 1.

#### Actions

- `register(username: String) : returns (user: User)`
  - Refuses `INVALID_USERNAME`: A username must have 3 to 32 letters, digits, underscores, or hyphens.
  - Refuses `USERNAME_TAKEN`: That username is taken.

#### Queries

- `_byUsername(username: String) : optional (user: User)`
- `_username(user: User) : optional (username: String)`

#### Instances

- `Registering` — instance of `Registering` — [Shift Happens Application Types](../design/types.md), line 37.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `use(session: Session) : returns (subject: Subject)`
  - Refuses `NOT_SIGNED_IN`: Your session has ended. Sign in again.
- `end(session: Session) : returns (session: Session)`
  - Refuses `NOT_SIGNED_IN`: Your session has ended. Sign in again.

#### Instances

- `Sessioning` — instance of `Sessioning` — [Shift Happens Application Types](../design/types.md), line 42.
  - `Subject` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 43.

### TaskScheduling

Defined in [TaskScheduling](../design/concepts/TaskScheduling.md), line 1.

#### Actions

- `add(group: Group, item: Item, category: Category, weight: Number, deadline?: DateTime, interval?: Interval) : returns (task: Task)`
  - Refuses `TASK_WEIGHT_INVALID`: Task weight must be between 1 and 10.
  - Refuses `TASK_INTERVAL_INVALID`: Provide a deadline or a valid interval that ends by the deadline when both are given.
- `remove(task: Task) : returns (task: Task)`
  - Refuses `TASK_NOT_FOUND`: There is no such task on the schedule.
  - Refuses `TASK_STATUS_CONFLICT`: A completed task cannot be removed.
- `updateDeadline(task: Task, deadline?: DateTime) : returns (task: Task)`
  - Refuses `TASK_NOT_FOUND`: There is no such task on the schedule.
  - Refuses `TASK_STATUS_CONFLICT`: A completed task's deadline cannot be changed.
  - Refuses `TASK_INTERVAL_INVALID`: A task needs a deadline or an interval, and the deadline cannot precede the interval end.
- `updateInterval(task: Task, interval?: Interval) : returns (task: Task)`
  - Refuses `TASK_NOT_FOUND`: There is no such task on the schedule.
  - Refuses `TASK_STATUS_CONFLICT`: A completed task cannot be rescheduled.
  - Refuses `TASK_INTERVAL_INVALID`: Provide a valid interval that ends by the deadline, or keep a deadline when clearing the interval.
- `addAvailability(group: Group, person: Person, start: DateTime, end: DateTime) : returns (availability: Availability)`
  - Refuses `TASK_INTERVAL_INVALID`: Availability interval must end after it starts.
- `editAvailability(group: Group, person: Person, windows: IntervalSet, adding: Flag) : returns (freed: TaskSet)`
  - Refuses `TASK_INTERVAL_INVALID`: Each availability window must end after it starts.
- `removeAvailability(availability: Availability) : returns (freed: TaskSet)`
  - Refuses `AVAILABILITY_NOT_FOUND`: There is no such availability.
- `removePerson(group: Group, person: Person) : returns (freed: TaskSet)`
- `autoSchedule(group: Group, from: DateTime, until: DateTime, people: PersonSet, preferences: PreferenceSet, onlyUnassigned: Flag) : returns (scheduled: ScheduledTaskSet, unassigned: TaskSet)`
  - Refuses `SCHEDULE_WINDOW_INVALID`: The period must end after it starts.
  - Refuses `PREFERENCES_INVALID`: The supplied preferences are invalid.
- `setSchedule(group: Group, entries: ScheduleEntrySet) : returns (entries: ScheduleEntrySet)`
  - Refuses `TASK_NOT_FOUND`: One of these tasks is not on this schedule.
  - Refuses `TASK_STATUS_CONFLICT`: A completed task cannot be reassigned.
  - Refuses `TASK_INTERVAL_INVALID`: Task must have a scheduled interval before assignment.
  - Refuses `SCHEDULE_ENTRIES_INVALID`: A task cannot have conflicting assignments in one batch.
  - Refuses `PERSON_NOT_AVAILABLE`: An assignee is not available for this task.
- `reset(group: Group, from: DateTime, until: DateTime) : returns (cleared: TaskSet)`
  - Refuses `SCHEDULE_WINDOW_INVALID`: The period must end after it starts.
- `complete(task: Task, completedBy: Person, completedAt: DateTime) : returns (task: Task, completedBy: Person, completedAt: DateTime)`
  - Refuses `TASK_NOT_FOUND`: This task doesn't exist in the schedule.
  - Refuses `TASK_STATUS_CONFLICT`: Task has already been completed.
  - Refuses `COMPLETION_TIME_INVALID`: Provide a valid completion time.
- `uncomplete(task: Task) : returns (task: Task, lastCompletedBy: Person, lastCompletedAt: DateTime)`
  - Refuses `TASK_NOT_FOUND`: This task doesn't exist in the schedule.
  - Refuses `TASK_STATUS_CONFLICT`: This task is not completed.

#### Queries

- `_get(task: Task) : optional (group: Group, item: Item, category: Category, weight: Number, deadline?: DateTime, interval?: Interval, assignee?: Person, source?: Source, completedBy?: Person, completedAt?: DateTime)`
- `_tasks(group: Group) : many (task: Task, item: Item, category: Category, weight: Number, deadline?: DateTime, start?: DateTime, end?: DateTime, assignee?: Person, source?: Source, completedBy?: Person, completedAt?: DateTime)`
- `_schedule(group: Group, from: DateTime, until: DateTime) : many (task: Task, item: Item, category: Category, weight: Number, deadline?: DateTime, start?: DateTime, end?: DateTime, assignee?: Person, source?: Source, completedBy?: Person, completedAt?: DateTime)`
- `_pending(group: Group, asOf: DateTime) : many (task: Task, item: Item, assignee?: Person, interval?: Interval, deadline?: DateTime, status: Status)`
- `_completed(group: Group, asOf: DateTime) : many (task: Task, item: Item, completedBy: Person, completedAt: DateTime, status: Status)`
- `_completedByPerson(group: Group, person: Person) : many (task: Task, completedAt: DateTime, status: Status)`
- `_completedInInterval(group: Group, from: DateTime, until: DateTime) : many (task: Task, completedBy: Person, completedAt: DateTime, status: Status)`
- `_availability(group: Group, person: Person) : many (availability: Availability, interval: Interval)`
- `_hasAvailability(group: Group) : one (available: Flag)`
- `_workload(group: Group, person: Person) : one (workload: Number)`

#### Instances

- `TaskScheduling` — instance of `TaskScheduling` — [Shift Happens Application Types](../design/types.md), line 20.
  - `Category` is `HouseholdManaging.Category` — [Shift Happens Application Types](../design/types.md), line 23.
  - `Group` is `HouseholdManaging.Household` — [Shift Happens Application Types](../design/types.md), line 22.
  - `Item` is `ChoreCataloguing.Chore` — [Shift Happens Application Types](../design/types.md), line 24.
  - `Person` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 21.

## Application types

Concrete types:

- `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 4.
- `ReviewerIdentity` — [Shift Happens Application Types](../design/types.md), line 7.

## Computations

- `assignmentDate(value: String) : DateTime` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 116.
- `assignmentInterval(value: IntervalInput) : Interval` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 118.
- `assignmentIsIncomplete(completedAt?: DateTime) : IncompleteMatch` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 126.
- `assignmentPeople(entries: ScheduleEntries) : People` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 120.
- `assignmentStatus(deadline?: DateTime, interval?: Interval, completedAt?: DateTime, asOf: DateTime) : String` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 124.
- `availabilityWindows(windows: IntervalInputs) : IntervalSet` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 114.
- `matchesPersonalTask(person: String, assignee?: String, completedBy?: String, mode: String) : TaskMatch` — [Chore Assignments](../design/compositions/ChoreAssignments.md), line 122.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (chore) has a valid category in (household)

Authored path: `ChoreAssignments.ValidHouseholdChore`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 35.

```view
(chore) has a valid category in (household) — inputs (chore, household); outputs (category, difficulty); bindings () — answers at most one (category, difficulty)
  where
    ChoreCataloguing._get (chore) has (category, difficulty, group: household)
    HouseholdManaging._categories (household) has (category)
```

### (requester) lives in (household)

Authored path: `ChoreAssignments.CanReadSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.

```view
(requester) lives in (household) — inputs (requester, household); outputs (); bindings ()
  where HouseholdManaging._residents (household) has (person: requester)
```

### (requester) may edit preferences for (person) in (household)

Authored path: `HouseholdManagement.CanEditPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.

```view
(requester) may edit preferences for (person) in (household) — inputs (requester, person, household); outputs (); bindings ()
  where
    HouseholdManaging._residents (household) has (person)
    requester is at most person
    requester is at least person
```

### (requester) oversees (household)

Authored path: `ChoreAssignments.CanManageSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 35.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 54.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 70.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.

```view
(requester) oversees (household) — inputs (requester, household); outputs (); bindings ()
  where HouseholdManaging._household (household) has (overseer: requester)
```

### (requester) may remove (person) from (household)

Authored path: `HouseholdManagement.CanRemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.

```view
(requester) may remove (person) from (household) — inputs (requester, person, household); outputs (); bindings ()
  where view "(requester) oversees (household)" with (household, requester)
  where
    no view "(requester) oversees (household)" with (household, requester)
    requester is at most person
    requester is at least person
```

### (requester) may read preferences for (person) in (household)

Authored path: `HouseholdManagement.CanReadPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.

```view
(requester) may read preferences for (person) in (household) — inputs (requester, person, household); outputs (); bindings ()
  where view "(requester) may remove (person) from (household)" with (household, person, requester)
```

### (requester) may set availability for (person) in (household)

Authored path: `ChoreAssignments.CanEditAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 23.

```view
(requester) may set availability for (person) in (household) — inputs (requester, person, household); outputs (); bindings ()
  where view "(requester) oversees (household)" with (household, requester)
  where
    no view "(requester) oversees (household)" with (household, requester)
    requester is at most person
    requester is at least person
```

### (requester) may read scheduling details for (person) in (household)

Authored path: `ChoreAssignments.CanReadHouseholdDetails`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.

```view
(requester) may read scheduling details for (person) in (household) — inputs (requester, person, household); outputs (); bindings ()
  where view "(requester) may set availability for (person) in (household)" with (household, person, requester)
```

### (task) is an incomplete task in (household)

Authored path: `ChoreAssignments.AssignmentIsModifiable`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.

```view
(task) is an incomplete task in (household) — inputs (task, household); outputs (); bindings (completedAt)
  where
    TaskScheduling._get (task) has (group: household)
    whether TaskScheduling._get (task) has (completedAt)
    (incomplete: true) is assignmentIsIncomplete (completedAt)
```

### (task) matches (mode) for (person)

Authored path: `ChoreAssignments.PersonalTaskMatches`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.

```view
(task) matches (mode) for (person) — inputs (task, person, mode); outputs (); bindings (assignee, completedBy)
  where
    whether TaskScheduling._get (task) has (assignee)
    whether TaskScheduling._get (task) has (completedBy)
    (matches: true) is matchesPersonalTask (assignee, completedBy, mode, person)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### availability for (person) in (household)

Authored path: `ChoreAssignments.PersonAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.

```former
Former "availability for (person) in (household)" — inputs (household, person); bindings (availability, interval); promises exactly one record — forms:
  each TaskScheduling._availability (group: household, person) has (availability, interval)
    form a record of
      availability
      interval
```

### the details of the catalogue (item) in (household)

Authored path: `ChoreAssignments.ChoreDetails`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.

```former
Former "the details of the catalogue (item) in (household)" — inputs (item, household); bindings (name, description, requirements, references); promises at most one record — forms:
  a record of
    where ChoreCataloguing._get (chore: item) has (description, group: household, name, references, requirements)
    description
    name
    references
    requirements
```

### the display details of (task) in (household) at (asOf)

Authored path: `ChoreAssignments.ScheduleTaskDetails`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.

```former
Former "the display details of (task) in (household) at (asOf)" — inputs (task, household, asOf); bindings (item, category, name, deadline, interval, assignee, source, completedAt, completedBy, weight, status); promises exactly one record — forms:
  a record of
    where TaskScheduling._get (task) has (category, group: household, item, weight)
    where whether TaskScheduling._get (task) has (deadline)
    where whether TaskScheduling._get (task) has (interval)
    where whether TaskScheduling._get (task) has (assignee, source)
    where whether TaskScheduling._get (task) has (completedAt, completedBy)
    where status is assignmentStatus (asOf, completedAt, deadline, interval)
    assignee
    category
    categoryName: the name of the first HouseholdManaging._categories (household) has (category, name)
    chore: whether former "the details of the catalogue (item) in (household)" with (household, item)
    completedAt
    completedBy
    deadline
    interval
    item
    source
    status
    task
    weight
```

### the (mode) tasks of (person) in (household) from (from) until (until) at (asOf)

Authored path: `ChoreAssignments.MyTasks`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.

```former
Former "the (mode) tasks of (person) in (household) from (from) until (until) at (asOf)" — inputs (household, from, until, asOf, person, mode); bindings (task); promises exactly one record — forms:
  each TaskScheduling._schedule (from, group: household, until) has (task)
    where view "(task) matches (mode) for (person)" with (mode, person, task)
    form a record of
      … former "the display details of (task) in (household) at (asOf)" with (asOf, household, task)
```

### the categories of (household)

Authored path: `HouseholdManagement.HouseholdCategories`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.

```former
Former "the categories of (household)" — inputs (household); bindings (category, name); promises exactly one record — forms:
  each HouseholdManaging._categories (household) has (category, name)
    form a record of
      category
      name
```

### the details of (household)

Authored path: `HouseholdManagement.HouseholdDetails`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 79.

```former
Former "the details of (household)" — inputs (household); bindings (name, overseer, person, category, categoryName); promises exactly one record — forms:
  a record of
    where HouseholdManaging._household (household) has (name, overseer)
    categories: each HouseholdManaging._categories (household) has (category, name: categoryName)
      form a record of
        category
        name: categoryName
    household
    name
    overseer
    residents: each HouseholdManaging._residents (household) has (person)
      form a record of
        person
```

### the households of (person)

Authored path: `HouseholdManagement.PersonHouseholds`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 75.

```former
Former "the households of (person)" — inputs (person); bindings (household, name, overseer, categories); promises exactly one record — forms:
  each HouseholdManaging._householdsByPerson (person) has (categories, household, name, overseer)
    form a record of
      categories
      household
      name
      overseer
```

### the preferences of (person) in (household)

Authored path: `HouseholdManagement.ResidentPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.

```former
Former "the preferences of (person) in (household)" — inputs (household, person); bindings (category, preferenceLevel); promises exactly one record — forms:
  each HouseholdManaging._preferences (household, person) has (category, preferenceLevel)
    form a record of
      category
      preferenceLevel
```

### the residents of (household)

Authored path: `HouseholdManagement.HouseholdResidents`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.

```former
Former "the residents of (household)" — inputs (household); bindings (person); promises exactly one record — forms:
  each HouseholdManaging._residents (household) has (person)
    form a record of
      person
```

### the schedule of (household) from (from) until (until) at (asOf)

Authored path: `ChoreAssignments.HouseholdSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.

```former
Former "the schedule of (household) from (from) until (until) at (asOf)" — inputs (household, from, until, asOf); bindings (task); promises exactly one record — forms:
  each TaskScheduling._schedule (from, group: household, until) has (task)
    form a record of
      … former "the display details of (task) in (household) at (asOf)" with (asOf, household, task)
```

### the scheduling preferences of (person) in (household)

Authored path: `ChoreAssignments.HouseholdPreferences`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.

```former
Former "the scheduling preferences of (person) in (household)" — inputs (household, person); bindings (category, preferenceLevel); promises exactly one record — forms:
  each HouseholdManaging._preferences (household, person) has (category, preferenceLevel)
    form a record of
      category
      preferenceLevel
```

### the workload of (person) in (household)

Authored path: `ChoreAssignments.ResidentWorkload`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.

```former
Former "the workload of (person) in (household)" — inputs (household, person); bindings (workload); promises exactly one record — forms:
  a record of
    where TaskScheduling._workload (group: household, person) has (workload)
    workload
```

### the scheduling overview of (household)

Authored path: `ChoreAssignments.HouseholdOverview`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.

```former
Former "the scheduling overview of (household)" — inputs (household); bindings (person); promises exactly one record — forms:
  each HouseholdManaging._residents (household) has (person)
    form a record of
      availability: former "availability for (person) in (household)" with (household, person)
      person
      preferences: former "the scheduling preferences of (person) in (household)" with (household, person)
      … former "the workload of (person) in (household)" with (household, person)
```

## Reactions

### ChoreAssignments.AddAvailability

Authored path: `ChoreAssignments.AddAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 29.

```reaction
when RequestBoundary.request (end, household, path: "/assignments/availability/add", person, requestId, session, start)
then
  Sessioning.use (session)
```

### ChoreAssignments.AddAvailability:added#2

Authored path: `ChoreAssignments.AddAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AddAvailability
where
  earlier, RequestBoundary.request (end, household, path: "/assignments/availability/add", person, requestId, session, start)
  view "(requester) may set availability for (person) in (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
  fromDate is assignmentDate (value: start)
  untilDate is assignmentDate (value: end)
then
  TaskScheduling.addAvailability (end: untilDate, group: household, person, start: fromDate)
```

### ChoreAssignments.AddAvailability:added#3

Authored path: `ChoreAssignments.AddAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 29.

```reaction
when TaskScheduling.addAvailability (end: untilDate, group: household, person, start: fromDate, availability), asked by ChoreAssignments.AddAvailability:added#2
where
  earlier, RequestBoundary.request (end, household, path: "/assignments/availability/add", person, requestId, session, start)
then
  RequestBoundary.respond (availability, requestId)
```

### ChoreAssignments.AddAvailability:denied#2

Authored path: `ChoreAssignments.AddAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AddAvailability
where
  earlier, RequestBoundary.request (end, household, path: "/assignments/availability/add", person, requestId, session, start)
  HouseholdManaging._household (household)
  no view "(requester) may set availability for (person) in (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.AddAvailability:missingHousehold#2

Authored path: `ChoreAssignments.AddAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AddAvailability
where
  earlier, RequestBoundary.request (end, household, path: "/assignments/availability/add", person, requestId, session, start)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.AddAvailability:missingResident#2

Authored path: `ChoreAssignments.AddAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AddAvailability
where
  earlier, RequestBoundary.request (end, household, path: "/assignments/availability/add", person, requestId, session, start)
  view "(requester) may set availability for (person) in (household)" with (household, person, requester)
  no HouseholdManaging._residents (household) has (person)
  HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.AutoSchedule

Authored path: `ChoreAssignments.AutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 54.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 61.

```reaction
when RequestBoundary.request (from, household, onlyUnassigned, path: "/assignments/auto-schedule", requestId, session, until)
then
  Sessioning.use (session)
```

### ChoreAssignments.AutoSchedule:denied#2

Authored path: `ChoreAssignments.AutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 54.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 61.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AutoSchedule
where
  earlier, RequestBoundary.request (from, household, onlyUnassigned, path: "/assignments/auto-schedule", requestId, session, until)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.AutoSchedule:missingHousehold#2

Authored path: `ChoreAssignments.AutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 54.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 61.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AutoSchedule
where
  earlier, RequestBoundary.request (from, household, onlyUnassigned, path: "/assignments/auto-schedule", requestId, session, until)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.AutoSchedule:scheduled#2

Authored path: `ChoreAssignments.AutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 54.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 61.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.AutoSchedule
where
  earlier, RequestBoundary.request (from, household, onlyUnassigned, path: "/assignments/auto-schedule", requestId, session, until)
  view "(requester) oversees (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
  HouseholdManaging._schedulingInputs (household) has (people, preferences)
then
  TaskScheduling.autoSchedule (from: fromDate, group: household, onlyUnassigned, people, preferences, until: untilDate)
```

### ChoreAssignments.AutoSchedule:scheduled#3

Authored path: `ChoreAssignments.AutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 54.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 61.

```reaction
when TaskScheduling.autoSchedule (from: fromDate, group: household, onlyUnassigned, people, preferences, until: untilDate, scheduled, unassigned), asked by ChoreAssignments.AutoSchedule:scheduled#2
where
  earlier, RequestBoundary.request (from, household, onlyUnassigned, path: "/assignments/auto-schedule", requestId, session, until)
then
  RequestBoundary.respond (requestId, scheduled, unassigned)
```

### ChoreAssignments.CreateTask

Authored path: `ChoreAssignments.CreateTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 37.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 44.

```reaction
when RequestBoundary.request (chore, deadline, household, interval, path: "/assignments/tasks/create", requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.CreateTask:created#2

Authored path: `ChoreAssignments.CreateTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 37.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 44.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.CreateTask
where
  earlier, RequestBoundary.request (chore, deadline, household, interval, path: "/assignments/tasks/create", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  view "(chore) has a valid category in (household)" with (chore, household) has (category, difficulty: weight)
  due is assignmentDate (value: deadline)
  scheduledInterval is assignmentInterval (value: interval)
then
  TaskScheduling.add (category, deadline: due, group: household, interval: scheduledInterval, item: chore, weight)
```

### ChoreAssignments.CreateTask:created#3

Authored path: `ChoreAssignments.CreateTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 37.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 44.

```reaction
when TaskScheduling.add (category, deadline: due, group: household, interval: scheduledInterval, item: chore, weight, task), asked by ChoreAssignments.CreateTask:created#2
where
  earlier, RequestBoundary.request (chore, deadline, household, interval, path: "/assignments/tasks/create", requestId, session)
then
  RequestBoundary.respond (requestId, task)
```

### ChoreAssignments.CreateTask:denied#2

Authored path: `ChoreAssignments.CreateTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 37.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 44.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.CreateTask
where
  earlier, RequestBoundary.request (chore, deadline, household, interval, path: "/assignments/tasks/create", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.CreateTask:missingChore#2

Authored path: `ChoreAssignments.CreateTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 37.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 44.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.CreateTask
where
  earlier, RequestBoundary.request (chore, deadline, household, interval, path: "/assignments/tasks/create", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no view "(chore) has a valid category in (household)" with (chore, household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.CreateTask:missingHousehold#2

Authored path: `ChoreAssignments.CreateTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 37.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 44.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.CreateTask
where
  earlier, RequestBoundary.request (chore, deadline, household, interval, path: "/assignments/tasks/create", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.EditAvailability

Authored path: `ChoreAssignments.EditAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 28.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 105.

```reaction
when RequestBoundary.request (adding, household, path: "/assignments/availability/edit", requestId, session, windows)
then
  Sessioning.use (session)
```

### ChoreAssignments.EditAvailability:denied#2

Authored path: `ChoreAssignments.EditAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 28.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 105.

```reaction
when Sessioning.use (session, subject: person), asked by ChoreAssignments.EditAvailability
where
  earlier, RequestBoundary.request (adding, household, path: "/assignments/availability/edit", requestId, session, windows)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester: person)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.EditAvailability:edited#2

Authored path: `ChoreAssignments.EditAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 28.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 105.

```reaction
when Sessioning.use (session, subject: person), asked by ChoreAssignments.EditAvailability
where
  earlier, RequestBoundary.request (adding, household, path: "/assignments/availability/edit", requestId, session, windows)
  HouseholdManaging._residents (household) has (person)
  intervals is availabilityWindows (windows)
then
  TaskScheduling.editAvailability (adding, group: household, person, windows: intervals)
```

### ChoreAssignments.EditAvailability:edited#3

Authored path: `ChoreAssignments.EditAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 28.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 105.

```reaction
when TaskScheduling.editAvailability (adding, group: household, person, windows: intervals, freed), asked by ChoreAssignments.EditAvailability:edited#2
where
  earlier, RequestBoundary.request (adding, household, path: "/assignments/availability/edit", requestId, session, windows)
then
  RequestBoundary.respond (freed, requestId)
```

### ChoreAssignments.EditAvailability:missingHousehold#2

Authored path: `ChoreAssignments.EditAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 28.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 105.

```reaction
when Sessioning.use (session, subject: person), asked by ChoreAssignments.EditAvailability
where
  earlier, RequestBoundary.request (adding, household, path: "/assignments/availability/edit", requestId, session, windows)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetAvailability

Authored path: `ChoreAssignments.GetAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 101.

```reaction
when RequestBoundary.request (household, path: "/assignments/availability", person, requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.GetAvailability:availability#2

Authored path: `ChoreAssignments.GetAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 101.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetAvailability
where
  earlier, RequestBoundary.request (household, path: "/assignments/availability", person, requestId, session)
  view "(requester) may read scheduling details for (person) in (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
then
  RequestBoundary.respond (availability: former "availability for (person) in (household)" with (household, person), requestId)
```

### ChoreAssignments.GetAvailability:denied#2

Authored path: `ChoreAssignments.GetAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 101.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetAvailability
where
  earlier, RequestBoundary.request (household, path: "/assignments/availability", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) may read scheduling details for (person) in (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.GetAvailability:missingHousehold#2

Authored path: `ChoreAssignments.GetAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 101.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetAvailability
where
  earlier, RequestBoundary.request (household, path: "/assignments/availability", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetAvailability:missingResident#2

Authored path: `ChoreAssignments.GetAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 101.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetAvailability
where
  earlier, RequestBoundary.request (household, path: "/assignments/availability", person, requestId, session)
  view "(requester) may read scheduling details for (person) in (household)" with (household, person, requester)
  no HouseholdManaging._residents (household) has (person)
  HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetHouseholdOverview

Authored path: `ChoreAssignments.GetHouseholdOverview`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 102.

```reaction
when RequestBoundary.request (household, path: "/assignments/overview", requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.GetHouseholdOverview:denied#2

Authored path: `ChoreAssignments.GetHouseholdOverview`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 102.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetHouseholdOverview
where
  earlier, RequestBoundary.request (household, path: "/assignments/overview", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.GetHouseholdOverview:missingHousehold#2

Authored path: `ChoreAssignments.GetHouseholdOverview`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 102.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetHouseholdOverview
where
  earlier, RequestBoundary.request (household, path: "/assignments/overview", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetHouseholdOverview:overview#2

Authored path: `ChoreAssignments.GetHouseholdOverview`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 90.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 102.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetHouseholdOverview
where
  earlier, RequestBoundary.request (household, path: "/assignments/overview", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (requestId, residents: former "the scheduling overview of (household)" with (household))
```

### ChoreAssignments.GetMyTasks

Authored path: `ChoreAssignments.GetMyTasks`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 99.

```reaction
when RequestBoundary.request (from, household, mode, path: "/assignments/mine", requestId, session, until)
then
  Sessioning.use (session)
```

### ChoreAssignments.GetMyTasks:denied#2

Authored path: `ChoreAssignments.GetMyTasks`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 99.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetMyTasks
where
  earlier, RequestBoundary.request (from, household, mode, path: "/assignments/mine", requestId, session, until)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.GetMyTasks:invalidWindow#2

Authored path: `ChoreAssignments.GetMyTasks`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 99.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetMyTasks
where
  earlier, RequestBoundary.request (from, household, mode, path: "/assignments/mine", requestId, session, until)
  view "(requester) lives in (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
  fromDate is at least untilDate
then
  RequestBoundary.respond (error: "SCHEDULE_WINDOW_INVALID", requestId)
```

### ChoreAssignments.GetMyTasks:missingHousehold#2

Authored path: `ChoreAssignments.GetMyTasks`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 99.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetMyTasks
where
  earlier, RequestBoundary.request (from, household, mode, path: "/assignments/mine", requestId, session, until)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetMyTasks:tasks#2

Authored path: `ChoreAssignments.GetMyTasks`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 88.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 99.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetMyTasks
where
  asOf is the current flow's instant
  earlier, RequestBoundary.request (from, household, mode, path: "/assignments/mine", requestId, session, until)
  view "(requester) lives in (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
  fromDate is less than untilDate
then
  RequestBoundary.respond (requestId, tasks: former "the (mode) tasks of (person) in (household) from (from) until (until) at (asOf)" with (asOf, from: fromDate, household, mode, person: requester, until: untilDate))
```

### ChoreAssignments.GetSchedule

Authored path: `ChoreAssignments.GetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 98.

```reaction
when RequestBoundary.request (from, household, path: "/assignments/schedule", requestId, session, until)
then
  Sessioning.use (session)
```

### ChoreAssignments.GetSchedule:denied#2

Authored path: `ChoreAssignments.GetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 98.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetSchedule
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/schedule", requestId, session, until)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.GetSchedule:invalidWindow#2

Authored path: `ChoreAssignments.GetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 98.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetSchedule
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/schedule", requestId, session, until)
  view "(requester) lives in (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
  fromDate is at least untilDate
then
  RequestBoundary.respond (error: "SCHEDULE_WINDOW_INVALID", requestId)
```

### ChoreAssignments.GetSchedule:missingHousehold#2

Authored path: `ChoreAssignments.GetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 98.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetSchedule
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/schedule", requestId, session, until)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetSchedule:schedule#2

Authored path: `ChoreAssignments.GetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 98.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetSchedule
where
  asOf is the current flow's instant
  earlier, RequestBoundary.request (from, household, path: "/assignments/schedule", requestId, session, until)
  view "(requester) lives in (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
  fromDate is less than untilDate
then
  RequestBoundary.respond (requestId, tasks: former "the schedule of (household) from (from) until (until) at (asOf)" with (asOf, from: fromDate, household, until: untilDate))
```

### ChoreAssignments.GetTask

Authored path: `ChoreAssignments.GetTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 97.

```reaction
when RequestBoundary.request (household, path: "/assignments/task", requestId, session, task)
then
  Sessioning.use (session)
```

### ChoreAssignments.GetTask:denied#2

Authored path: `ChoreAssignments.GetTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 97.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/task", requestId, session, task)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.GetTask:missingHousehold#2

Authored path: `ChoreAssignments.GetTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 97.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/task", requestId, session, task)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetTask:missingTask#2

Authored path: `ChoreAssignments.GetTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 97.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/task", requestId, session, task)
  view "(requester) lives in (household)" with (household, requester)
  no TaskScheduling._get (task) has (group: household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetTask:task#2

Authored path: `ChoreAssignments.GetTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 86.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 97.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTask
where
  asOf is the current flow's instant
  earlier, RequestBoundary.request (household, path: "/assignments/task", requestId, session, task)
  view "(requester) lives in (household)" with (household, requester)
  TaskScheduling._get (task) has (group: household)
then
  RequestBoundary.respond (requestId, task: former "the display details of (task) in (household) at (asOf)" with (asOf, household, task))
```

### ChoreAssignments.GetTotal

Authored path: `ChoreAssignments.GetTotal`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 100.

```reaction
when RequestBoundary.request (household, path: "/assignments/total", person, requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.GetTotal:denied#2

Authored path: `ChoreAssignments.GetTotal`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 100.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTotal
where
  earlier, RequestBoundary.request (household, path: "/assignments/total", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) may read scheduling details for (person) in (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.GetTotal:missingHousehold#2

Authored path: `ChoreAssignments.GetTotal`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 100.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTotal
where
  earlier, RequestBoundary.request (household, path: "/assignments/total", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetTotal:missingResident#2

Authored path: `ChoreAssignments.GetTotal`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 100.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTotal
where
  earlier, RequestBoundary.request (household, path: "/assignments/total", person, requestId, session)
  view "(requester) may read scheduling details for (person) in (household)" with (household, person, requester)
  no HouseholdManaging._residents (household) has (person)
  HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.GetTotal:total#2

Authored path: `ChoreAssignments.GetTotal`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 92.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 100.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.GetTotal
where
  earlier, RequestBoundary.request (household, path: "/assignments/total", person, requestId, session)
  view "(requester) may read scheduling details for (person) in (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
  TaskScheduling._workload (group: household, person) has (workload)
then
  RequestBoundary.respond (requestId, workload)
```

### ChoreAssignments.RemoveAvailability

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.RemoveAvailability:denied#2

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveAvailability
where
  earlier, RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) may set availability for (person) in (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.RemoveAvailability:missingAvailability#2

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveAvailability
where
  earlier, RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
  view "(requester) may set availability for (person) in (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
  no TaskScheduling._availability (group: household, person) has (availability)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.RemoveAvailability:missingHousehold#2

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveAvailability
where
  earlier, RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.RemoveAvailability:missingResident#2

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveAvailability
where
  earlier, RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
  view "(requester) may set availability for (person) in (household)" with (household, person, requester)
  no HouseholdManaging._residents (household) has (person)
  HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.RemoveAvailability:removed#2

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveAvailability
where
  earlier, RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
  view "(requester) may set availability for (person) in (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
  TaskScheduling._availability (group: household, person) has (availability)
then
  TaskScheduling.removeAvailability (availability)
```

### ChoreAssignments.RemoveAvailability:removed#3

Authored path: `ChoreAssignments.RemoveAvailability`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 21.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 30.

```reaction
when TaskScheduling.removeAvailability (availability, freed), asked by ChoreAssignments.RemoveAvailability:removed#2
where
  earlier, RequestBoundary.request (availability, household, path: "/assignments/availability/remove", person, requestId, session)
then
  RequestBoundary.respond (freed, requestId)
```

### ChoreAssignments.RemoveTask

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
then
  Sessioning.use (session)
```

### ChoreAssignments.RemoveTask:changed#2

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  view "(task) is an incomplete task in (household)" with (household, task)
then
  TaskScheduling.remove (task)
```

### ChoreAssignments.RemoveTask:changed#3

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when TaskScheduling.remove (task), asked by ChoreAssignments.RemoveTask:changed#2
where
  earlier, RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
then
  RequestBoundary.respond (requestId, task)
```

### ChoreAssignments.RemoveTask:completedTask#2

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  TaskScheduling._get (task) has (group: household)
  no view "(task) is an incomplete task in (household)" with (household, task)
then
  RequestBoundary.respond (error: "TASK_STATUS_CONFLICT", requestId)
```

### ChoreAssignments.RemoveTask:denied#2

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.RemoveTask:missingHousehold#2

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.RemoveTask:missingTask#2

Authored path: `ChoreAssignments.RemoveTask`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 45.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RemoveTask
where
  earlier, RequestBoundary.request (household, path: "/assignments/tasks/remove", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  no TaskScheduling._get (task) has (group: household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.Reset

Authored path: `ChoreAssignments.Reset`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 58.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 63.

```reaction
when RequestBoundary.request (from, household, path: "/assignments/reset", requestId, session, until)
then
  Sessioning.use (session)
```

### ChoreAssignments.Reset:denied#2

Authored path: `ChoreAssignments.Reset`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 58.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 63.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.Reset
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/reset", requestId, session, until)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.Reset:missingHousehold#2

Authored path: `ChoreAssignments.Reset`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 58.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 63.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.Reset
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/reset", requestId, session, until)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.Reset:reset#2

Authored path: `ChoreAssignments.Reset`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 58.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 63.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.Reset
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/reset", requestId, session, until)
  view "(requester) oversees (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
then
  TaskScheduling.reset (from: fromDate, group: household, until: untilDate)
```

### ChoreAssignments.Reset:reset#3

Authored path: `ChoreAssignments.Reset`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 58.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 63.

```reaction
when TaskScheduling.reset (from: fromDate, group: household, until: untilDate, cleared), asked by ChoreAssignments.Reset:reset#2
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/reset", requestId, session, until)
then
  RequestBoundary.respond (cleared, requestId)
```

### ChoreAssignments.ResidentRemoved

Authored path: `ChoreAssignments.ResidentRemoved`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 11.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when HouseholdManaging.removeResident (household, person)
where
  no HouseholdManaging._residents (household) has (person)
then
  TaskScheduling.removePerson (group: household, person)
```

### ChoreAssignments.RetryResidentCleanup

Authored path: `ChoreAssignments.RetryResidentCleanup`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 13.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 16.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when RequestBoundary.request (household, path: "/assignments/residents/cleanup", person, requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.RetryResidentCleanup:cleaned#2

Authored path: `ChoreAssignments.RetryResidentCleanup`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 13.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 16.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RetryResidentCleanup
where
  earlier, RequestBoundary.request (household, path: "/assignments/residents/cleanup", person, requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no HouseholdManaging._residents (household) has (person)
then
  TaskScheduling.removePerson (group: household, person)
```

### ChoreAssignments.RetryResidentCleanup:cleaned#3

Authored path: `ChoreAssignments.RetryResidentCleanup`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 13.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 16.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when TaskScheduling.removePerson (group: household, person, freed), asked by ChoreAssignments.RetryResidentCleanup:cleaned#2
where
  earlier, RequestBoundary.request (household, path: "/assignments/residents/cleanup", person, requestId, session)
then
  RequestBoundary.respond (freed, requestId)
```

### ChoreAssignments.RetryResidentCleanup:denied#2

Authored path: `ChoreAssignments.RetryResidentCleanup`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 13.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 16.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RetryResidentCleanup
where
  earlier, RequestBoundary.request (household, path: "/assignments/residents/cleanup", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.RetryResidentCleanup:missingHousehold#2

Authored path: `ChoreAssignments.RetryResidentCleanup`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 13.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 16.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RetryResidentCleanup
where
  earlier, RequestBoundary.request (household, path: "/assignments/residents/cleanup", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.RetryResidentCleanup:stillResident#2

Authored path: `ChoreAssignments.RetryResidentCleanup`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 13.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 16.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 23.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.RetryResidentCleanup
where
  earlier, RequestBoundary.request (household, path: "/assignments/residents/cleanup", person, requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  HouseholdManaging._residents (household) has (person)
then
  RequestBoundary.respond (error: "RESIDENT_STILL_PRESENT", requestId)
```

### ChoreAssignments.SetSchedule

Authored path: `ChoreAssignments.SetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 75.

```reaction
when RequestBoundary.request (entries, household, path: "/assignments/set", requestId, session)
then
  Sessioning.use (session)
```

### ChoreAssignments.SetSchedule:assigned#2

Authored path: `ChoreAssignments.SetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 75.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.SetSchedule
where
  earlier, RequestBoundary.request (entries, household, path: "/assignments/set", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  people is assignmentPeople (entries)
  HouseholdManaging._allResidents (household, people) has (all: true)
then
  TaskScheduling.setSchedule (entries, group: household)
```

### ChoreAssignments.SetSchedule:assigned#3

Authored path: `ChoreAssignments.SetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 75.

```reaction
when TaskScheduling.setSchedule (entries, group: household, result.entries: updated), asked by ChoreAssignments.SetSchedule:assigned#2
where
  earlier, RequestBoundary.request (entries, household, path: "/assignments/set", requestId, session)
then
  RequestBoundary.respond (entries: updated, requestId)
```

### ChoreAssignments.SetSchedule:denied#2

Authored path: `ChoreAssignments.SetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 75.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.SetSchedule
where
  earlier, RequestBoundary.request (entries, household, path: "/assignments/set", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.SetSchedule:missingAssignee#2

Authored path: `ChoreAssignments.SetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 75.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.SetSchedule
where
  earlier, RequestBoundary.request (entries, household, path: "/assignments/set", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  people is assignmentPeople (entries)
  HouseholdManaging._allResidents (household, people) has (all: false)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.SetSchedule:missingHousehold#2

Authored path: `ChoreAssignments.SetSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 68.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 75.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.SetSchedule
where
  earlier, RequestBoundary.request (entries, household, path: "/assignments/set", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.UpdateDeadline

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
then
  Sessioning.use (session)
```

### ChoreAssignments.UpdateDeadline:changed#2

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateDeadline
where
  earlier, RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  view "(task) is an incomplete task in (household)" with (household, task)
  timing is assignmentDate (value: deadline)
then
  TaskScheduling.updateDeadline (deadline: timing, task)
```

### ChoreAssignments.UpdateDeadline:changed#3

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when TaskScheduling.updateDeadline (deadline: timing, task), asked by ChoreAssignments.UpdateDeadline:changed#2
where
  earlier, RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
then
  RequestBoundary.respond (requestId, task)
```

### ChoreAssignments.UpdateDeadline:completedTask#2

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateDeadline
where
  earlier, RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  TaskScheduling._get (task) has (group: household)
  no view "(task) is an incomplete task in (household)" with (household, task)
then
  RequestBoundary.respond (error: "TASK_STATUS_CONFLICT", requestId)
```

### ChoreAssignments.UpdateDeadline:denied#2

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateDeadline
where
  earlier, RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.UpdateDeadline:missingHousehold#2

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateDeadline
where
  earlier, RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.UpdateDeadline:missingTask#2

Authored path: `ChoreAssignments.UpdateDeadline`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 46.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateDeadline
where
  earlier, RequestBoundary.request (deadline, household, path: "/assignments/tasks/deadline", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  no TaskScheduling._get (task) has (group: household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.UpdateInterval

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
then
  Sessioning.use (session)
```

### ChoreAssignments.UpdateInterval:changed#2

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateInterval
where
  earlier, RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  view "(task) is an incomplete task in (household)" with (household, task)
  timing is assignmentInterval (value: interval)
then
  TaskScheduling.updateInterval (interval: timing, task)
```

### ChoreAssignments.UpdateInterval:changed#3

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when TaskScheduling.updateInterval (interval: timing, task), asked by ChoreAssignments.UpdateInterval:changed#2
where
  earlier, RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
then
  RequestBoundary.respond (requestId, task)
```

### ChoreAssignments.UpdateInterval:completedTask#2

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateInterval
where
  earlier, RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  TaskScheduling._get (task) has (group: household)
  no view "(task) is an incomplete task in (household)" with (household, task)
then
  RequestBoundary.respond (error: "TASK_STATUS_CONFLICT", requestId)
```

### ChoreAssignments.UpdateInterval:denied#2

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateInterval
where
  earlier, RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.UpdateInterval:missingHousehold#2

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateInterval
where
  earlier, RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.UpdateInterval:missingTask#2

Authored path: `ChoreAssignments.UpdateInterval`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 39.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 47.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.UpdateInterval
where
  earlier, RequestBoundary.request (household, interval, path: "/assignments/tasks/interval", requestId, session, task)
  view "(requester) oversees (household)" with (household, requester)
  no TaskScheduling._get (task) has (group: household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.WeeklyAutoSchedule

Authored path: `ChoreAssignments.WeeklyAutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 52.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 62.

```reaction
when RequestBoundary.request (from, household, path: "/assignments/weekly", requestId, session, until)
then
  Sessioning.use (session)
```

### ChoreAssignments.WeeklyAutoSchedule:denied#2

Authored path: `ChoreAssignments.WeeklyAutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 52.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 62.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.WeeklyAutoSchedule
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/weekly", requestId, session, until)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### ChoreAssignments.WeeklyAutoSchedule:missingHousehold#2

Authored path: `ChoreAssignments.WeeklyAutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 52.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 62.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.WeeklyAutoSchedule
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/weekly", requestId, session, until)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### ChoreAssignments.WeeklyAutoSchedule:scheduled#2

Authored path: `ChoreAssignments.WeeklyAutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 52.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 62.

```reaction
when Sessioning.use (session, subject: requester), asked by ChoreAssignments.WeeklyAutoSchedule
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/weekly", requestId, session, until)
  view "(requester) oversees (household)" with (household, requester)
  fromDate is assignmentDate (value: from)
  untilDate is assignmentDate (value: until)
  HouseholdManaging._schedulingInputs (household) has (people, preferences)
then
  TaskScheduling.autoSchedule (from: fromDate, group: household, onlyUnassigned: true, people, preferences, until: untilDate)
```

### ChoreAssignments.WeeklyAutoSchedule:scheduled#3

Authored path: `ChoreAssignments.WeeklyAutoSchedule`.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 52.
- Covered by [Chore Assignments](../design/compositions/ChoreAssignments.md), line 62.

```reaction
when TaskScheduling.autoSchedule (from: fromDate, group: household, onlyUnassigned: true, people, preferences, until: untilDate, scheduled, unassigned), asked by ChoreAssignments.WeeklyAutoSchedule:scheduled#2
where
  earlier, RequestBoundary.request (from, household, path: "/assignments/weekly", requestId, session, until)
then
  RequestBoundary.respond (requestId, scheduled, unassigned)
```

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### HouseholdManagement.AddCategory

Authored path: `HouseholdManagement.AddCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 56.

```reaction
when RequestBoundary.request (household, name, path: "/households/categories/add", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.AddCategory:accessDenied#2

Authored path: `HouseholdManagement.AddCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 56.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddCategory
where
  earlier, RequestBoundary.request (household, name, path: "/households/categories/add", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.AddCategory:added#2

Authored path: `HouseholdManagement.AddCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 56.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddCategory
where
  earlier, RequestBoundary.request (household, name, path: "/households/categories/add", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
then
  HouseholdManaging.addCategory (household, name)
```

### HouseholdManagement.AddCategory:added#3

Authored path: `HouseholdManagement.AddCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 56.

```reaction
when HouseholdManaging.addCategory (household, name, category), asked by HouseholdManagement.AddCategory:added#2
where
  earlier, RequestBoundary.request (household, name, path: "/households/categories/add", requestId, session)
then
  RequestBoundary.respond (category, requestId)
```

### HouseholdManagement.AddCategory:missingHousehold#2

Authored path: `HouseholdManagement.AddCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 56.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddCategory
where
  earlier, RequestBoundary.request (household, name, path: "/households/categories/add", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.AddResident

Authored path: `HouseholdManagement.AddResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 19.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 28.

```reaction
when RequestBoundary.request (household, path: "/households/residents/add", person, requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.AddResident:accessDenied#2

Authored path: `HouseholdManagement.AddResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 19.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 28.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/add", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.AddResident:added#2

Authored path: `HouseholdManagement.AddResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 19.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 28.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/add", person, requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  Registering._username (user: person)
then
  HouseholdManaging.addResident (household, person)
```

### HouseholdManagement.AddResident:added#3

Authored path: `HouseholdManagement.AddResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 19.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 28.

```reaction
when HouseholdManaging.addResident (household, person, residency), asked by HouseholdManagement.AddResident:added#2
where
  earlier, RequestBoundary.request (household, path: "/households/residents/add", person, requestId, session)
then
  RequestBoundary.respond (requestId, residency)
```

### HouseholdManagement.AddResident:missingHousehold#2

Authored path: `HouseholdManagement.AddResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 19.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 28.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/add", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.AddResident:missingPerson#2

Authored path: `HouseholdManagement.AddResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 19.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 28.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.AddResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/add", person, requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no Registering._username (user: person)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.CreateHousehold

Authored path: `HouseholdManagement.CreateHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 9.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 14.

```reaction
when RequestBoundary.request (name, path: "/households/create", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.CreateHousehold#2

Authored path: `HouseholdManagement.CreateHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 9.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 14.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.CreateHousehold
where
  earlier, RequestBoundary.request (name, path: "/households/create", requestId, session)
then
  HouseholdManaging.create (name, overseer: requester)
```

### HouseholdManagement.CreateHousehold#3

Authored path: `HouseholdManagement.CreateHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 9.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 14.

```reaction
when HouseholdManaging.create (name, overseer: requester, household), asked by HouseholdManagement.CreateHousehold#2
where
  earlier, RequestBoundary.request (name, path: "/households/create", requestId, session)
then
  RequestBoundary.respond (household, requestId)
```

### HouseholdManagement.GetCategories

Authored path: `HouseholdManagement.GetCategories`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 91.

```reaction
when RequestBoundary.request (household, path: "/households/categories", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.GetCategories:accessDenied#2

Authored path: `HouseholdManagement.GetCategories`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 91.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetCategories
where
  earlier, RequestBoundary.request (household, path: "/households/categories", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.GetCategories:categories#2

Authored path: `HouseholdManagement.GetCategories`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 91.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetCategories
where
  earlier, RequestBoundary.request (household, path: "/households/categories", requestId, session)
  view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (categories: former "the categories of (household)" with (household), requestId)
```

### HouseholdManagement.GetCategories:missingHousehold#2

Authored path: `HouseholdManagement.GetCategories`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 91.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetCategories
where
  earlier, RequestBoundary.request (household, path: "/households/categories", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.GetHousehold

Authored path: `HouseholdManagement.GetHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 79.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 89.

```reaction
when RequestBoundary.request (household, path: "/households/get", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.GetHousehold:accessDenied#2

Authored path: `HouseholdManagement.GetHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 79.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 89.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/get", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.GetHousehold:details#2

Authored path: `HouseholdManagement.GetHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 79.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 89.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/get", requestId, session)
  view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (household: former "the details of (household)" with (household), requestId)
```

### HouseholdManagement.GetHousehold:missingHousehold#2

Authored path: `HouseholdManagement.GetHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 79.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 89.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/get", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.GetPreferences

Authored path: `HouseholdManagement.GetPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 92.

```reaction
when RequestBoundary.request (household, path: "/households/preferences", person, requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.GetPreferences:accessDenied#2

Authored path: `HouseholdManagement.GetPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 92.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetPreferences
where
  earlier, RequestBoundary.request (household, path: "/households/preferences", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) may read preferences for (person) in (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.GetPreferences:missingHousehold#2

Authored path: `HouseholdManagement.GetPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 92.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetPreferences
where
  earlier, RequestBoundary.request (household, path: "/households/preferences", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.GetPreferences:missingResident#2

Authored path: `HouseholdManagement.GetPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 92.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetPreferences
where
  earlier, RequestBoundary.request (household, path: "/households/preferences", person, requestId, session)
  view "(requester) may read preferences for (person) in (household)" with (household, person, requester)
  no HouseholdManaging._residents (household) has (person)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.GetPreferences:preferences#2

Authored path: `HouseholdManagement.GetPreferences`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 83.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 92.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetPreferences
where
  earlier, RequestBoundary.request (household, path: "/households/preferences", person, requestId, session)
  view "(requester) may read preferences for (person) in (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
then
  RequestBoundary.respond (preferences: former "the preferences of (person) in (household)" with (household, person), requestId)
```

### HouseholdManagement.GetResidents

Authored path: `HouseholdManagement.GetResidents`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 90.

```reaction
when RequestBoundary.request (household, path: "/households/residents", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.GetResidents:accessDenied#2

Authored path: `HouseholdManagement.GetResidents`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 90.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetResidents
where
  earlier, RequestBoundary.request (household, path: "/households/residents", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.GetResidents:missingHousehold#2

Authored path: `HouseholdManagement.GetResidents`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 90.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetResidents
where
  earlier, RequestBoundary.request (household, path: "/households/residents", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.GetResidents:residents#2

Authored path: `HouseholdManagement.GetResidents`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 81.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 90.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.GetResidents
where
  earlier, RequestBoundary.request (household, path: "/households/residents", requestId, session)
  view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (requestId, residents: former "the residents of (household)" with (household))
```

### HouseholdManagement.MyHouseholds

Authored path: `HouseholdManagement.MyHouseholds`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 75.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 88.

```reaction
when RequestBoundary.request (path: "/households/mine", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.MyHouseholds#2

Authored path: `HouseholdManagement.MyHouseholds`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 75.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 88.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.MyHouseholds
where
  earlier, RequestBoundary.request (path: "/households/mine", requestId, session)
then
  RequestBoundary.respond (households: former "the households of (person)" with (person: requester), requestId)
```

### HouseholdManagement.RemoveCategory

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.RemoveCategory:accessDenied#2

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveCategory
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.RemoveCategory:hasChores#2

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveCategory
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  HouseholdManaging._categories (household) has (category)
  ChoreCataloguing._choresByCategory (category, group: household, sortByDifficulty: false)
then
  RequestBoundary.respond (error: "CATEGORY_IN_USE", requestId)
```

### HouseholdManagement.RemoveCategory:hasTasks#2

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveCategory
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  HouseholdManaging._categories (household) has (category)
  no ChoreCataloguing._choresByCategory (category, group: household, sortByDifficulty: false)
  TaskScheduling._tasks (group: household) has (category)
then
  RequestBoundary.respond (error: "CATEGORY_IN_USE", requestId)
```

### HouseholdManagement.RemoveCategory:missingCategory#2

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveCategory
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no HouseholdManaging._categories (household) has (category)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RemoveCategory:missingHousehold#2

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveCategory
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RemoveCategory:removed#2

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveCategory
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  HouseholdManaging._categories (household) has (category)
  no ChoreCataloguing._choresByCategory (category, group: household, sortByDifficulty: false)
  no TaskScheduling._tasks (group: household) has (category)
then
  HouseholdManaging.removeCategory (category, household)
```

### HouseholdManagement.RemoveCategory:removed#3

Authored path: `HouseholdManagement.RemoveCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 51.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 58.

```reaction
when HouseholdManaging.removeCategory (category, household), asked by HouseholdManagement.RemoveCategory:removed#2
where
  earlier, RequestBoundary.request (category, household, path: "/households/categories/remove", requestId, session)
then
  RequestBoundary.respond (category, requestId)
```

### HouseholdManagement.RemoveHousehold

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when RequestBoundary.request (household, path: "/households/remove", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.RemoveHousehold:accessDenied#2

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.RemoveHousehold:hasAvailability#2

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no ChoreCataloguing._chores (group: household, sortByDifficulty: false)
  no TaskScheduling._tasks (group: household)
  TaskScheduling._hasAvailability (group: household) has (available: true)
then
  RequestBoundary.respond (error: "HOUSEHOLD_IN_USE", requestId)
```

### HouseholdManagement.RemoveHousehold:hasChores#2

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  ChoreCataloguing._chores (group: household, sortByDifficulty: false)
then
  RequestBoundary.respond (error: "HOUSEHOLD_IN_USE", requestId)
```

### HouseholdManagement.RemoveHousehold:hasTasks#2

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no ChoreCataloguing._chores (group: household, sortByDifficulty: false)
  TaskScheduling._tasks (group: household)
then
  RequestBoundary.respond (error: "HOUSEHOLD_IN_USE", requestId)
```

### HouseholdManagement.RemoveHousehold:missingHousehold#2

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RemoveHousehold:removed#2

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveHousehold
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no ChoreCataloguing._chores (group: household, sortByDifficulty: false)
  no TaskScheduling._tasks (group: household)
  no TaskScheduling._hasAvailability (group: household) has (available: true)
then
  HouseholdManaging.remove (household)
```

### HouseholdManagement.RemoveHousehold:removed#3

Authored path: `HouseholdManagement.RemoveHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 99.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 104.

```reaction
when HouseholdManaging.remove (household), asked by HouseholdManagement.RemoveHousehold:removed#2
where
  earlier, RequestBoundary.request (household, path: "/households/remove", requestId, session)
then
  RequestBoundary.respond (household, requestId)
```

### HouseholdManagement.RemoveResident

Authored path: `HouseholdManagement.RemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 29.

```reaction
when RequestBoundary.request (household, path: "/households/residents/remove", person, requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.RemoveResident:accessDenied#2

Authored path: `HouseholdManagement.RemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/remove", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) may remove (person) from (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.RemoveResident:missingHousehold#2

Authored path: `HouseholdManagement.RemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/remove", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RemoveResident:missingResident#2

Authored path: `HouseholdManagement.RemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/remove", person, requestId, session)
  view "(requester) may remove (person) from (household)" with (household, person, requester)
  no HouseholdManaging._residents (household) has (person)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RemoveResident:removed#2

Authored path: `HouseholdManagement.RemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 29.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RemoveResident
where
  earlier, RequestBoundary.request (household, path: "/households/residents/remove", person, requestId, session)
  view "(requester) may remove (person) from (household)" with (household, person, requester)
  HouseholdManaging._residents (household) has (person)
then
  HouseholdManaging.removeResident (household, person)
```

### HouseholdManagement.RemoveResident:removed#3

Authored path: `HouseholdManagement.RemoveResident`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 21.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 29.

```reaction
when HouseholdManaging.removeResident (household, person, residency), asked by HouseholdManagement.RemoveResident:removed#2
where
  earlier, RequestBoundary.request (household, path: "/households/residents/remove", person, requestId, session)
then
  RequestBoundary.respond (household, person, requestId, residency)
```

### HouseholdManagement.RenameCategory

Authored path: `HouseholdManagement.RenameCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 57.

```reaction
when RequestBoundary.request (category, household, name, path: "/households/categories/rename", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.RenameCategory:accessDenied#2

Authored path: `HouseholdManagement.RenameCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 57.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameCategory
where
  earlier, RequestBoundary.request (category, household, name, path: "/households/categories/rename", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.RenameCategory:missingCategory#2

Authored path: `HouseholdManagement.RenameCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 57.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameCategory
where
  earlier, RequestBoundary.request (category, household, name, path: "/households/categories/rename", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no HouseholdManaging._categories (household) has (category)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RenameCategory:missingHousehold#2

Authored path: `HouseholdManagement.RenameCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 57.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameCategory
where
  earlier, RequestBoundary.request (category, household, name, path: "/households/categories/rename", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RenameCategory:renamed#2

Authored path: `HouseholdManagement.RenameCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 57.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameCategory
where
  earlier, RequestBoundary.request (category, household, name, path: "/households/categories/rename", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  HouseholdManaging._categories (household) has (category)
then
  HouseholdManaging.renameCategory (category, household, name)
```

### HouseholdManagement.RenameCategory:renamed#3

Authored path: `HouseholdManagement.RenameCategory`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 49.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 57.

```reaction
when HouseholdManaging.renameCategory (category, household, name), asked by HouseholdManagement.RenameCategory:renamed#2
where
  earlier, RequestBoundary.request (category, household, name, path: "/households/categories/rename", requestId, session)
then
  RequestBoundary.respond (category, requestId)
```

### HouseholdManagement.RenameHousehold

Authored path: `HouseholdManagement.RenameHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 41.

```reaction
when RequestBoundary.request (household, name, path: "/households/rename", requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.RenameHousehold:accessDenied#2

Authored path: `HouseholdManagement.RenameHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 41.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameHousehold
where
  earlier, RequestBoundary.request (household, name, path: "/households/rename", requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.RenameHousehold:missingHousehold#2

Authored path: `HouseholdManagement.RenameHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 41.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameHousehold
where
  earlier, RequestBoundary.request (household, name, path: "/households/rename", requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.RenameHousehold:renamed#2

Authored path: `HouseholdManagement.RenameHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 41.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.RenameHousehold
where
  earlier, RequestBoundary.request (household, name, path: "/households/rename", requestId, session)
  view "(requester) oversees (household)" with (household, requester)
then
  HouseholdManaging.rename (household, name)
```

### HouseholdManagement.RenameHousehold:renamed#3

Authored path: `HouseholdManagement.RenameHousehold`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 41.

```reaction
when HouseholdManaging.rename (household, name), asked by HouseholdManagement.RenameHousehold:renamed#2
where
  earlier, RequestBoundary.request (household, name, path: "/households/rename", requestId, session)
then
  RequestBoundary.respond (household, requestId)
```

### HouseholdManagement.SetOverseer

Authored path: `HouseholdManagement.SetOverseer`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 42.

```reaction
when RequestBoundary.request (household, path: "/households/overseer", person, requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.SetOverseer:accessDenied#2

Authored path: `HouseholdManagement.SetOverseer`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 42.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetOverseer
where
  earlier, RequestBoundary.request (household, path: "/households/overseer", person, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) oversees (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.SetOverseer:missingHousehold#2

Authored path: `HouseholdManagement.SetOverseer`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 42.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetOverseer
where
  earlier, RequestBoundary.request (household, path: "/households/overseer", person, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.SetOverseer:missingResident#2

Authored path: `HouseholdManagement.SetOverseer`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 42.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetOverseer
where
  earlier, RequestBoundary.request (household, path: "/households/overseer", person, requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  no HouseholdManaging._residents (household) has (person)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.SetOverseer:transferred#2

Authored path: `HouseholdManagement.SetOverseer`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 42.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetOverseer
where
  earlier, RequestBoundary.request (household, path: "/households/overseer", person, requestId, session)
  view "(requester) oversees (household)" with (household, requester)
  HouseholdManaging._residents (household) has (person)
then
  HouseholdManaging.setOverseer (household, person)
```

### HouseholdManagement.SetOverseer:transferred#3

Authored path: `HouseholdManagement.SetOverseer`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 36.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 42.

```reaction
when HouseholdManaging.setOverseer (household, person), asked by HouseholdManagement.SetOverseer:transferred#2
where
  earlier, RequestBoundary.request (household, path: "/households/overseer", person, requestId, session)
then
  RequestBoundary.respond (household, requestId)
```

### HouseholdManagement.SetPreference

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
then
  Sessioning.use (session)
```

### HouseholdManagement.SetPreference:accessDenied#2

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetPreference
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
  HouseholdManaging._residents (household) has (person)
  view "(requester) lives in (household)" with (household, requester)
  no view "(requester) may edit preferences for (person) in (household)" with (household, person, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### HouseholdManagement.SetPreference:edited#2

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetPreference
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
  view "(requester) may edit preferences for (person) in (household)" with (household, person, requester)
  HouseholdManaging._categories (household) has (category)
then
  HouseholdManaging.setPreference (category, household, person, preferenceLevel)
```

### HouseholdManagement.SetPreference:edited#3

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when HouseholdManaging.setPreference (category, household, person, preferenceLevel, preference), asked by HouseholdManagement.SetPreference:edited#2
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
then
  RequestBoundary.respond (preference, requestId)
```

### HouseholdManagement.SetPreference:missingCategory#2

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetPreference
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
  view "(requester) may edit preferences for (person) in (household)" with (household, person, requester)
  no HouseholdManaging._categories (household) has (category)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.SetPreference:missingHousehold#2

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetPreference
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
  no HouseholdManaging._household (household)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.SetPreference:missingResident#2

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetPreference
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
  HouseholdManaging._household (household)
  no HouseholdManaging._residents (household) has (person)
  view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### HouseholdManagement.SetPreference:notMember#2

Authored path: `HouseholdManagement.SetPreference`.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 65.
- Covered by [Household Management](../design/compositions/HouseholdManagement.md), line 70.

```reaction
when Sessioning.use (session, subject: requester), asked by HouseholdManagement.SetPreference
where
  earlier, RequestBoundary.request (category, household, path: "/households/preferences/set", person, preferenceLevel, requestId, session)
  HouseholdManaging._household (household)
  no view "(requester) lives in (household)" with (household, requester)
then
  RequestBoundary.respond (error: "ACCESS_DENIED", requestId)
```

### Users.Register:accepted

Authored path: `Users.Register`.
- Covered by [Users](../design/compositions/Users.md), line 23.
- Covered by [Users](../design/compositions/Users.md), line 30.

```reaction
when RequestBoundary.request (password, path: "/user/register", requestId, username)
where
  Authenticating._acceptable (password) has (acceptable: true)
then
  Registering.register (username)
```

### Users.Register:accepted#2

Authored path: `Users.Register`.
- Covered by [Users](../design/compositions/Users.md), line 23.
- Covered by [Users](../design/compositions/Users.md), line 30.

```reaction
when Registering.register (username, user), asked by Users.Register:accepted
where
  earlier, RequestBoundary.request (password, path: "/user/register", requestId, username)
then
  Authenticating.set (password, user)
```

### Users.Register:accepted#3

Authored path: `Users.Register`.
- Covered by [Users](../design/compositions/Users.md), line 23.
- Covered by [Users](../design/compositions/Users.md), line 30.

```reaction
when Authenticating.set (password, user), asked by Users.Register:accepted#2
then
  Sessioning.start (subject: user)
```

### Users.Register:accepted#4

Authored path: `Users.Register`.
- Covered by [Users](../design/compositions/Users.md), line 23.
- Covered by [Users](../design/compositions/Users.md), line 30.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by Users.Register:accepted#3
where
  earlier, RequestBoundary.request (password, path: "/user/register", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Users.Register:refused

Authored path: `Users.Register`.
- Covered by [Users](../design/compositions/Users.md), line 23.
- Covered by [Users](../design/compositions/Users.md), line 30.

```reaction
when RequestBoundary.request (password, path: "/user/register", requestId, username)
where
  Authenticating._acceptable (password) has (acceptable: false)
then
  RequestBoundary.respond (error: "INVALID_PASSWORD", requestId)
```

### Users.SignIn:known

Authored path: `Users.SignIn`.
- Covered by [Users](../design/compositions/Users.md), line 25.
- Covered by [Users](../design/compositions/Users.md), line 31.

```reaction
when RequestBoundary.request (password, path: "/user/login", requestId, username)
where
  Registering._byUsername (username) has (user)
then
  Authenticating.authenticate (password, user)
```

### Users.SignIn:known#2

Authored path: `Users.SignIn`.
- Covered by [Users](../design/compositions/Users.md), line 25.
- Covered by [Users](../design/compositions/Users.md), line 31.

```reaction
when Authenticating.authenticate (password, user), asked by Users.SignIn:known
then
  Sessioning.start (subject: user)
```

### Users.SignIn:known#3

Authored path: `Users.SignIn`.
- Covered by [Users](../design/compositions/Users.md), line 25.
- Covered by [Users](../design/compositions/Users.md), line 31.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by Users.SignIn:known#2
where
  earlier, RequestBoundary.request (password, path: "/user/login", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Users.SignIn:unknown

Authored path: `Users.SignIn`.
- Covered by [Users](../design/compositions/Users.md), line 25.
- Covered by [Users](../design/compositions/Users.md), line 31.

```reaction
when RequestBoundary.request (password, path: "/user/login", requestId, username)
where
  no Registering._byUsername (username)
then
  RequestBoundary.respond (error: "INVALID_CREDENTIALS", requestId)
```

### Users.SignOut

Authored path: `Users.SignOut`.
- Covered by [Users](../design/compositions/Users.md), line 13.
- Covered by [Users](../design/compositions/Users.md), line 16.

```reaction
when RequestBoundary.request (path: "/user/logout", requestId, session)
then
  Sessioning.end (session)
```

### Users.SignOut#2

Authored path: `Users.SignOut`.
- Covered by [Users](../design/compositions/Users.md), line 13.
- Covered by [Users](../design/compositions/Users.md), line 16.

```reaction
when Sessioning.end (session), asked by Users.SignOut
where
  earlier, RequestBoundary.request (path: "/user/logout", requestId, session)
then
  RequestBoundary.respond (requestId)
```

### Users.identifyMe

Authored path: `Users.identifyMe`.
- Covered by [Users](../design/compositions/Users.md), line 7.
- Covered by [Users](../design/compositions/Users.md), line 10.

```reaction
when RequestBoundary.request (path: "/user/me", requestId, session)
then
  Sessioning.use (session)
```

### Users.identifyMe#2

Authored path: `Users.identifyMe`.
- Covered by [Users](../design/compositions/Users.md), line 7.
- Covered by [Users](../design/compositions/Users.md), line 10.

```reaction
when Sessioning.use (session, subject: user), asked by Users.identifyMe
where
  Registering._username (user) has (username)
  earlier, RequestBoundary.request (path: "/user/me", requestId, session)
then
  RequestBoundary.respond (requestId, user, username)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/assignments/auto-schedule` — requires `session`, `household`, `from`, `until`, `onlyUnassigned`
- `/assignments/availability` — requires `session`, `household`, `person`
- `/assignments/availability/add` — requires `session`, `household`, `person`, `start`, `end`
- `/assignments/availability/edit` — requires `session`, `household`, `windows`, `adding`
- `/assignments/availability/remove` — requires `session`, `household`, `person`, `availability`
- `/assignments/mine` — requires `session`, `household`, `from`, `until`; fills `mode` with "all" when absent
- `/assignments/overview` — requires `session`, `household`
- `/assignments/reset` — requires `session`, `household`, `from`, `until`
- `/assignments/residents/cleanup` — requires `session`, `household`, `person`
- `/assignments/schedule` — requires `session`, `household`, `from`, `until`
- `/assignments/set` — requires `session`, `household`, `entries`
- `/assignments/task` — requires `session`, `household`, `task`
- `/assignments/tasks/create` — requires `session`, `household`, `chore`; fills `deadline` with null when absent; fills `interval` with null when absent
- `/assignments/tasks/deadline` — requires `session`, `household`, `task`; fills `deadline` with null when absent
- `/assignments/tasks/interval` — requires `session`, `household`, `task`; fills `interval` with null when absent
- `/assignments/tasks/remove` — requires `session`, `household`, `task`
- `/assignments/total` — requires `session`, `household`, `person`
- `/assignments/weekly` — requires `session`, `household`, `from`, `until`
- `/households/categories` — requires `household`, `session`
- `/households/categories/add` — requires `household`, `name`, `session`
- `/households/categories/remove` — requires `category`, `household`, `session`
- `/households/categories/rename` — requires `category`, `household`, `name`, `session`
- `/households/create` — requires `name`, `session`
- `/households/get` — requires `household`, `session`
- `/households/mine` — requires `session`
- `/households/overseer` — requires `household`, `person`, `session`
- `/households/preferences` — requires `household`, `person`, `session`
- `/households/preferences/set` — requires `category`, `household`, `person`, `preferenceLevel`, `session`
- `/households/remove` — requires `household`, `session`
- `/households/rename` — requires `household`, `name`, `session`
- `/households/residents` — requires `household`, `session`
- `/households/residents/add` — requires `household`, `person`, `session`
- `/households/residents/remove` — requires `household`, `person`, `session`
- `/user/login` — requires `password`, `username`
- `/user/logout` — requires `session`
- `/user/me` — requires `session`
- `/user/register` — requires `password`, `username`
