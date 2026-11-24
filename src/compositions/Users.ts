import type { HttpCookieBinding } from "@mit-sdg/sync-engine-http/policy";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import type { EndpointValidator } from "@mit-sdg/sync-engine/boundary";

const { Registering, Authenticating, Sessioning } = concepts;

/** Accepts a request body whose fields are all strings; `session` and `attempt` are null when the browser sent no cookie. The endpoint's receive clause names the required fields. */
const textInput: EndpointValidator = (value) => {
  const ok =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([name, field]) => typeof field === "string" || (field === null && (name === "session" || name === "attempt")),
    );
  return ok ? { ok: true } : { ok: false, detail: "expected text fields" };
};

const identifyMe = endpoint(
  "/user/me",
  ({ session, user, username }) =>
    receive({ session })
      .then(Sessioning.use({ session }).responds({ subject: user }))
      .then(
        where(Registering._username({ user }).is({ username })).then(respond({ username })),
      ),
  { validators: { input: textInput } },
);

const SignOut = endpoint(
  "/user/logout",
  ({ session }) =>
    receive({ session })
      .then(Sessioning.end({ session }).responds({}))
      .then(respond({})),
  { validators: { input: textInput } },
);

/**
 * The HTTP settings for these endpoints and Registering: the category for each refusal, and
 * the session cookie, which each endpoint in `startingSessions` sets and sign-out clears.
 */
export const accountsHttp = {
  publicErrors: { NOT_SIGNED_IN: "UNAUTHORIZED", INVALID_USERNAME: "INVALID_REQUEST", USERNAME_TAKEN: "CONFLICT" },
  sessionCookie: (name: string, startingSessions: readonly string[]): HttpCookieBinding => ({
    name,
    input: "session",
    issue: startingSessions.map((path) => ({ path, value: "session", expires: "expiresAt" })),
    clear: ["/user/logout"],
  }),
} as const;

const Register = endpoint(
  "/user/register",
  ({ username, password, user, session, expiresAt }) =>
    receive({ username, password }).then(
      where(Authenticating._acceptable({ password }).is({ acceptable: true }))
        .then(Registering.register({ username }).responds({ user }))
        .then(Authenticating.set({ user, password }).responds({}))
        .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
        .then(respond({ user, session, expiresAt }))
        .named("accepted"),
      where(Authenticating._acceptable({ password }).is({ acceptable: false }))
        .then(respond({ error: "INVALID_PASSWORD" }))
        .named("refused"),
    ),
  { validators: { input: textInput } },
);

const SignIn = endpoint(
  "/user/login",
  ({ username, password, user, session, expiresAt }) =>
    receive({ username, password }).then(
      where(Registering._byUsername({ username }).is({ user }))
        .then(Authenticating.authenticate({ user, password }).responds({}))
        .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
        .then(respond({ user, session, expiresAt }))
        .named("known"),
      where(no(Registering._byUsername({ username })))
        .then(respond({ error: "INVALID_CREDENTIALS" }))
        .named("unknown"),
    ),
  { validators: { input: textInput } },
);

/** The HTTP settings for these endpoints: the category for each refusal, and the endpoints that start a session. */
export const passwordsHttp = {
  publicErrors: { INVALID_PASSWORD: "INVALID_REQUEST", PASSWORD_SET: "CONFLICT", INVALID_CREDENTIALS: "UNAUTHORIZED" },
  startingSessions: ["/user/register", "/user/login"],
} as const;

export const composition = {
  Register, SignIn, identifyMe, SignOut
};
