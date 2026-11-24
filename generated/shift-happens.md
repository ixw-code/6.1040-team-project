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

- `Authenticating` — instance of `Authenticating` — [Shift Happens Application Types](../design/types.md), line 34.
  - `User` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 35.

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

- `PhotoChecking` — instance of `PhotoChecking` — [Shift Happens Application Types](../design/types.md), line 26.
  - `Person` is `Person` — [Shift Happens Application Types](../design/types.md), line 27.
  - `Photo` is `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 29.
  - `Reviewer` is `ReviewerIdentity` — [Shift Happens Application Types](../design/types.md), line 30.
  - `Subject` is `TaskOccurrence` — [Shift Happens Application Types](../design/types.md), line 28.

### Ranking

Defined in [Ranking](../design/concepts/Ranking.md), line 1.

#### Actions

- `credit(group: Group, person: Person, contribution: Contribution) : returns (group: Group, contribution: Contribution)`

#### Queries

- `_score(group: Group, person: Person) : one (score: Number)`
- `_ranking(group: Group) : many (person: Person, score: Number, rank: Number)`

#### Instances

- `Ranking` — instance of `Ranking` — [Shift Happens Application Types](../design/types.md), line 21.
  - `Contribution` is `TaskOccurrence` — [Shift Happens Application Types](../design/types.md), line 24.
  - `Group` is `Household` — [Shift Happens Application Types](../design/types.md), line 22.
  - `Person` is `Person` — [Shift Happens Application Types](../design/types.md), line 23.

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

- `Registering` — instance of `Registering` — [Shift Happens Application Types](../design/types.md), line 32.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `use(session: Session) : returns (subject: Subject)`
  - Refuses `NOT_SIGNED_IN`: Your session has ended. Sign in again.
- `end(session: Session) : returns (session: Session)`
  - Refuses `NOT_SIGNED_IN`: Your session has ended. Sign in again.

#### Instances

- `Sessioning` — instance of `Sessioning` — [Shift Happens Application Types](../design/types.md), line 37.
  - `Subject` is `Registering.User` — [Shift Happens Application Types](../design/types.md), line 38.

## Application types

Concrete types:

- `Household` — [Shift Happens Application Types](../design/types.md), line 4.
- `Person` — [Shift Happens Application Types](../design/types.md), line 7.
- `PhotoReference` — [Shift Happens Application Types](../design/types.md), line 13.
- `ReviewerIdentity` — [Shift Happens Application Types](../design/types.md), line 16.
- `TaskOccurrence` — [Shift Happens Application Types](../design/types.md), line 10.

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
  RequestBoundary.respond (requestId, username)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/user/login` — requires `password`, `username`
- `/user/logout` — requires `session`
- `/user/me` — requires `session`
- `/user/register` — requires `password`, `username`
