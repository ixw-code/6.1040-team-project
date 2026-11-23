import { describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import { RankingConcept } from "../../src/concepts/Ranking.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

describe("Ranking", () => {
  const getTestDb = useMongoTestDb("ranking");

  test("keeps the first credit for a task and scores households independently", async () => {
    const ranking = new RankingConcept(getTestDb);
    const task = { group: "first-house", contribution: "monday-sink" };

    expect(await ranking._score({ group: task.group, person: "alice" })).toEqual({ score: 0 });
    expect(await ranking._ranking({ group: task.group })).toEqual([]);
    expect(await ranking.credit({ ...task, person: "alice" })).toEqual(task);
    expect(await ranking.credit({ ...task, person: "alice" })).toEqual(task);
    expect(await ranking.credit({ ...task, person: "sam" })).toEqual(task);
    await ranking.credit({ ...task, group: "second-house", person: "sam" });

    const reopened = new RankingConcept(getTestDb);
    expect(await reopened._score({ group: task.group, person: "alice" })).toEqual({ score: 1 });
    expect(await reopened._score({ group: task.group, person: "sam" })).toEqual({ score: 0 });
    expect(await reopened._ranking({ group: "second-house" })).toEqual([
      { person: "sam", score: 1, rank: 1 },
    ]);
  });

  test("deduplicates concurrent credits across concept instances", async () => {
    const first = new RankingConcept(getTestDb);
    const second = new RankingConcept(getTestDb);
    const task = { group: "concurrent-house", contribution: "monday-sink" };

    expect(await Promise.all([
      first.credit({ ...task, person: "alice" }),
      second.credit({ ...task, person: "sam" }),
    ])).toEqual([task, task]);
    const rows = await first._ranking({ group: task.group });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 1, rank: 1 });
  });

  test("shares ranks for tied scores and skips the next rank through the assembly", async () => {
    const { concepts: { Ranking } } = assembleApplication(getTestDb);
    const group = "ranked-house";

    await Ranking.credit({ group, person: "sam", contribution: "task-1" });
    await Ranking.credit({ group, person: "alice", contribution: "task-2" });
    await Ranking.credit({ group, person: "bob", contribution: "task-3" });
    await Ranking.credit({ group, person: "sam", contribution: "task-4" });
    await Ranking.credit({ group, person: "alice", contribution: "task-5" });

    expect(await Ranking._ranking({ group })).toEqual([
      { person: "alice", score: 2, rank: 1 },
      { person: "sam", score: 2, rank: 1 },
      { person: "bob", score: 1, rank: 3 },
    ]);
  });
});
