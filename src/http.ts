import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import { accountsHttp, passwordsHttp } from "./compositions/Users.ts";

import { householdHttpErrors } from "./compositions/HouseholdManagement.ts";

export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "https://shift-happens.mit-sdg.dev/",
  basePath: "/api",
  publicErrors: { ...accountsHttp.publicErrors, ...passwordsHttp.publicErrors, ...householdHttpErrors },
  cookies: {
    session: accountsHttp.sessionCookie("session", passwordsHttp.startingSessions),
  },
});
