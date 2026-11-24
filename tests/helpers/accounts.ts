import { expect } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { assembleApplication } from "../../src/assembly.ts";
import { policy, sessionCookieName } from "../../src/http.ts";

export function accountRequests(application: ReturnType<typeof assembleApplication>) {
  const handle = createHttpHandler({ application, gateway: createGateway({ application }), policy });

  function accountRequest(path: string, input: object, cookie?: string) {
    return handle(new Request(`http://127.0.0.1/api/user/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(input),
    }));
  }

  async function session(path: "register" | "login", username: string) {
    const response = await accountRequest(path, { username, password: "test-password" });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie?.startsWith(`${sessionCookieName}=`)) throw new Error("Account endpoint did not issue a session.");
    const { user } = await response.json() as { user: string };
    return { cookie, user };
  }

  return { session, accountRequest };
}
