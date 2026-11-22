# Trading

## Purpose

Let one person offer to exchange one or more things they hold for one or more things another person holds, and let the other person accept or decline.

*Prevents:* an exchange happening without the other person's agreement; someone accepting or declining an offer that was not made to them; the same item being traded away twice; a half-built offer being answered before it is complete; stale offers staying open after one of their items has been traded or changed hands another way.

## Principle

Alice holds Monday's sink and Tuesday's sweep. Bob holds Wednesday's trash. Alice starts an offer to Bob, adds her sink and her sweep to the offered side and Bob's trash to the requested side, and sends it. The offer now waits in Bob's incoming offers. Bob accepts, and the offer is recorded as accepted with its items on each side, so the application can swap who does each task.

Carol had also sent Bob an offer of her Thursday bathroom for his Wednesday trash. Once Bob accepts Alice's offer, the trash has been traded, so Carol's offer is withdrawn automatically and Bob can no longer accept it.

While Alice is still building an offer to Dan, Dan cannot see or answer it. After she sends it, Dan declines, and it closes without any exchange. Alice starts another, then changes her mind and cancels it.

In Shift Happens, each item is a scheduled task occurrence. The composition checks that each person really holds their items before an offer is sent, and applies an accepted trade to the schedule.

## Types

```types
external Person
  A person who makes or receives an offer.

external Item
  Something a person holds and can exchange, such as a scheduled task.

Side is OFFERED or REQUESTED
  OFFERED items come from the proposer; REQUESTED items come from the recipient.

Status is DRAFT or PENDING or ACCEPTED or DECLINED or CANCELLED or WITHDRAWN
  An offer starts as a draft, is pending once sent, and is closed once accepted, declined, cancelled, or withdrawn.
```

## State

```state
a set of Offers with
  a proposer Person
  a recipient Person
  an offered set of Items
  a requested set of Items
  a status Status
  a createdAt DateTime
  an optional sentAt DateTime
  an optional closedAt DateTime

Rule: an offer's proposer and recipient are different people.

Rule: only a draft's items can change, and only its proposer can change them.

Rule: a pending offer has at least one offered item and at least one requested item.

Rule: an item may be on both sides of the same offer.

Rule: there is at most one pending offer with the same offered and requested items, in either direction.

Rule: after an offer is accepted, no other offer involving any of its items is pending.

Rule: a closed offer never changes again. Closed offers stay as history.
```

## Actions

```actions
propose(proposer: Person, recipient: Person) : returns (offer: Offer)
  where proposer is recipient
  then
    refuses SELF_TRADE "You cannot trade with yourself."

  where proposer is not recipient
  then
    add a new draft offer with proposer, recipient, no items, and createdAt now
    returns offer

addItem(offer: Offer, person: Person, item: Item, side: Side) : returns (offer: Offer)
  where offer is not in Offers
  then
    refuses NOT_FOUND "This trade offer does not exist."

  where offer exists and person is not its proposer
  then
    refuses NOT_PROPOSER "Only the person who made this offer can change it."

  where offer exists, person is its proposer, and offer is not a draft
  then
    refuses NOT_DRAFT "This offer has already been sent."

  where offer is a draft and person is its proposer
  then
    add item to the side of offer, if it is not already there
    returns offer

removeItem(offer: Offer, person: Person, item: Item, side: Side) : returns (offer: Offer)
  where offer is not in Offers
  then
    refuses NOT_FOUND "This trade offer does not exist."

  where offer exists and person is not its proposer
  then
    refuses NOT_PROPOSER "Only the person who made this offer can change it."

  where offer exists, person is its proposer, and offer is not a draft
  then
    refuses NOT_DRAFT "This offer has already been sent."

  where offer is a draft and person is its proposer
  then
    remove item from the side of offer, if it is there
    returns offer

send(offer: Offer, person: Person) : returns (offer: Offer)
  where offer is not in Offers
  then
    refuses NOT_FOUND "This trade offer does not exist."

  where offer exists and person is not its proposer
  then
    refuses NOT_PROPOSER "Only the person who made this offer can change it."

  where offer exists, person is its proposer, and offer is not a draft
  then
    refuses NOT_DRAFT "This offer has already been sent."

  where offer is a draft, person is its proposer, and either side has no items
  then
    refuses EMPTY_SIDE "Choose at least one task to give and one task to get."

  where offer is a draft whose items match a pending offer, in either direction
  then
    refuses ALREADY_OFFERED "This trade has already been offered."

  where offer is a draft, person is its proposer, both sides have items, and no pending offer matches it
  then
    set its status to pending and sentAt to now
    returns offer

accept(offer: Offer, person: Person) : returns (offer: Offer, proposer: Person, recipient: Person)
  where offer is not in Offers
  then
    refuses NOT_FOUND "This trade offer does not exist."

  where offer exists and person is not its recipient
  then
    refuses NOT_RECIPIENT "Only the person this trade was offered to can answer it."

  where offer exists, person is its recipient, and offer is not pending
  then
    refuses NOT_PENDING "This trade offer is not open for an answer."

  where offer is pending and person is its recipient
  then
    set its status to accepted and closedAt to now
    set every other pending offer involving any of its items to withdrawn, with closedAt now
    returns offer, proposer, recipient

decline(offer: Offer, person: Person) : returns (offer: Offer)
  where offer is not in Offers
  then
    refuses NOT_FOUND "This trade offer does not exist."

  where offer exists and person is not its recipient
  then
    refuses NOT_RECIPIENT "Only the person this trade was offered to can answer it."

  where offer exists, person is its recipient, and offer is not pending
  then
    refuses NOT_PENDING "This trade offer is not open for an answer."

  where offer is pending and person is its recipient
  then
    set its status to declined and closedAt to now
    returns offer

cancel(offer: Offer, person: Person) : returns (offer: Offer)
  where offer is not in Offers
  then
    refuses NOT_FOUND "This trade offer does not exist."

  where offer exists and person is not its proposer
  then
    refuses NOT_PROPOSER "Only the person who made this offer can change it."

  where offer exists, person is its proposer, and offer is closed
  then
    refuses NOT_PENDING "This trade offer is not open for an answer."

  where offer is a draft or pending and person is its proposer
  then
    set its status to cancelled and closedAt to now
    returns offer

withdraw(item: Item) : returns (count: Number)
  where true
  then
    set every pending offer involving item to withdrawn, with closedAt now
    let count be the number of offers withdrawn
    returns count
```

## Queries

```queries
_offer(offer: Offer) : optional (proposer: Person, recipient: Person, status: Status, createdAt: DateTime, sentAt?: DateTime, closedAt?: DateTime)
  Returns the offer's people and status, or no row if the offer does not exist.

_items(offer: Offer) : many (item: Item, side: Side)
  Returns one row per item in the offer: offered items first, then requested items, each in the order they were added.
  Returns no rows when the offer does not exist or has no items.

_incoming(recipient: Person) : many (offer: Offer, proposer: Person, sentAt: DateTime)
  Returns the pending offers made to recipient, oldest sent first.
  Breaks timestamp ties by offer identifier. Drafts are not included. Returns no rows when there are none.

_outgoing(proposer: Person) : many (offer: Offer, recipient: Person, status: Status, createdAt: DateTime)
  Returns proposer's draft and pending offers, oldest created first.
  Breaks timestamp ties by offer identifier. Returns no rows when there are none.

_involving(item: Item) : many (offer: Offer, proposer: Person, recipient: Person, side: Side)
  Returns the pending offers that include item, with the side it is on, oldest sent first.
  An item on both sides of one offer returns two rows. Breaks timestamp ties by offer identifier.
```
