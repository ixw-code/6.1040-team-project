# Shift Happens Application Types

```types
concrete PhotoReference
  A reference to a submitted or baseline photo.

concrete ReviewerIdentity
  A person or automated reviewer who can make a submission decision.
```

```instances
instantiate HouseholdManaging with
  Person is Registering.User

instantiate ChoreCataloguing with
  Group is HouseholdManaging.Household
  Category is HouseholdManaging.Category
  Photo is PhotoReference

instantiate TaskScheduling with
  Person is Registering.User
  Group is HouseholdManaging.Household
  Category is HouseholdManaging.Category
  Item is ChoreCataloguing.Chore

instantiate Ranking with
  Group is HouseholdManaging.Household
  Person is Registering.User
  Contribution is TaskScheduling.Task

instantiate PhotoChecking with
  Person is Registering.User
  Subject is TaskScheduling.Task
  Photo is PhotoReference
  Reviewer is ReviewerIdentity

instantiate Registering

instantiate Authenticating with
  User is Registering.User

instantiate Sessioning with
  Subject is Registering.User
```

## Planned household and scheduling bindings

Add these bindings when the three concepts are assembled. Use `HouseholdManaging.Household` for `Ranking.Group` and `TaskScheduling.Task` for `Ranking.Contribution` and `PhotoChecking.Subject` at that point.

```text
instantiate HouseholdManaging with
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
```
