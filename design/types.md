# Shift Happens Application Types

```types
concrete Person
  A person of the app (TBA from Registering) 
  
concrete Household
  A group whose residents share chores.

concrete TaskOccurrence
  A specific dated task that can earn contribution credit.

concrete PhotoReference
  A reference to a submitted or baseline photo.

concrete ReviewerIdentity
  A person or automated reviewer who can make a submission decision.
```

```instances
instantiate HouseholdManaging 
  Person is Person

instantiate ChoreCataloguing with
  Group is HouseholdManaging.Household
  Category is HouseholdManaging.Category
  Photo is PhotoReference

instantiate TaskScheduling with
  Person is Person
  Group is HouseholdManaging.Household
  Category is HouseholdManaging.Category
  Item is ChoreCataloguing.Chore

instantiate Ranking with
  Group is HouseholdManaging.Household
  Person is Person
  Contribution is TaskScheduling.Task

instantiate PhotoChecking with
  Person is Person
  Subject is TaskScheduling.Task
  Photo is PhotoReference
  Reviewer is ReviewerIdentity

instantiate Registering

instantiate Authenticating with
  User is Registering.User

instantiate Sessioning with
  Subject is Registering.User
```
