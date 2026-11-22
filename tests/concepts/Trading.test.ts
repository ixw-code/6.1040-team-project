import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import { TradingConcept } from "../../src/concepts/Trading.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

// Narrow an action result to its success shape, failing the test on a refusal.
function ok<T extends object>(result: T): Exclude<T, { error: string }> {
  if ("error" in result) throw new Error(String(result.error));
  return result as Exclude<T, { error: string }>;
}

type Trading = ReturnType<typeof assembleApplication>["concepts"]["Trading"];

// Build a draft with the given items on each side, without sending it.
async function draft(Trading: Trading, proposer: string, recipient: string, offered: string[], requested: string[]) {
  const { offer } = ok(await Trading.propose({ proposer, recipient }));
  for (const item of offered) ok(await Trading.addItem({ offer, person: proposer, item, side: "OFFERED" }));
  for (const item of requested) ok(await Trading.addItem({ offer, person: proposer, item, side: "REQUESTED" }));
  return { offer };
}

// Build and send an offer.
async function sent(Trading: Trading, proposer: string, recipient: string, offered: string[], requested: string[]) {
  const ref = await draft(Trading, proposer, recipient, offered, requested);
  ok(await Trading.send({ ...ref, person: proposer }));
  return ref;
}

const rows = (offered: string[], requested: string[]) => [
  ...offered.map((item) => ({ item, side: "OFFERED" as const })),
  ...requested.map((item) => ({ item, side: "REQUESTED" as const })),
];

