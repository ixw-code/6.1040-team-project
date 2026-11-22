# Shift Happens Application Types

```types
concrete Person
  A resident of a household.

concrete Task
  A specific dated task occurrence that a resident is scheduled to do.
```

```instances
instantiate Trading with
  Person is Person
  Item is Task
```
