# Shift Happens Application Types

```types
concrete Household
  A group whose residents share chores.

concrete Person
  A person who can receive contribution credit.

concrete TaskOccurrence
  A specific dated task that can earn contribution credit.

concrete PhotoReference
  A reference to a submitted or baseline photo.

concrete ReviewerIdentity
  A person or automated reviewer who can make a submission decision.
```

```instances
instantiate Ranking with
  Group is Household
  Person is Person
  Contribution is TaskOccurrence

instantiate PhotoChecking with
  Person is Person
  Subject is TaskOccurrence
  Photo is PhotoReference
  Reviewer is ReviewerIdentity

instantiate Registering

instantiate Authenticating with
  User is Registering.User

instantiate Sessioning with
  Subject is Registering.User
```
