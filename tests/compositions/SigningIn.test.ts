import { describe, expect, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../../src/assembly.ts";
import { policy, sessionCookieName } from "../../src/http.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const password = "correct dog";
const otherPassword = "battery staple";

function requests(application: ReturnType<typeof assembleApplication>) {
  const handler = createHttpHandler({ application, gateway: createGateway({ application }), policy });
  return async (path: string, input: object = {}, cookie?: string) => {
    const response = await handler(new Request(`http://127.0.0.1/api/user/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(input),
    }));
    return {
      status: response.status,
      body: await response.json().catch(() => undefined),
      // Keep only "name=value" so the next request can send it back as a Cookie header.
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
}

describe("Users sign-in", () => {
  const database = useMongoTestDb("users");

  test("registers with a cookie, identifies it, and signs in again with a new cookie", async () => {
    const post = requests(assembleApplication(database));

    const registered = await post("register", { username: "ada", password });
    expect(registered.status).toBe(200);
    expect(registered.cookie).toBeDefined();
    expect(await post("me", {}, registered.cookie)).toMatchObject({ status: 200, body: { username: "ada" } });

    const login = await post("login", { username: "ada", password });
    expect(login.status).toBe(200);
    expect(login.cookie).not.toBe(registered.cookie);
    expect(await post("me", {}, login.cookie)).toMatchObject({ status: 200, body: { username: "ada" } });
  });

  test("refuses a taken username without changing the original password", async () => {
    const post = requests(assembleApplication(database));
    await post("register", { username: "ben", password });

    expect((await post("register", { username: "ben", password: otherPassword })).status).toBe(409);
    expect((await post("login", { username: "ben", password })).status).toBe(200);
    expect((await post("login", { username: "ben", password: otherPassword })).status).toBe(401);
  });

  test("concurrent registrations for the same username create one account with the winning credentials", async () => {
    const post = requests(assembleApplication(database));
    const username = "simultaneous";
    const credentials = [password, otherPassword];
    const results = await Promise.all(credentials.map(password => post("register", { username, password })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = results.findIndex(result => result.status === 200);
    expect(await post("me", {}, results[winner].cookie)).toMatchObject({ status: 200, body: { username } });
    expect((await post("login", { username, password: credentials[winner] })).status).toBe(200);
    expect((await post("login", { username, password: credentials[1 - winner] })).status).toBe(401);
  });

  test("refuses an invalid password before registering the username", async () => {
    const post = requests(assembleApplication(database));

    expect((await post("register", { username: "cara", password: "short" })).status).toBe(400);
    expect((await post("register", { username: "cara", password })).status).toBe(200);
  });

  test("refuses an invalid username", async () => {
    const post = requests(assembleApplication(database));

    expect((await post("register", { username: "", password })).status).toBe(400);
  });

  test("gives the same refusal for a wrong password and an unknown user", async () => {
    const post = requests(assembleApplication(database));
    await post("register", { username: "dev", password });

    const wrongPassword = await post("login", { username: "dev", password: otherPassword });
    const unknownUser = await post("login", { username: "nobody-here", password });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser).toEqual(wrongPassword);
  });

  test("signing out ends the session", async () => {
    const post = requests(assembleApplication(database));
    const { cookie } = await post("register", { username: "eli", password });

    expect((await post("logout", {}, cookie)).status).toBe(200);
    expect(await post("me", {}, cookie)).toMatchObject({ status: 401 });
  });

  test("keeps sessions of separate users independent", async () => {
    const post = requests(assembleApplication(database));
    const gia = await post("register", { username: "gia", password });
    const hal = await post("register", { username: "hal", password: otherPassword });

    expect(await post("me", {}, gia.cookie)).toMatchObject({ body: { username: "gia" } });
    expect(await post("me", {}, hal.cookie)).toMatchObject({ body: { username: "hal" } });

    await post("logout", {}, gia.cookie);
    expect(await post("me", {}, gia.cookie)).toMatchObject({ status: 401 });
    expect(await post("me", {}, hal.cookie)).toMatchObject({ body: { username: "hal" } });
  });

  test("refuses an unknown session", async () => {
    const post = requests(assembleApplication(database));

    expect(await post("me", {}, `${sessionCookieName}=not-a-real-session`)).toMatchObject({ status: 401 });
  });
});
