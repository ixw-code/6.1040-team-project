import type { Db } from "mongodb";

export class HouseholdNameInvalid extends Error {}
export class HouseholdNotFound extends Error {}
export class HouseholdResidentConflict extends Error {}
export class HouseholdResidentNotFound extends Error {}
export class HouseholdOverseerConflict extends Error {}
export class CategoryNameInvalid extends Error {}
export class CategoryNameConflict extends Error {}
export class CategoryNotFound extends Error {}
export class PreferenceLevelInvalid extends Error {}
export class ChoreOrderInvalid extends Error {}

type HouseholdRef = { household: string };
type PersonRef = { person: string };
type CategoryRef = { category: string };
type PreferenceLevel = "PREFER" | "NEUTRAL" | "AVOID";
type PreferenceRow = CategoryRef & { preferenceLevel: PreferenceLevel };
type Category = CategoryRef & { name: string };
type Resident = PersonRef & {
  residency: string;
  choreOrder?: string[];
  preferences: Record<string, { preference: string; preferenceLevel: PreferenceLevel }>;
};
type Household = {
  _id: string;
  version: number;
  name: string;
  overseer: string;
  categories: Category[];
  residents: Resident[];
};

function neutralPreference(): Resident["preferences"][string] {
  return { preference: crypto.randomUUID(), preferenceLevel: "NEUTRAL" };
}

function compareNames(first: string, second: string): number {
  return first.localeCompare(second, "en");
}

function byCategoryName(first: Category, second: Category): number {
  return compareNames(first.name, second.name) || compareNames(first.category, second.category);
}

export class HouseholdManagingConcept {
  constructor(private readonly getDb: () => Db) {}

