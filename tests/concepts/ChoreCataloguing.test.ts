import { describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  ChoreCataloguingConcept, ChoreDifficultyInvalid, ChoreDoesntExist, ChoreNameConflict, ChoreNameInvalid,
} from "../../src/concepts/ChoreCataloguing/ChoreCataloguing.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const database = useMongoTestDb("chores");

const dishes = {
  group: "apartment",
  name: "Wash dishes",
  category: "kitchen",
  difficulty: 2.5,
  description: "Wash and dry the dishes.",
  requirements: ["Empty the sink"],
  references: ["photo-1"],
};

describe("ChoreCataloguing", () => {
  test("stores all chore details and persists edits through a new MongoDB client", async () => {
    const concept = new ChoreCataloguingConcept(database);
    const { chore } = await concept.create({
      ...dishes,
      requirements: [...dishes.requirements, ...dishes.requirements],
      references: [...dishes.references, ...dishes.references],
    });
    expect(await concept._get({ chore })).toEqual([dishes]);

    const key = { chore, group: dishes.group };
    expect(await concept.updateDetails({
      ...key, newCategory: "dining", newName: "Clean table", newDescription: "Wipe the dining table.",
    })).toEqual({ chore });
    expect(await concept.updateDifficulty({ ...key, difficulty: 10 })).toEqual({ chore });
    expect(await concept.updateRequirements({ ...key, requirements: ["Use a cloth", "Use a cloth"] })).toEqual({ chore });
    expect(await concept.updateReferencePhotos({ ...key, references: [] })).toEqual({ chore });

    const client = new MongoClient(process.env.MONGODB_URL!);
    try {
      const reader = new ChoreCataloguingConcept(() => client.db(database().databaseName));
      expect(await reader._get({ chore })).toEqual([{
        ...dishes, name: "Clean table", description: "Wipe the dining table.", category: "dining",
        difficulty: 10, requirements: ["Use a cloth"], references: [],
      }]);
      expect(await reader._choresByCategory({
        group: dishes.group, category: "kitchen", sortByDifficulty: false,
      })).toEqual([]);
      expect(await reader.remove(key)).toEqual(key);
      expect(await concept._get({ chore })).toEqual([]);
      await expect(reader.remove(key)).rejects.toBeInstanceOf(ChoreDoesntExist);
    } finally {
      await client.close();
    }
  });

  test("refuses invalid names and nonfinite or out-of-range difficulty on create and update", async () => {
    const concept = new ChoreCataloguingConcept(database);
    const group = "validation";
    await expect(concept.create({ ...dishes, group, name: "  " })).rejects.toBeInstanceOf(ChoreNameInvalid);
    const { chore } = await concept.create({ ...dishes, group, difficulty: 1 });
    await expect(concept.updateDetails({
      chore, group, newCategory: "other", newName: "", newDescription: "",
    })).rejects.toBeInstanceOf(ChoreNameInvalid);
    for (const difficulty of [0.9, 10.1, NaN, Infinity, -Infinity]) {
      await expect(concept.create({ ...dishes, group, name: "Invalid", difficulty }))
        .rejects.toBeInstanceOf(ChoreDifficultyInvalid);
      await expect(concept.updateDifficulty({ chore, group, difficulty }))
        .rejects.toBeInstanceOf(ChoreDifficultyInvalid);
    }
    expect(await concept._get({ chore })).toEqual([{ ...dishes, group, difficulty: 1 }]);
    expect(await concept._chores({ group, sortByDifficulty: false })).toHaveLength(1);
  });

  test("refuses edits and removal from a different group", async () => {
    const concept = new ChoreCataloguingConcept(database);
    const { chore } = await concept.create({ ...dishes, group: "owned" });
    const key = { chore, group: "other" };
    await expect(concept.updateDetails({
      ...key, newCategory: "unknown", newName: "", newDescription: "",
    })).rejects.toBeInstanceOf(ChoreDoesntExist);
    await expect(concept.updateDifficulty({ ...key, difficulty: NaN })).rejects.toBeInstanceOf(ChoreDoesntExist);
    await expect(concept.updateRequirements({ ...key, requirements: [] })).rejects.toBeInstanceOf(ChoreDoesntExist);
    await expect(concept.updateReferencePhotos({ ...key, references: [] })).rejects.toBeInstanceOf(ChoreDoesntExist);
    await expect(concept.remove(key)).rejects.toBeInstanceOf(ChoreDoesntExist);
    expect(await concept._get({ chore })).toEqual([{ ...dishes, group: "owned" }]);
  });

  test("enforces group-local names across concurrent creates and detail updates", async () => {
    const first = new ChoreCataloguingConcept(database);
    const second = new ChoreCataloguingConcept(database);
    const group = "duplicates";
    const definition = { ...dishes, group };
    const outcomes = await Promise.allSettled([first.create(definition), second.create(definition)]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((result) => result.status === "rejected")?.reason).toBeInstanceOf(ChoreNameConflict);
    const { chore } = await first.create({ ...definition, name: "Sweep" });
    await second.create({ ...definition, group: "another-group" });
    const change = { chore, group, newCategory: "dining", newDescription: "Sweep under the table." };
    await expect(second.updateDetails({ ...change, newName: dishes.name })).rejects.toBeInstanceOf(ChoreNameConflict);
    expect(await first._get({ chore })).toEqual([{ ...definition, name: "Sweep" }]);
    expect(await second.updateDetails({ ...change, newName: "Sweep" })).toEqual({ chore });
    const { chore: other } = await first.create({ ...definition, name: "Mop" });
    const renames = await Promise.allSettled([
      first.updateDetails({ ...change, newName: "Clean floor" }),
      second.updateDetails({ ...change, chore: other, newName: "Clean floor" }),
    ]);
    expect(renames.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(renames.find((result) => result.status === "rejected")?.reason).toBeInstanceOf(ChoreNameConflict);
  });

  test("filters by group and category and sorts by name or difficulty with alphabetical ties", async () => {
    const concept = new ChoreCataloguingConcept(database);
    const group = "sorting";
    const definition = { ...dishes, group };
    await concept.create({ ...definition, name: "Zebra", difficulty: 1 });
    await concept.create({ ...definition, name: "Alpha", difficulty: 4 });
    await concept.create({ ...definition, name: "Beta", difficulty: 1, category: "yard" });
    await concept.create({ ...definition, name: "Cedar", difficulty: 1 });
    await concept.create({ ...definition, name: "Elsewhere", group: "outside" });
    const named = await concept._chores({ group, sortByDifficulty: false });
    expect(named.map(({ name }) => name)).toEqual(["Alpha", "Beta", "Cedar", "Zebra"]);
    const weighted = await concept._chores({ group, sortByDifficulty: true });
    expect(weighted.map(({ name }) => name)).toEqual(["Beta", "Cedar", "Zebra", "Alpha"]);
    const category = await concept._choresByCategory({ group, category: "kitchen", sortByDifficulty: true });
    expect(category.map(({ name }) => name)).toEqual(["Cedar", "Zebra", "Alpha"]);
    expect(category[0]).not.toHaveProperty("category");
    expect(await concept._chores({ group: "missing", sortByDifficulty: false })).toEqual([]);
  });
});
