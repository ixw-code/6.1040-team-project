import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import { accountsHttp, passwordsHttp } from "./compositions/Users.ts";

export const sessionCookieName = "__Host-session";
export const maxRequestBodyBytes = 1_048_576;

export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "https://shift-happens.mit-sdg.dev/",
  basePath: "/api",
  publicErrors: { ...accountsHttp.publicErrors, ...passwordsHttp.publicErrors },
  cookies: {
    session: accountsHttp.sessionCookie(sessionCookieName, passwordsHttp.startingSessions),
  },
});
