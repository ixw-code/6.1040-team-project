# TaskTracking

## Purpose 
Let people create instances of work for specific time intervals, assign them to individuals, and track completion.

*Prevents*: people are unsure of who is responsible for a task; assigned work gets forgotten or mistaken for completed work; indistinguishable instances of the same work. 

## Principle 
Alice, Bob, and Charlie share a household with Charlie as the chore overseer. Charlie creates and assigns a task to Alice to wash the dishes on Mondays, Wednesdays, and Fridays at 4pm. TaskTracking records these tasks and that Alice is responsible for them, as well as whether or not they are completed yet. 

## Types 
```types
external Person 

external Item

enum Status is PENDING or COMPLETED 
```

## State 
```state 
a set of Tasks with 
  an item Item
  an optional assignee Person 
  a status Status
  a deadline DateTime
```

## Actions 
```actions 
add(item: Item, deadline: DateTime) : returns (task: Task) 
  where true 
  then 
    creates a new task with the item, an assignee of None, a status of PENDING, and a set deadline 
    returns the task 

assign(task: Task, assignee: Person) : returns (task: Task)
  where task doesn't exist 
  then 
    refuse TASK_DOESNT_EXIST "Task doesn't exist." 
  where task exists 
  then
    update the task's assignment to the new assignee
    returns the task 

unassign(task: Task) : returns (task: Task)
  where task doesn't exist 
  then 
    refuse TASK_DOESNT_EXIST "Task doesn't exist." 
  where task exists 
  then
    update the task's assignment to None
    returns the task 

setDeadline(task: Task, deadline: DateTime) : returns (task : Task)
  where task doesn't exist 
  then 
    refuse TASK_DOESNT_EXIST "Task doesn't exist." 
  where task exists 
  then
    update the task's deadline to the new deadline
    returns the task 

complete(task: Task) : returns (task: Task) 
  where task doesn't exist 
  then 
    refuse TASK_DOESNT_EXIST "Task doesn't exist." 
  where task is already done 
  then 
    refuse TASK_STATUS_CONFLICT "Task has already been completed." 
  where task is pending 
  then 
    update the task's status to COMPLETED
    return the task 
  
uncomplete(task: Task) : returns (task: Task)
  where task doesn't exist 
  then 
    refuse TASK_DOESNT_EXIST "Task doesn't exist." 
  where task is already done 
  then 
    refuse TASK_STATUS_CONFLICT "Task is still pending." 
  where task is pending 
  then 
    update the task's status to PENDING
    return the task 

remove(task: Task) : returns (task : Task)
  where task doesn't exist 
  then 
    refuse TASK_DOESNT_EXIST "Task doesn't exist." 
  where task exists 
  then
    remove that task 
    returns the task 
```

## Queries
```queries
_tasks() : many (item: Item, assignee: Person, status: Status, deadline: DateTime) 
  Returns all the tasks.

_pending() : many (item: Item, assignee: Person, status: Status, deadline: DateTime) 
  Returns all the tasks currently pending. 

_completed() : many (item: Item, assignee: Person, status: Status, deadline: DateTime) 
  Returns all the tasks currently completed. 
```
