# Scheduling

## Purpose

Plan who does each piece of time-sensitive work, so everyone does an equal amount of effort, only at times they are available, with their preferences respected where possible.

*Prevents:* disregarding manual (by hand) changes, scheduling someone for when they are unavailable, someone always doing the heaviest work.

## Principle

Allie, Caleb, and Millie join a household's schedule. Allie is available Monday through Thursday, Caleb on weekdays, and Millie only on weekends. Allie prefers kitchen work and Caleb wants to avoid bathrooms.

The week's jobs are added: Monday's sink (weight 1), Tuesday's bathroom (weight 3), and Saturday's trash (weight 1). Auto-scheduling puts Allie on Monday's sink because she is available and prefers it. Allie also gets Tuesday's bathroom because Caleb avoids it and Millie is unavailable. Millie gets Saturday's trash because she is the only one available. Next week, Caleb has done the least, so he gets the bathroom even though he would rather avoid it.

The planner tries to set Saturday's trash to Caleb, but it is refused because Caleb is not available on weekends. Instead, the planner takes the schedule, moves Tuesday's bathroom from Allie to Caleb, and sets it again. Auto-scheduling once more only fills empty jobs, so Caleb keeps the bathroom.

Later, Millie removes her Saturday availability. The trash goes back to being unscheduled, so it never stays with someone who can't do it.

## Types

```types
external Group
  The group whose work is being scheduled, such as a household.

external Person
  Someone who can be scheduled.

external Job
  A piece of work at a specific time, such as Monday's sink cleaning.

external Category
  What sort of work a job is, such as kitchen or bathroom.

enum Preference
  prefer
  neutral
  avoid

enum Source
  auto
  manual
```

## State

```state
a set of Users with
  a group Group
  a person Person
  unique group and person

a set of Availabilities with
  a user User
  a start DateTime
  an end DateTime

a set of Preferences with
  a user User
  a category Category
  a preference Preference
  unique user and category

a set of Jobs with
  a group Group
  a job Job
  a category Category
  a start DateTime
  a due DateTime
  a weight Number
  an optional person Person
  an optional source Source
  unique job

Rule: an availability's start is before its end, and a job's start is before its due
Rule: a job's weight is positive
Rule: a job has a person exactly when it has a source, and that person is a user in the job's group
Rule: a user is available for a job when one of their availabilities overlaps the time from the job's start to its due
Rule: a job's person is always available for it, whether it was auto-scheduled or set by hand
Rule: a user with no preference for a category is neutral toward it
Rule: a person's total in a group is the sum of the weights of the jobs scheduled for them in that group
```

## Actions

```actions
join(group: Group, person: Person) : returns (user: User)
  where person is already a user in group
  then
    refuses ALREADY_JOINED "You are already on this schedule."
  where person is not a user in group
  then
    add a new user with group and person
    returns user

leave(group: Group, person: Person) : returns (freed: set (job: Job))
  where person is not a user in group
  then
    refuses NOT_JOINED "You are not on this schedule."
  where person is a user in group
  then
    clear person and source from every job in group scheduled for person that starts after now
    remove the user with their availabilities and preferences
    returns the jobs that were cleared

addAvailability(group: Group, person: Person, start: DateTime, end: DateTime) : returns (availability: Availability)
  where person is not a user in group
  then
    refuses NOT_JOINED "You are not on this schedule."
  where start is not before end
  then
    refuses INVALID_WINDOW "Availability must end after it starts."
  where person is a user in group and start is before end
  then
    add a new availability with the user, start, and end
    returns availability

removeAvailability(availability: Availability) : returns (freed: set (job: Job))
  where availability is not in Availabilities
  then
    refuses NOT_FOUND "There is no such availability."
  where availability is in Availabilities
  then
    remove availability
    clear person and source from every job scheduled for the user that they are no longer available for
    returns the jobs that were cleared

setPreference(group: Group, person: Person, category: Category, preference: Preference) : returns ()
  where person is not a user in group
  then
    refuses NOT_JOINED "You are not on this schedule."
  where person is a user in group
  then
    set the user's preference for category to preference
    returns

addJob(group: Group, job: Job, category: Category, start: DateTime, due: DateTime, weight: Number) : returns (job: Job)
  where job is already in Jobs
  then
    refuses ALREADY_ADDED "This job is already on the schedule."
  where start is not before due
  then
    refuses INVALID_WINDOW "A job must be due after it starts."
  where weight is not positive
  then
    refuses INVALID_WEIGHT "A job's weight must be positive."
  where job is not in Jobs, start is before due, and weight is positive
  then
    add a new job with group, category, start, due, weight, and no person
    returns job

removeJob(job: Job) : returns (job: Job)
  where job is not in Jobs
  then
    refuses NOT_FOUND "There is no such job on the schedule."
  where job is in Jobs
  then
    remove job
    returns job

autoSchedule(group: Group, from: DateTime, until: DateTime) : returns (
  scheduled: set (job: Job, person: Person),
  unfilled: set (job: Job)
)
  where from is not before until
  then
    refuses INVALID_WINDOW "The period must end after it starts."
  where from is before until
  then
    for each job in group with no person whose start is between from and until, in order of start:
      among users available for the job, choose the one with the lowest
        cost = their total + the job's weight × (0.5 if prefer, 1 if neutral, 2 if avoid),
        breaking remaining ties at random
      if someone was chosen, set the job's person to them and its source to auto
      otherwise leave the job unfilled
    leave jobs that already have a person unchanged
    returns the newly scheduled jobs and the unfilled jobs

setSchedule(group: Group, entries: set (job: Job, person: Person?)) : returns (entries: set (job: Job, person: Person?))
  where some entry's job is not in group
  then
    refuses NOT_FOUND "One of these jobs is not on this schedule."
  where some entry's person is given and is not a user in group
  then
    refuses NOT_JOINED "One of these people is not on this schedule."
  where some entry's person is given and is not available for its job
  then
    refuses NOT_AVAILABLE "One of these people is not available for that job."
  where every entry's job is in group and every given person is a user in group who is available for their job
  then
    for every entry, set the job's person to the entry's person and its source to manual,
      or clear both when no person is given
    returns entries

reset(group: Group, from: DateTime, until: DateTime) : returns (cleared: set (job: Job))
  where from is not before until
  then
    refuses INVALID_WINDOW "The period must end after it starts."
  where from is before until
  then
    clear person and source from every auto-scheduled job in group whose start is between from and until
    keep manual entries
    returns the jobs that were cleared
```

## Queries

```queries
_schedule(group: Group, from: DateTime, until: DateTime) : set (
  job: Job, category: Category, start: DateTime, due: DateTime, weight: Number,
  person: Person?, source: Source?
)
  answers the group's jobs starting between from and until, in order of start

_unfilled(group: Group, from: DateTime, until: DateTime) : set (job: Job, start: DateTime, due: DateTime)
  answers the jobs in the period with no person

_totals(group: Group) : set (person: Person, total: Number)
  answers every user's total in the group
  answers 0 for a user with no jobs scheduled

_availability(group: Group, person: Person) : set (availability: Availability, start: DateTime, end: DateTime)
  answers the user's availabilities, in order of start

_preferences(group: Group, person: Person) : set (category: Category, preference: Preference)
  answers the user's stated preferences
  categories with no answer are neutral
```