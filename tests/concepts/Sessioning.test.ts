import { expect, test } from "bun:test";
import { NotSignedIn, SessioningConcept } from "../../src/concepts/Sessioning/Sessioning.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("sessioning");
const day = 24 * 60 * 60 * 1000;

test("an idle session expires at seven days while activity keeps another session alive", async () => {
  const start = Date.now();
  let now = start;
  const sessions = new SessioningConcept(database, "IdleSession", () => new Date(now));
  const idle = await sessions.start({ subject: "resident" });
  const active = await sessions.start({ subject: "resident" });

  now = start + 7 * day - 1;
  expect(await sessions.use(active)).toEqual({ subject: "resident" });
  now = start + 7 * day;
  await expect(sessions.use(idle)).rejects.toThrow(NotSignedIn);
  expect(await sessions.use(active)).toEqual({ subject: "resident" });
});

test("session activity never extends the absolute expiration", async () => {
  const start = Date.now();
  let now = start;
  const sessions = new SessioningConcept(database, "AbsoluteSession", () => new Date(now));
  const user = await sessions.start({ subject: "overseer" });
  expect(user.expiresAt.getTime()).toBe(start + 90 * day);

  for (let elapsed = 6; elapsed < 90; elapsed += 6) {
    now = start + elapsed * day;
    expect(await sessions.use(user)).toEqual({ subject: "overseer" });
  }
  now = user.expiresAt.getTime() - 1;
  expect(await sessions.use(user)).toEqual({ subject: "overseer" });
  now = user.expiresAt.getTime();
  await expect(sessions.use(user)).rejects.toThrow(NotSignedIn);
  await expect(sessions.end(user)).rejects.toThrow(NotSignedIn);
});
