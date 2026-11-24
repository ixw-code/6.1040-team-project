import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import { accountsHttp, passwordsHttp } from "./compositions/Users.ts";

export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "https://shift-happens.mit-sdg.dev/",
  basePath: "/api",
  publicErrors: { ...accountsHttp.publicErrors, ...passwordsHttp.publicErrors },
  cookies: {
    session: accountsHttp.sessionCookie("session", passwordsHttp.startingSessions),
  },
});