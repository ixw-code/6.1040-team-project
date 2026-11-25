import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { policy } from "../../src/http.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("household_management");
const password = "correct horse battery";

function setup() {
  const application = assembleApplication(database);
  const handler = createHttpHandler({ application, gateway: createGateway({ application }), policy });
  async function post(path: string, input: object = {}, cookie?: string) {
    const response = await handler(new Request(`http://localhost/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: JSON.stringify(input),
    }));
    return { status: response.status, body: await response.json(), cookie: response.headers.get("Set-Cookie")?.split(";")[0] };
  }
  async function register() {
    const username = crypto.randomUUID().slice(0, 12);
    const response = await post("/user/register", { username, password });
    expect(response.status).toBe(200);
    expect(response.cookie).toBeDefined();
    return { person: response.body.user as string, cookie: response.cookie!, username };
  }
  const invoke = (path: string, input: object, cookie: string) =>
    application.invoker.invoke(path, { ...input, session: cookie.split("=")[1] }, { timeoutMs: 2000 });
  return { application, post, register, invoke };
}

describe("HouseholdManagement HTTP", () => {
  test("uses signed-in identity, checks authority, and serves household and preference reads", async () => {
    const { post, register, invoke } = setup();
    const alice = await register();
    const bob = await register();
    const login = await post("/user/login", { username: alice.username, password });
    expect(login.status).toBe(200);
    expect(await post("/households/create", { name: "Home", session: login.cookie!.split("=")[1] }))
      .toMatchObject({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await post("/households/create", { name: "Home" }, "session=invalid"))
      .toMatchObject({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await invoke("/households/create", { name: "Home" }, "session=invalid"))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_SIGNED_IN" } });
    expect(await invoke("/households/create", { name: " " }, alice.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "HOUSEHOLD_NAME_INVALID" } });
    const created = await post("/households/create", { name: "Home" }, login.cookie);
    expect(created.status).toBe(200);
    const { household } = created.body;
    const createdCategory = await post("/households/categories/add", { household, name: "Kitchen" }, alice.cookie);
    expect(createdCategory.status).toBe(200);
    const { category } = createdCategory.body;
    expect(await post("/households/rename", { household, name: "Fake", requester: alice.person }, bob.cookie))
      .toMatchObject({ status: 400 });
    expect(await invoke("/households/rename", { household, name: "Fake" }, bob.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "ACCESS_DENIED" } });
    expect(await post("/households/rename", { household, name: "Fake" }, bob.cookie))
      .toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
    expect(await post("/households/get", { household: "missing" }, alice.cookie))
      .toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await post("/households/residents/add", { household, person: "unknown" }, alice.cookie))
      .toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await post("/households/residents/add", { household, person: bob.person }, alice.cookie))
      .toMatchObject({ status: 200 });
    expect(await post("/households/residents/add", { household, person: bob.person }, alice.cookie))
      .toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    expect(await invoke("/households/categories/add", { household, name: "Kitchen" }, alice.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "CATEGORY_NAME_CONFLICT" } });
    expect(await invoke("/households/categories/rename", { household, category: "missing", name: "Cook" }, alice.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
    expect(await post("/households/categories/rename", { household, category, name: "Cook" }, alice.cookie))
      .toMatchObject({ status: 200 });
    expect(await post("/households/rename", { household, name: "Our Home" }, alice.cookie))
      .toMatchObject({ status: 200 });
    const key = { household, person: bob.person };
    expect(await post("/households/preferences", key, alice.cookie)).toMatchObject({
      status: 200, body: { preferences: [{ category, preferenceLevel: "NEUTRAL" }] },
    });
    expect(await post("/households/preferences/set", { ...key, category, preferenceLevel: "PREFER" }, alice.cookie))
      .toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
    expect(await invoke("/households/preferences/set", { ...key, category, preferenceLevel: "INVALID" }, bob.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "PREFERENCE_LEVEL_INVALID" } });
    expect(await post("/households/preferences/set", { ...key, category, preferenceLevel: "PREFER" }, bob.cookie))
      .toMatchObject({ status: 200 });
    expect(await post("/households/preferences", { household, person: alice.person }, bob.cookie))
      .toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
    expect(await post("/households/preferences", key, bob.cookie)).toMatchObject({
      status: 200, body: { preferences: [{ category, preferenceLevel: "PREFER" }] },
    });
    const details = { household, name: "Our Home", overseer: alice.person, residents: [
      { person: alice.person }, { person: bob.person },
    ], categories: [{ category, name: "Cook" }] };
    expect(await post("/households/get", { household }, bob.cookie)).toMatchObject({ status: 200, body: { household: details } });
    expect(await post("/households/residents", { household }, bob.cookie)).toMatchObject({
      status: 200, body: { residents: [
        { person: alice.person, username: alice.username }, { person: bob.person, username: bob.username },
      ] },
    });
    expect(await post("/households/categories", { household }, bob.cookie)).toMatchObject({ status: 200, body: { categories: details.categories } });
    expect(await post("/households/mine", {}, bob.cookie)).toMatchObject({ status: 200, body: { households: [{ household }] } });

    expect(await post("/households/residents/remove", { household, person: alice.person }, alice.cookie))
      .toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    expect(await post("/households/overseer", key, alice.cookie)).toMatchObject({ status: 200 });
    expect(await post("/households/residents/remove", { household, person: alice.person }, alice.cookie))
      .toMatchObject({ status: 200, body: { household, person: alice.person, residency: expect.any(String) } });
    expect(await post("/households/get", { household }, alice.cookie))
      .toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
    await post("/user/logout", {}, bob.cookie);
    expect(await post("/households/mine", {}, bob.cookie))
      .toMatchObject({ status: 401, body: { error: "UNAUTHORIZED" } });
  });

  test("returns each resident's username with their user ID", async () => {
    const { post, register, invoke } = setup();
    const alice = await register();
    const bob = await register();
    const { body: { household } } = await post("/households/create", { name: "Home" }, alice.cookie);
    expect(await post("/households/residents/add", { household, person: bob.person }, alice.cookie))
      .toMatchObject({ status: 200 });

    expect(await post("/households/residents", { household }, alice.cookie)).toMatchObject({
      status: 200,
      body: {
        residents: expect.arrayContaining([
          { person: alice.person, username: alice.username },
          { person: bob.person, username: bob.username },
        ]),
      },
    });
  });

  test("guards category and household deletion against chores, tasks, and orphan availability", async () => {
    const { application, post, register, invoke } = setup();
    const owner = await register();
    const { body: { household } } = await post("/households/create", { name: "Home" }, owner.cookie);
    const { body: { category } } = await post("/households/categories/add", { household, name: "Yard" }, owner.cookie);
    const { TaskScheduling, ChoreCataloguing } = application.concepts;
    const catalogued = await ChoreCataloguing.create({
      group: household, category, name: "Pick up sticks", description: "", difficulty: 3, requirements: [], references: [],
    });
    if ("error" in catalogued) throw new Error(catalogued.error);
    const { chore } = catalogued;
    const scheduled = await TaskScheduling.add({
      group: household, item: chore, category, weight: 3, deadline: new Date("2027-01-01"),
    });
    if ("error" in scheduled) throw new Error(scheduled.error);
    const { task } = scheduled;
    const available = await TaskScheduling.addAvailability({
      group: household, person: "former-resident", start: new Date("2026-12-31"), end: new Date("2027-01-01"),
    });
    if ("error" in available) throw new Error(available.error);
    const { availability } = available;
    const removeCategory = () => post("/households/categories/remove", { household, category }, owner.cookie);
    const removeHousehold = () => post("/households/remove", { household }, owner.cookie);
    for (const remove of [removeCategory, removeHousehold]) {
      expect(await remove()).toMatchObject({ status: 409 });
    }
    expect(await invoke("/households/categories/remove", { household, category }, owner.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "CATEGORY_IN_USE" } });
    expect(await invoke("/households/remove", { household }, owner.cookie))
      .toMatchObject({ ok: false, error: { kind: "domain", value: "HOUSEHOLD_IN_USE" } });
    await ChoreCataloguing.remove({ group: household, chore });
    expect(await removeCategory()).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    await TaskScheduling.remove({ task });
    expect(await removeCategory()).toMatchObject({ status: 200 });
    expect(await removeCategory()).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await removeHousehold()).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    await TaskScheduling.removeAvailability({ availability });
    expect(await removeHousehold()).toMatchObject({ status: 200, body: { household } });
  });
});