  #households() {
    return this.getDb().collection<Household>("household_managing_households");
  }

  // Update one household atomically. If another writer won, retry against its state
  // so both the refusal checks and the update use the same version.
  async #update<Result>(
    household: string,
    change: (state: Household) => Result,
    missingHousehold = () => new HouseholdNotFound("This household does not exist."),
  ): Promise<Result> {
    const households = this.#households();
    while (true) {
      const state = await households.findOne({ _id: household });
      if (!state) throw missingHousehold();
      const { version } = state;
      const result = change(state);
      state.version += 1;
      const write = await households.replaceOne({ _id: household, version }, state);
      if (write.matchedCount === 1) return result;
    }
  }

  async create({ name, overseer }: { name: string; overseer: string }): Promise<HouseholdRef> {
    if (!name.trim()) throw new HouseholdNameInvalid("Household name cannot be empty.");
    const household = crypto.randomUUID();
    await this.#households().insertOne({
      _id: household,
      version: 0,
      name,
      overseer,
      categories: [],
      residents: [{ person: overseer, residency: crypto.randomUUID(), preferences: {} }],
    });
    return { household };
  }

  async rename({ household, name }: HouseholdRef & { name: string }): Promise<HouseholdRef> {
    return this.#update(household, (state) => {
      if (!name.trim()) throw new HouseholdNameInvalid("Household name is invalid.");
      state.name = name;
      return { household };
    });
  }

  async addResident({ household, person }: HouseholdRef & PersonRef): Promise<{ residency: string }> {
    return this.#update(household, (state) => {
      if (state.residents.some((resident) => resident.person === person)) {
        throw new HouseholdResidentConflict("This person is already a resident.");
      }
      const residency = crypto.randomUUID();
      const preferences = Object.fromEntries(
        state.categories.map(({ category }) => [category, neutralPreference()]),
      );
      state.residents.push({ person, residency, preferences });
      return { residency };
    });
  }

  async removeResident({ household, person }: HouseholdRef & PersonRef): Promise<HouseholdRef & PersonRef & { residency: string }> {
    return this.#update(household, (state) => {
      const index = state.residents.findIndex((resident) => resident.person === person);
      if (index === -1) throw new HouseholdResidentNotFound("This person does not belong to the household.");
      if (state.overseer === person) {
        throw new HouseholdOverseerConflict("Household oversight must be transferred before removal.");
      }
      const [resident] = state.residents.splice(index, 1);
      return { residency: resident.residency, household, person };
    });
  }

  async setOverseer({ household, person }: HouseholdRef & PersonRef): Promise<HouseholdRef> {
    return this.#update(household, (state) => {
      if (!state.residents.some((resident) => resident.person === person)) {
        throw new HouseholdResidentNotFound("The overseer must belong to the household.");
      }
      state.overseer = person;
      return { household };
    });
  }

  async addCategory({ household, name }: HouseholdRef & { name: string }): Promise<CategoryRef> {
    return this.#update(household, (state) => {
      if (!name.trim()) throw new CategoryNameInvalid("Category name is invalid.");
      if (state.categories.some((entry) => entry.name === name)) {
        throw new CategoryNameConflict("A category with this name already exists.");
      }
      const category = crypto.randomUUID();
      state.categories.push({ category, name });
      for (const resident of state.residents) {
        resident.preferences[category] = neutralPreference();
      }
      return { category };
    });
  }

  async renameCategory({ household, category, name }: HouseholdRef & CategoryRef & { name: string }): Promise<CategoryRef> {
    return this.#update(household, (state) => {
      const current = state.categories.find((entry) => entry.category === category);
      if (!current) throw new CategoryNotFound("This category does not belong to the household.");
      if (!name.trim()) throw new CategoryNameInvalid("Category name cannot be empty.");
      if (state.categories.some((entry) => entry !== current && entry.name === name)) {
        throw new CategoryNameConflict("A category with this name already exists.");
      }
      current.name = name;
      return { category };
    });
  }

  async removeCategory({ household, category }: HouseholdRef & CategoryRef): Promise<CategoryRef> {
    return this.#update(household, (state) => {
      const index = state.categories.findIndex((entry) => entry.category === category);
      if (index === -1) throw new CategoryNotFound("This category does not belong to the household.");
      state.categories.splice(index, 1);
      for (const resident of state.residents) {
        delete resident.preferences[category];
      }
      return { category };
    });
  }

  async setPreference({
    household, person, category, preferenceLevel,
  }: HouseholdRef & PersonRef & PreferenceRow): Promise<{ preference: string }> {
    return this.#update(household, (state) => {
      const resident = state.residents.find((entry) => entry.person === person);
      if (!resident) throw new HouseholdResidentNotFound("This person is not a resident.");
      if (!state.categories.some((entry) => entry.category === category)) {
        throw new CategoryNotFound("This category does not belong to the household.");
      } 
      if (
        preferenceLevel !== "PREFER" &&
        preferenceLevel !== "NEUTRAL" &&
        preferenceLevel !== "AVOID"
      ) {
        throw new PreferenceLevelInvalid(
          "Preference level must be PREFER, NEUTRAL, or AVOID.",
        );
      }
      const preference = resident.preferences[category];
      preference.preferenceLevel = preferenceLevel;
      return { preference: preference.preference };
    }, () => new HouseholdResidentNotFound("This person is not a resident."));
  }

  async setChoreOrder({ household, person, order }: HouseholdRef & PersonRef & { order: string[] }): Promise<{ order: string[] }> {
    if (new Set(order).size !== order.length) throw new ChoreOrderInvalid("Rank each chore at most once.");
    return this.#update(household, state => {
      const resident = state.residents.find(entry => entry.person === person);
      if (!resident) throw new HouseholdResidentNotFound("This person is not a resident.");
      resident.choreOrder = [...order];
      return { order: resident.choreOrder };
    });
  }

  async _choreOrder({ household, person }: HouseholdRef & PersonRef): Promise<{ order: string[] }> {
    const state = await this.#households().findOne({ _id: household });
    return { order: state?.residents.find(entry => entry.person === person)?.choreOrder ?? [] };
  }

  async remove({ household }: HouseholdRef): Promise<HouseholdRef> {
    const result = await this.#households().deleteOne({ _id: household });
    if (result.deletedCount === 0) throw new HouseholdNotFound("This household does not exist.");
    return { household };
  }

  async _household({ household }: HouseholdRef): Promise<{ name: string; overseer: string }[]> {
    const state = await this.#households().findOne({ _id: household });
    return state ? [{ name: state.name, overseer: state.overseer }] : [];
  }

  async _householdsByPerson({ person }: PersonRef): Promise<(HouseholdRef & {
    name: string;
    overseer: string;
    categories: string[];
  })[]> {
    const states = await this.#households().find({ "residents.person": person }).toArray();
    return states.sort((first, second) =>
      compareNames(first.name, second.name) || compareNames(first._id, second._id),
    ).map(({ _id, name, overseer, categories }) => ({
      household: _id,
      name,
      overseer,
      categories: categories.sort(byCategoryName).map(({ category }) => category),
    }));
  }

  async _categories({ household }: HouseholdRef): Promise<Category[]> {
    const state = await this.#households().findOne({ _id: household });
    return state?.categories.sort(byCategoryName).map(({ category, name }) => ({ category, name })) ?? [];
  }

  async _residents({ household }: HouseholdRef): Promise<PersonRef[]> {
    const state = await this.#households().findOne({ _id: household });
    return state?.residents.map(({ person }) => ({ person })) ?? [];
  }

  async _schedulingInputs({ household }: HouseholdRef): Promise<{
    people: PersonRef[];
    preferences: (PersonRef & PreferenceRow)[];
    chorePreferences: (PersonRef & { order: string[] })[];
  }> {
    const state = await this.#households().findOne({ _id: household });
    if (!state) return { people: [], preferences: [], chorePreferences: [] };
    return {
      people: state.residents.map(({ person }) => ({ person })),
      chorePreferences: state.residents.flatMap(({ person, choreOrder }) =>
        choreOrder === undefined ? [] : [{ person, order: choreOrder }]),
      preferences: state.residents.flatMap(({ person, preferences }) =>
        state.categories.map(({ category }) => ({
          person, category, preferenceLevel: preferences[category].preferenceLevel,
        }))),
    };
  }

  async _allResidents({ household, people }: HouseholdRef & { people: string[] }): Promise<{ all: boolean }> {
    const residents = new Set((await this._residents({ household })).map(({ person }) => person));
    return { all: people.every((person) => residents.has(person)) };
  }

  async _preferences({ household, person }: HouseholdRef & PersonRef): Promise<PreferenceRow[]> {
    const state = await this.#households().findOne({ _id: household });
    const resident = state?.residents.find((entry) => entry.person === person);
    if (!state || !resident) return [];
    return state.categories.sort(byCategoryName).map(({ category }) => ({
      category,
      preferenceLevel: resident.preferences[category].preferenceLevel,
    }));
  }
}
