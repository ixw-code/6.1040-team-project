# Ranking

## Purpose

Track contributions within a group and rank by total credit.

*Prevents:* the same contribution earns credit more than once; totals do not reflect recorded contributions.

## Principle

Alice received credit for completing Monday's emptying sink and dishrack task. Her score increases by one. Processing the same completion again does not increase it. Sam completes two tasks and has two points, he ranks above Alice. When Alice completes another task, they share the same rank.

## Types

```types
external Person
    The person receiving credit.

external Group
    The group within which contributions are compared.

external Contribution
    The completed occurrence receiving credit.
```

## State

```state
a set of Credits with
    a group Group
    a person Person
    a contribution Contribution
    unique group and contribution

Rule: each credit is worth one point.

Rule: a person's score in a group is their number of credits in that group.
```

## Actions

```actions
credit(
    group: Group,
    person: Person,
    contribution: Contribution
) : returns (group: Group, contribution: Contribution)

    where the contribution already has credit in the group
    then
        returns group, contribution

    where the contribution has no credit in the group
    then
        add a credit with group, person, and contribution
        returns group, contribution
```

## Queries

```queries
_score(group: Group, person: Person) : one (score: Integer)
    Returns the person's number of credits in the group, or zero.

_ranking(group: Group) : set(person: Person, score: Integer, rank: Integer)
    Returns people with credit in the group and their scores.
    A person's rank is one plus the number of people with higher scores.
    Equal scores share the same rank.
```

## Notes

The application uses a task occurrence as Contribution and a household as Group.

Everyone receives one point per approved task occurrence. Chore difficulty does not affect contribution credit.