describe("Trading", () => {
  const getTestDb = useMongoTestDb("trading");

  test("its principle: a sent offer is accepted, and other offers for its tasks are withdrawn", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const [sink, sweep, trash, bathroom] = ["p1-mon-sink", "p1-tue-sweep", "p1-wed-trash", "p1-thu-bathroom"];

    const alice = await sent(Trading, "alice", "bob", [sink, sweep], [trash]);
    const carol = await sent(Trading, "carol", "bob", [bathroom], [trash]);

    expect(await Trading._incoming({ recipient: "bob" })).toEqual([
      { ...alice, proposer: "alice", sentAt: expect.any(Date) },
      { ...carol, proposer: "carol", sentAt: expect.any(Date) },
    ]);
    expect(await Trading._items(alice)).toEqual(rows([sink, sweep], [trash]));
    expect(await Trading._involving({ item: trash })).toEqual([
      { ...alice, proposer: "alice", recipient: "bob", side: "REQUESTED" },
      { ...carol, proposer: "carol", recipient: "bob", side: "REQUESTED" },
    ]);

    expect(await Trading.accept({ ...alice, person: "bob" })).toEqual({ ...alice, proposer: "alice", recipient: "bob" });
    expect(await Trading._offer(alice)).toEqual([{
      proposer: "alice",
      recipient: "bob",
      status: "ACCEPTED",
      createdAt: expect.any(Date),
      sentAt: expect.any(Date),
      closedAt: expect.any(Date),
    }]);
    expect(await Trading._offer(carol)).toMatchObject([{ status: "WITHDRAWN" }]);
    expect(await Trading._incoming({ recipient: "bob" })).toEqual([]);
    expect(await Trading.accept({ ...carol, person: "bob" })).toMatchObject({ error: "NOT_PENDING" });
  });

  // Every combination of one or several tasks given for one or several tasks.
  const combinations = [
    { name: "one task for one task", offered: ["a1"], requested: ["b1"] },
    { name: "one task for several tasks", offered: ["a1"], requested: ["b1", "b2", "b3"] },
    { name: "several tasks for one task", offered: ["a1", "a2"], requested: ["b1"] },
    { name: "several tasks for several tasks", offered: ["a1", "a2", "a3"], requested: ["b1", "b2"] },
  ];

  test.each(combinations)("swaps $name", async ({ name, offered: givenA, requested: givenB }) => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const tag = (item: string) => `combo-${name}-${item}`;
    const offered = givenA.map(tag);
    const requested = givenB.map(tag);

    const offer = await sent(Trading, "alice2", "bob2", offered, requested);
    expect(await Trading._items(offer)).toEqual(rows(offered, requested));
    expect(await Trading._incoming({ recipient: "bob2" })).toContainEqual({ ...offer, proposer: "alice2", sentAt: expect.any(Date) });

    expect(await Trading.accept({ ...offer, person: "bob2" })).toEqual({ ...offer, proposer: "alice2", recipient: "bob2" });
    expect(await Trading._offer(offer)).toMatchObject([{ status: "ACCEPTED" }]);
    expect(await Trading._items(offer)).toEqual(rows(offered, requested));
    for (const item of [...offered, ...requested]) expect(await Trading._involving({ item })).toEqual([]);
  });

  test.each(combinations)("accepting $name withdraws any offer sharing even one of its tasks", async ({ name, offered: givenA, requested: givenB }) => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const tag = (item: string) => `conflict-${name}-${item}`;
    const offered = givenA.map(tag);
    const requested = givenB.map(tag);

    const offer = await sent(Trading, "alice3", "bob3", offered, requested);
    const sharesGiven = await sent(Trading, "alice3", "carol3", [offered.at(-1)!], [tag("c1")]);
    const sharesWanted = await sent(Trading, "dan3", "bob3", [tag("d1"), tag("d2")], [requested.at(-1)!]);
    const unrelated = await sent(Trading, "dan3", "carol3", [tag("d1")], [tag("c1")]);

    ok(await Trading.accept({ ...offer, person: "bob3" }));
    expect(await Trading._offer(sharesGiven)).toMatchObject([{ status: "WITHDRAWN" }]);
    expect(await Trading._offer(sharesWanted)).toMatchObject([{ status: "WITHDRAWN" }]);
    expect(await Trading._offer(unrelated)).toMatchObject([{ status: "PENDING" }]);
  });

  test("allows a task on both sides, including trading a task for itself", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const itself = await sent(Trading, "alice4", "bob4", ["p3-same"], ["p3-same"]);
    expect(await Trading._items(itself)).toEqual(rows(["p3-same"], ["p3-same"]));
    expect(await Trading._involving({ item: "p3-same" })).toEqual([
      { ...itself, proposer: "alice4", recipient: "bob4", side: "OFFERED" },
      { ...itself, proposer: "alice4", recipient: "bob4", side: "REQUESTED" },
    ]);
    expect(await Trading.accept({ ...itself, person: "bob4" })).toEqual({ ...itself, proposer: "alice4", recipient: "bob4" });

    const overlap = await sent(Trading, "alice4", "bob4", ["p3-x", "p3-y"], ["p3-y", "p3-z"]);
    ok(await Trading.accept({ ...overlap, person: "bob4" }));
    expect(await Trading._offer(overlap)).toMatchObject([{ status: "ACCEPTED" }]);
  });

  test("a draft can be edited only by its proposer and cannot be answered until it is sent", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const { offer } = ok(await Trading.propose({ proposer: "alice5", recipient: "bob5" }));
    expect(await Trading._offer({ offer })).toMatchObject([{ status: "DRAFT" }]);
    expect(await Trading._outgoing({ proposer: "alice5" })).toEqual([
      { offer, recipient: "bob5", status: "DRAFT", createdAt: expect.any(Date) },
    ]);

    expect(await Trading.send({ offer, person: "alice5" })).toMatchObject({ error: "EMPTY_SIDE" });
    ok(await Trading.addItem({ offer, person: "alice5", item: "p4-a", side: "OFFERED" }));
    expect(await Trading.send({ offer, person: "alice5" })).toMatchObject({ error: "EMPTY_SIDE" });
    expect(await Trading.addItem({ offer, person: "bob5", item: "p4-b", side: "REQUESTED" }))
      .toMatchObject({ error: "NOT_PROPOSER" });

    // Adding twice keeps one copy; removing takes it out.
    ok(await Trading.addItem({ offer, person: "alice5", item: "p4-a", side: "OFFERED" }));
    ok(await Trading.addItem({ offer, person: "alice5", item: "p4-extra", side: "OFFERED" }));
    ok(await Trading.removeItem({ offer, person: "alice5", item: "p4-extra", side: "OFFERED" }));
    ok(await Trading.addItem({ offer, person: "alice5", item: "p4-b", side: "REQUESTED" }));
    expect(await Trading._items({ offer })).toEqual(rows(["p4-a"], ["p4-b"]));

    expect(await Trading._incoming({ recipient: "bob5" })).toEqual([]);
    expect(await Trading._involving({ item: "p4-a" })).toEqual([]);
    expect(await Trading.accept({ offer, person: "bob5" })).toMatchObject({ error: "NOT_PENDING" });
    expect(await Trading.decline({ offer, person: "bob5" })).toMatchObject({ error: "NOT_PENDING" });

    expect(await Trading.send({ offer, person: "bob5" })).toMatchObject({ error: "NOT_PROPOSER" });
    ok(await Trading.send({ offer, person: "alice5" }));
    expect(await Trading.send({ offer, person: "alice5" })).toMatchObject({ error: "NOT_DRAFT" });
    expect(await Trading.addItem({ offer, person: "alice5", item: "p4-c", side: "OFFERED" }))
      .toMatchObject({ error: "NOT_DRAFT" });
    expect(await Trading.removeItem({ offer, person: "alice5", item: "p4-a", side: "OFFERED" }))
      .toMatchObject({ error: "NOT_DRAFT" });
  });

  test("decline and cancel close an offer without an exchange, and only the right person can do each", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const first = await sent(Trading, "alice6", "dan6", ["p5-dishes"], ["p5-sweep", "p5-mop"]);
    expect(await Trading.decline({ ...first, person: "alice6" })).toMatchObject({ error: "NOT_RECIPIENT" });
    expect(await Trading.accept({ ...first, person: "eve6" })).toMatchObject({ error: "NOT_RECIPIENT" });
    expect(await Trading.decline({ ...first, person: "dan6" })).toEqual(first);
    expect(await Trading._offer(first)).toMatchObject([{ status: "DECLINED" }]);
    expect(await Trading.accept({ ...first, person: "dan6" })).toMatchObject({ error: "NOT_PENDING" });
    expect(await Trading.cancel({ ...first, person: "alice6" })).toMatchObject({ error: "NOT_PENDING" });

    // A declined offer no longer blocks the same trade.
    const second = await sent(Trading, "alice6", "dan6", ["p5-dishes"], ["p5-sweep", "p5-mop"]);
    expect(await Trading.cancel({ ...second, person: "dan6" })).toMatchObject({ error: "NOT_PROPOSER" });
    expect(await Trading.cancel({ ...second, person: "alice6" })).toEqual(second);
    expect(await Trading._offer(second)).toMatchObject([{ status: "CANCELLED" }]);
    expect(await Trading.decline({ ...second, person: "dan6" })).toMatchObject({ error: "NOT_PENDING" });

    const unsent = await draft(Trading, "alice6", "dan6", ["p5-dishes"], []);
    ok(await Trading.cancel({ ...unsent, person: "alice6" }));
    expect(await Trading._outgoing({ proposer: "alice6" })).toEqual([]);
    expect(await Trading.addItem({ ...unsent, person: "alice6", item: "p5-x", side: "REQUESTED" }))
      .toMatchObject({ error: "NOT_DRAFT" });
  });

  test("refuses trading with yourself and duplicate offers in either direction", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    expect(await Trading.propose({ proposer: "alice7", recipient: "alice7" })).toMatchObject({ error: "SELF_TRADE" });

    await sent(Trading, "alice7", "bob7", ["p6-a1", "p6-a2"], ["p6-b1"]);
    const sameOtherOrder = await draft(Trading, "alice7", "bob7", ["p6-a2", "p6-a1"], ["p6-b1"]);
    expect(await Trading.send({ ...sameOtherOrder, person: "alice7" })).toMatchObject({ error: "ALREADY_OFFERED" });
    const reversed = await draft(Trading, "bob7", "alice7", ["p6-b1"], ["p6-a1", "p6-a2"]);
    expect(await Trading.send({ ...reversed, person: "bob7" })).toMatchObject({ error: "ALREADY_OFFERED" });

    // The refused drafts stay drafts, and a different set of tasks is a different trade.
    expect(await Trading._offer(sameOtherOrder)).toMatchObject([{ status: "DRAFT" }]);
    const subset = await draft(Trading, "alice7", "bob7", ["p6-a1"], ["p6-b1"]);
    ok(await Trading.send({ ...subset, person: "alice7" }));
  });

  test("unknown offers are refused and return no rows", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const offer = "missing-offer";
    expect(await Trading.addItem({ offer, person: "alice8", item: "x", side: "OFFERED" })).toMatchObject({ error: "NOT_FOUND" });
    expect(await Trading.removeItem({ offer, person: "alice8", item: "x", side: "OFFERED" })).toMatchObject({ error: "NOT_FOUND" });
    expect(await Trading.send({ offer, person: "alice8" })).toMatchObject({ error: "NOT_FOUND" });
    expect(await Trading.accept({ offer, person: "bob8" })).toMatchObject({ error: "NOT_FOUND" });
    expect(await Trading.decline({ offer, person: "bob8" })).toMatchObject({ error: "NOT_FOUND" });
    expect(await Trading.cancel({ offer, person: "alice8" })).toMatchObject({ error: "NOT_FOUND" });
    expect(await Trading._offer({ offer })).toEqual([]);
    expect(await Trading._items({ offer })).toEqual([]);
  });

  test("withdraw closes every pending offer for a task that changed hands another way, but not drafts", async () => {
    const { concepts: { Trading } } = assembleApplication(getTestDb);
    const task = "p8-sat-trash";
    const one = await sent(Trading, "alice9", "bob9", [task, "p8-a"], ["p8-x"]);
    const two = await sent(Trading, "carol9", "alice9", ["p8-y"], ["p8-z", task]);
    const other = await sent(Trading, "carol9", "bob9", ["p8-y"], ["p8-x"]);
    const unsent = await draft(Trading, "alice9", "dan9", [task], ["p8-d"]);

    expect(await Trading.withdraw({ item: task })).toEqual({ count: 2 });
    expect(await Trading._offer(one)).toMatchObject([{ status: "WITHDRAWN" }]);
    expect(await Trading._offer(two)).toMatchObject([{ status: "WITHDRAWN" }]);
    expect(await Trading._offer(other)).toMatchObject([{ status: "PENDING" }]);
    expect(await Trading._offer(unsent)).toMatchObject([{ status: "DRAFT" }]);
    expect(await Trading.withdraw({ item: task })).toEqual({ count: 0 });
  });

  test("two simultaneous accepts cannot trade away the same task twice", async () => {
    const trading = new TradingConcept(getTestDb);
    const make = async (recipient: string, offered: string[], requested: string[]) => {
      const { offer } = await trading.propose({ proposer: "alice10", recipient });
      for (const item of offered) await trading.addItem({ offer, person: "alice10", item, side: "OFFERED" });
      for (const item of requested) await trading.addItem({ offer, person: "alice10", item, side: "REQUESTED" });
      await trading.send({ offer, person: "alice10" });
      return { offer };
    };
    const one = await make("bob10", ["p9-a", "p9-shared"], ["p9-b"]);
    const two = await make("dan10", ["p9-shared"], ["p9-d1", "p9-d2"]);

    const results = await Promise.allSettled([
      trading.accept({ ...one, person: "bob10" }),
      trading.accept({ ...two, person: "dan10" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const statuses = [...await trading._offer(one), ...await trading._offer(two)].map((row) => row.status).sort();
    expect(statuses).toEqual(["ACCEPTED", "WITHDRAWN"]);
  });

  test("two simultaneous sends of the same trade leave only one pending", async () => {
    const trading = new TradingConcept(getTestDb);
    const make = async (proposer: string, recipient: string, offered: string, requested: string) => {
      const { offer } = await trading.propose({ proposer, recipient });
      await trading.addItem({ offer, person: proposer, item: offered, side: "OFFERED" });
      await trading.addItem({ offer, person: proposer, item: requested, side: "REQUESTED" });
      return { offer };
    };
    const one = await make("alice11", "bob11", "p10-a", "p10-b");
    const two = await make("bob11", "alice11", "p10-b", "p10-a");
    const results = await Promise.allSettled([
      trading.send({ ...one, person: "alice11" }),
      trading.send({ ...two, person: "bob11" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await trading._involving({ item: "p10-a" })).toHaveLength(1);
  });
});
