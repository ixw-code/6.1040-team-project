import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import type { assembleApplication } from "./assembly.ts";
import { accountsHttp, passwordsHttp } from "./compositions/Users.ts";
import type { Session } from "./concepts/Sessioning/Sessioning.ts";

export const sessionCookieName = "__Host-session";
export const maxRequestBodyBytes = 1_048_576;

type Sessioning = ReturnType<typeof assembleApplication>["concepts"]["Sessioning"];

import { assignmentHttpErrors } from "./compositions/ChoreAssignments.ts";
import { householdHttpErrors } from "./compositions/HouseholdManagement.ts";

export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "https://shift-happens.mit-sdg.dev/",
  basePath: "/api",
  publicErrors: { ...accountsHttp.publicErrors, ...passwordsHttp.publicErrors, ...householdHttpErrors, ...assignmentHttpErrors },
  cookies: {
    session: accountsHttp.sessionCookie(sessionCookieName, passwordsHttp.startingSessions),
  },
});
