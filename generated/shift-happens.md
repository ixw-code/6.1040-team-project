<!-- Generated from the Shift Happens assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Shift Happens — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Trading

Defined in [Trading](../design/concepts/Trading.md), line 1.

#### Actions

- `propose(proposer: Person, recipient: Person) : returns (offer: Offer)`
  - Refuses `SELF_TRADE`: You cannot trade with yourself.
- `addItem(offer: Offer, person: Person, item: Item, side: Side) : returns (offer: Offer)`
  - Refuses `NOT_FOUND`: This trade offer does not exist.
  - Refuses `NOT_PROPOSER`: Only the person who made this offer can change it.
  - Refuses `NOT_DRAFT`: This offer has already been sent.
- `removeItem(offer: Offer, person: Person, item: Item, side: Side) : returns (offer: Offer)`
  - Refuses `NOT_FOUND`: This trade offer does not exist.
  - Refuses `NOT_PROPOSER`: Only the person who made this offer can change it.
  - Refuses `NOT_DRAFT`: This offer has already been sent.
- `send(offer: Offer, person: Person) : returns (offer: Offer)`
  - Refuses `NOT_FOUND`: This trade offer does not exist.
  - Refuses `NOT_PROPOSER`: Only the person who made this offer can change it.
  - Refuses `NOT_DRAFT`: This offer has already been sent.
  - Refuses `EMPTY_SIDE`: Choose at least one task to give and one task to get.
  - Refuses `ALREADY_OFFERED`: This trade has already been offered.
- `accept(offer: Offer, person: Person) : returns (offer: Offer, proposer: Person, recipient: Person)`
  - Refuses `NOT_FOUND`: This trade offer does not exist.
  - Refuses `NOT_RECIPIENT`: Only the person this trade was offered to can answer it.
  - Refuses `NOT_PENDING`: This trade offer is not open for an answer.
- `decline(offer: Offer, person: Person) : returns (offer: Offer)`
  - Refuses `NOT_FOUND`: This trade offer does not exist.
  - Refuses `NOT_RECIPIENT`: Only the person this trade was offered to can answer it.
  - Refuses `NOT_PENDING`: This trade offer is not open for an answer.
- `cancel(offer: Offer, person: Person) : returns (offer: Offer)`
  - Refuses `NOT_FOUND`: This trade offer does not exist.
  - Refuses `NOT_PROPOSER`: Only the person who made this offer can change it.
  - Refuses `NOT_PENDING`: This trade offer is not open for an answer.
- `withdraw(item: Item) : returns (count: Number)`

#### Queries

- `_offer(offer: Offer) : optional (proposer: Person, recipient: Person, status: Status, createdAt: DateTime, sentAt?: DateTime, closedAt?: DateTime)`
- `_items(offer: Offer) : many (item: Item, side: Side)`
- `_incoming(recipient: Person) : many (offer: Offer, proposer: Person, sentAt: DateTime)`
- `_outgoing(proposer: Person) : many (offer: Offer, recipient: Person, status: Status, createdAt: DateTime)`
- `_involving(item: Item) : many (offer: Offer, proposer: Person, recipient: Person, side: Side)`

#### Instances

- `Trading` — instance of `Trading` — [Shift Happens Application Types](../design/types.md), line 12.
  - `Item` is `Task` — [Shift Happens Application Types](../design/types.md), line 14.
  - `Person` is `Person` — [Shift Happens Application Types](../design/types.md), line 13.

## Application types

Concrete types:

- `Person` — [Shift Happens Application Types](../design/types.md), line 4.
- `Task` — [Shift Happens Application Types](../design/types.md), line 7.

## Reactions

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

