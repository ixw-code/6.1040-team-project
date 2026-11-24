import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import type { assembleApplication } from "./assembly.ts";
import { accountsHttp, passwordsHttp } from "./compositions/Users.ts";
import type { Session } from "./concepts/Sessioning/Sessioning.ts";

export const sessionCookieName = "__Host-session";
export const maxRequestBodyBytes = 1_048_576;

type Sessioning = ReturnType<typeof assembleApplication>["concepts"]["Sessioning"];

export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "https://shift-happens.mit-sdg.dev/",
  basePath: "/api",
  publicErrors: { ...accountsHttp.publicErrors, ...passwordsHttp.publicErrors },
  cookies: {
    session: accountsHttp.sessionCookie(sessionCookieName, passwordsHttp.startingSessions),
  },
});

export function allowsAppOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === policy.publicOrigin;
}

export async function signedInPerson(request: Request, sessions: Sessioning): Promise<string | undefined> {
  const cookies = new Bun.CookieMap(request.headers.get("cookie") ?? "");
  const token = cookies.get(sessionCookieName);
  if (!token) return;
  const session = await sessions.use({ session: token as Session });
  if (!("error" in session)) return session.subject;
}
