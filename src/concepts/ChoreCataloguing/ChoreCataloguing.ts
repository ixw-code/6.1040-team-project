import { MongoServerError, type Db } from "mongodb";

export class ChoreNameConflict extends Error {}
export class ChoreNameInvalid extends Error {}
export class ChoreDifficultyInvalid extends Error {}
export class ChoreDoesntExist extends Error {}

type ChoreRef = { chore: string };
type ChoreKey = ChoreRef & { group: string };
type ChoreDetails = {
  name: string;
  category: string;
  difficulty: number;
  description: string;
  requirements: string[];
  references: string[];
};
type ChoreDocument = ChoreDetails & { _id: string; group: string };

function validDifficulty(difficulty: number): boolean {
  return Number.isFinite(difficulty) && difficulty >= 1 && difficulty <= 10;
}

function rethrowNameConflict(error: unknown): never {
  if (error instanceof MongoServerError && error.code === 11000 && error.keyPattern?.group === 1 && error.keyPattern?.name === 1) {
    throw new ChoreNameConflict("Chore with the same name already exists.");
  }
  throw error;
}

export class ChoreCataloguingConcept {
  private nameIndex: Promise<string> | undefined;

  constructor(private readonly getDb: () => Db) {}

  #chores() {
    return this.getDb().collection<ChoreDocument>("chore_cataloguing_chores");
  }

  #ensureNameIndex() {
    this.nameIndex ??= this.#chores()
      .createIndex({ group: 1, name: 1 }, { unique: true, collation: { locale: "simple" } })
      .catch((error: unknown) => {
        this.nameIndex = undefined;
        throw error;
      });
    return this.nameIndex;
  }

  async #requireChore({ chore, group }: ChoreKey): Promise<void> {
    const found = await this.#chores().findOne({ _id: chore, group }, { projection: { _id: 1 } });
    if (!found) throw new ChoreDoesntExist("This chore doesn't exist in the catalog.");
  }

  async #update({ chore, group }: ChoreKey, fields: Partial<ChoreDetails>): Promise<ChoreRef> {
    const result = await this.#chores().updateOne({ _id: chore, group }, { $set: fields });
    if (result.matchedCount === 0) throw new ChoreDoesntExist("This chore doesn't exist in the catalog.");
    return { chore };
  }

  async create(input: ChoreDetails & { group: string }): Promise<ChoreRef> {
    const { group, name, category, difficulty, description, requirements, references } = input;
    if (!name.trim()) throw new ChoreNameInvalid("Chore name is invalid.");
    if (!validDifficulty(difficulty)) {
      throw new ChoreDifficultyInvalid("Chore difficulty must be in the range [1, 10].");
    }
    const chore = crypto.randomUUID();
    await this.#ensureNameIndex();
    try {
      await this.#chores().insertOne({
        _id: chore, group, name, category, difficulty, description,
        requirements: [...new Set(requirements)], references: [...new Set(references)],
      });
    } catch (error) {
      rethrowNameConflict(error);
    }
    return { chore };
  }

  async updateDifficulty({ chore, group, difficulty }: ChoreKey & { difficulty: number }): Promise<ChoreRef> {
    if (!validDifficulty(difficulty)) {
      await this.#requireChore({ chore, group });
      throw new ChoreDifficultyInvalid("Chore difficulty must be in the range [1, 10].");
    }
    return this.#update({ chore, group }, { difficulty });
  }

  async updateDetails({
    chore, group, newCategory, newName, newDescription,
  }: ChoreKey & { newCategory: string; newName: string; newDescription: string }): Promise<ChoreRef> {
    if (!newName.trim()) {
      await this.#requireChore({ chore, group });
      throw new ChoreNameInvalid("Chore name is invalid.");
    }
    await this.#ensureNameIndex();
    try {
      return await this.#update({ chore, group }, {
        category: newCategory, name: newName, description: newDescription,
      });
    } catch (error) {
      rethrowNameConflict(error);
    }
  }

  async updateRequirements({ chore, group, requirements }: ChoreKey & {
    requirements: string[];
  }): Promise<ChoreRef> {
    return this.#update({ chore, group }, { requirements: [...new Set(requirements)] });
  }

  async updateReferencePhotos({ chore, group, references }: ChoreKey & { references: string[] }): Promise<ChoreRef> {
    return this.#update({ chore, group }, { references: [...new Set(references)] });
  }

  async remove({ chore, group }: ChoreKey): Promise<ChoreKey> {
    const result = await this.#chores().deleteOne({ _id: chore, group });
    if (result.deletedCount === 0) throw new ChoreDoesntExist("This chore doesn't exist in the catalog.");
    return { chore, group };
  }

  async _get({ chore }: ChoreRef): Promise<(ChoreDetails & { group: string })[]> {
    const found = await this.#chores().findOne({ _id: chore });
    if (!found) return [];
    const { _id, ...details } = found;
    return [details];
  }

  async #list(filter: { group: string; category?: string }, sortByDifficulty: boolean): Promise<ChoreDocument[]> {
    const rows = await this.#chores().find(filter).toArray();
    return rows.sort((first, second) =>
      (sortByDifficulty ? first.difficulty - second.difficulty : 0)
      || first.name.localeCompare(second.name, "en")
      || first._id.localeCompare(second._id, "en"),
    );
  }

  async _chores({ group, sortByDifficulty }: { group: string; sortByDifficulty: boolean }): Promise<
    (ChoreRef & ChoreDetails)[]
  > {
    const rows = await this.#list({ group }, sortByDifficulty);
    return rows.map(({ _id, group: _group, ...details }) => ({ chore: _id, ...details }));
  }

  async _choresByCategory({ group, category, sortByDifficulty }: {
    group: string; category: string; sortByDifficulty: boolean;
  }): Promise<(ChoreRef & Omit<ChoreDetails, "category">)[]> {
    const rows = await this.#list({ group, category }, sortByDifficulty);
    return rows.map(({ _id, group: _group, category: _category, ...details }) => ({ chore: _id, ...details }));
  }
}
