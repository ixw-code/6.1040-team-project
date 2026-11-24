# Users

## Accounts

Every user is created by `Registering.register`, which stores the username other people type to find them. `Sessioning.use` returns a session's user on each request. Neither concept refers to the other.

The [me endpoint](reaction:Users.identifyMe) passes the session to `Sessioning.use`, which returns the user, then responds with the user's username from `Registering._username`. Every endpoint that requires a session starts the same way: `Sessioning.use` returns the session's user, or the request is refused with `NOT_SIGNED_IN`. Each endpoint reads the user from the session, never from the request's inputs. Each way of signing in responds with the user, and the page then calls the me endpoint for the username.

```endpoints
Users.identifyMe at /user/me
```

The [sign-out endpoint](reaction:Users.SignOut) ends the session with Sessioning, and the HTTP server clears the cookie. If the person is also signed in on another computer, they stay signed in there.

```endpoints
Users.SignOut at /user/logout
```

## Sign-in and registration

Ben signs up with a username and a password. Registering stores his username, and Authenticating stores a verifier derived from his password. These endpoints call both, then start a session with Sessioning. Its frontend shows `web/src/components/PasswordForm.vue`.

The [register endpoint](reaction:Users.Register) first calls `Authenticating._acceptable`. When the password is too short or too long, the request is refused with `INVALID_PASSWORD` before anyone is registered, because the engine doesn't undo `Registering.register` when a later action in the same request is refused. Otherwise the endpoint registers the username, sets the password for the new user, and starts a session. Because the endpoint always registers a new user, nobody can sign up with a password as Sam after he signed in: the request is refused by `Registering.register` with `USERNAME_TAKEN`. For any caller, a password outside those lengths is still refused by `Authenticating.set` with `INVALID_PASSWORD`, and a second password for the same user with `PASSWORD_SET`.

The [sign-in endpoint](reaction:Users.SignIn) calls `Registering._byUsername` for the user, checks the password with `Authenticating.authenticate`, and starts a new session. A username nobody has is refused with `INVALID_CREDENTIALS`, the same refusal as a wrong password. Sam, who has no password, is refused the same way.

Each endpoint responds with the user, the session, and its expiry, and the HTTP server moves the session into a cookie that the page's scripts can't read, as `passwordsHttp` beside the endpoints declares.

```endpoints
Users.Register at /user/register
Users.SignIn at /user/login
```
