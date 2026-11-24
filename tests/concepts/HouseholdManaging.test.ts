import { describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import * as householdManaging from "../../src/concepts/HouseholdManaging/HouseholdManaging.ts";
import { useMongoTestDb } from "../helpers/mongo.ts";

const {
  HouseholdManagingConcept, HouseholdNameInvalid, HouseholdNotFound,
  HouseholdResidentConflict, HouseholdResidentNotFound, HouseholdOverseerConflict,
  CategoryNameInvalid, CategoryNameConflict, CategoryNotFound,
} = householdManaging;

const database = useMongoTestDb("households");

describe("HouseholdManaging", () => {
  test("creates a resident overseer, renames households, and lists memberships", async () => {
    const concept = new HouseholdManagingConcept(database);
    const { household } = await concept.create({ name: "Zeta", overseer: "alice" });
    const { household: other } = await concept.create({ name: "Beta", overseer: "alice" });
    expect(await concept._residents({ household })).toEqual([{ person: "alice" }]);
    expect(await concept.rename({ household, name: "Alpha" })).toEqual({ household });
    expect(await concept._household({ household })).toEqual([{ name: "Alpha", overseer: "alice" }]);
    expect(await concept._householdsByPerson({ person: "alice" })).toEqual([
      { household, name: "Alpha", overseer: "alice", categories: [] },
      { household: other, name: "Beta", overseer: "alice", categories: [] },
    ]);
  });

  test("initializes preferences in both directions and preserves them on category rename", async () => {
    const concept = new HouseholdManagingConcept(database);
    const { household } = await concept.create({ name: "Home", overseer: "alice" });
    const { category: kitchen } = await concept.addCategory({ household, name: "Kitchen" });
    const { residency } = await concept.addResident({ household, person: "bob" });
    const { category: bath } = await concept.addCategory({ household, name: "Bath" });
    const { preference } = await concept.setPreference({
      household, person: "bob", category: kitchen, preferenceLevel: "PREFER",
    });
    expect(await concept.setPreference({
      household, person: "bob", category: kitchen, preferenceLevel: "AVOID",
    })).toEqual({ preference });
    expect(await concept._preferences({ household, person: "bob" })).toEqual([
      { category: bath, preferenceLevel: "NEUTRAL" },
      { category: kitchen, preferenceLevel: "AVOID" },
    ]);
    expect(await concept._preferences({ household, person: "alice" })).toEqual([
      { category: bath, preferenceLevel: "NEUTRAL" },
      { category: kitchen, preferenceLevel: "NEUTRAL" },
    ]);
    expect(await concept.renameCategory({ household, category: kitchen, name: "A kitchen" }))
      .toEqual({ category: kitchen });
    expect(await concept._categories({ household })).toEqual([
      { category: kitchen, name: "A kitchen" },
      { category: bath, name: "Bath" },
    ]);
    expect(await concept.removeCategory({ household, category: bath })).toEqual({ category: bath });
    expect(await concept._preferences({ household, person: "bob" }))
      .toEqual([{ category: kitchen, preferenceLevel: "AVOID" }]);
    expect(await concept.removeResident({ household, person: "bob" })).toEqual({ residency, household, person: "bob" });
    expect(await concept._preferences({ household, person: "bob" })).toEqual([]);
    expect(await concept.addResident({ household, person: "bob" })).not.toEqual({ residency, household, person: "bob" });
    expect(await concept._preferences({ household, person: "bob" }))
      .toEqual([{ category: kitchen, preferenceLevel: "NEUTRAL" }]);
  });

  test("refuses invalid names, missing households and residents, and overseer removal", async () => {
    const concept = new HouseholdManagingConcept(database);
    const { household } = await concept.create({ name: "Home", overseer: "alice" });
    const missing = { household: "missing" };
    const bob = { household, person: "bob" };
    const alice = { household, person: "alice" };
    await expect(concept.create({ name: " ", overseer: "alice" })).rejects.toBeInstanceOf(HouseholdNameInvalid);
    await expect(concept.rename({ household, name: "" })).rejects.toBeInstanceOf(HouseholdNameInvalid);
    await expect(concept.addResident(alice)).rejects.toBeInstanceOf(HouseholdResidentConflict);
    await expect(concept.removeResident(bob)).rejects.toBeInstanceOf(HouseholdResidentNotFound);
    await expect(concept.setOverseer(bob)).rejects.toBeInstanceOf(HouseholdResidentNotFound);
    await expect(concept.setPreference({ ...bob, category: "missing", preferenceLevel: "NEUTRAL" }))
      .rejects.toBeInstanceOf(HouseholdResidentNotFound);
    await expect(concept.removeResident(alice)).rejects.toBeInstanceOf(HouseholdOverseerConflict);
    const missingActions = [
      () => concept.rename({ ...missing, name: "Home" }),
      () => concept.remove(missing),
      () => concept.addResident({ ...missing, person: "alice" }),
      () => concept.removeResident({ ...missing, person: "alice" }),
      () => concept.setOverseer({ ...missing, person: "alice" }),
      () => concept.addCategory({ ...missing, name: "Kitchen" }),
      () => concept.renameCategory({ ...missing, category: "missing", name: "Kitchen" }),
      () => concept.removeCategory({ ...missing, category: "missing" }),
    ];
    for (const action of missingActions) {
      await expect(action()).rejects.toBeInstanceOf(HouseholdNotFound);
    }
    await expect(concept.setPreference({
      ...missing, person: "alice", category: "missing", preferenceLevel: "NEUTRAL",
    })).rejects.toBeInstanceOf(HouseholdResidentNotFound);
    await concept.addResident(bob);
    expect(await concept.setOverseer(bob)).toEqual({ household });
    await concept.removeResident(alice);
    expect(await concept._residents({ household })).toEqual([{ person: "bob" }]);
  });

  test("enforces category boundaries and uniqueness within a household", async () => {
    const concept = new HouseholdManagingConcept(database);
    const { household } = await concept.create({ name: "One", overseer: "alice" });
    const { household: other } = await concept.create({ name: "Two", overseer: "alice" });
    const { category } = await concept.addCategory({ household, name: "Kitchen" });
    const { category: bath } = await concept.addCategory({ household, name: "Bath" });
    const { category: foreign } = await concept.addCategory({ household: other, name: "Kitchen" });
    await expect(concept.addCategory({ household, name: "" })).rejects.toBeInstanceOf(CategoryNameInvalid);
    await expect(concept.addCategory({ household, name: "Kitchen" })).rejects.toBeInstanceOf(CategoryNameConflict);
    await expect(concept.renameCategory({ household, category, name: " " })).rejects.toBeInstanceOf(CategoryNameInvalid);
    await expect(concept.renameCategory({ household, category, name: "Bath" })).rejects.toBeInstanceOf(CategoryNameConflict);
    expect(await concept.renameCategory({ household, category: bath, name: "Bath" })).toEqual({ category: bath });
    await expect(concept.renameCategory({ household, category: foreign, name: "Yard" })).rejects.toBeInstanceOf(CategoryNotFound);
    await expect(concept.removeCategory({ household, category: foreign })).rejects.toBeInstanceOf(CategoryNotFound);
    await expect(concept.setPreference({ household, person: "alice", category: foreign, preferenceLevel: "PREFER" }))
      .rejects.toBeInstanceOf(CategoryNotFound);
  });

  test("persists concurrent updates across instances and removes household-owned state", async () => {
    const first = new HouseholdManagingConcept(database);
    const second = new HouseholdManagingConcept(database);
    const { household } = await first.create({ name: "Shared", overseer: "alice" });
    const [{ category }] = await Promise.all([
      first.addCategory({ household, name: "Kitchen" }),
      second.addResident({ household, person: "bob" }),
    ]);
    const competing = await Promise.allSettled([
      first.addCategory({ household, name: "Bath" }),
      second.addCategory({ household, name: "Bath" }),
    ]);
    expect(competing.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(competing.find((result) => result.status === "rejected")?.reason).toBeInstanceOf(CategoryNameConflict);
    expect(await second._preferences({ household, person: "bob" })).toContainEqual({ category, preferenceLevel: "NEUTRAL" });
    expect(await second._preferences({ household, person: "bob" })).toHaveLength(2);

    const transfer = await Promise.allSettled([
      first.setOverseer({ household, person: "bob" }),
      second.removeResident({ household, person: "bob" }),
    ]);
    expect(transfer.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const client = new MongoClient(process.env.MONGODB_URL!);
    try {
      const reopened = new HouseholdManagingConcept(() => client.db(database().databaseName));
      expect(await reopened._categories({ household })).toHaveLength(2);
      expect(await reopened._household({ household })).toEqual(await second._household({ household }));
    } finally {
      await client.close();
    }
    const [details] = await second._household({ household });
    expect(await second._residents({ household })).toContainEqual({ person: details.overseer });
    expect(await second.remove({ household })).toEqual({ household });
    expect(await first._household({ household })).toEqual([]);
    expect(await first._categories({ household })).toEqual([]);
    expect(await first._residents({ household })).toEqual([]);
    expect(await first._preferences({ household, person: "alice" })).toEqual([]);
    expect((await first._householdsByPerson({ person: "alice" })).map((row) => row.household))
      .not.toContain(household);
  });
});
