import { MongoServerError, type Db } from "mongodb";

type CreditKey = { group: string; contribution: string };
type Credit = { _id: CreditKey; person: string };
type RankingRow = { person: string; score: number; rank: number };

export class RankingConcept {
  constructor(private readonly getDb: () => Db) {}

  #credits() {
    return this.getDb().collection<Credit>("ranking_credits");
  }

  async credit({ group, person, contribution }: CreditKey & { person: string }): Promise<CreditKey> {
    const key = { group, contribution };
    try {
      // MongoDB's unique _id index keeps the first credit, including on concurrent retries.
      await this.#credits().insertOne({ _id: key, person });
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) {
        throw error;
      }
    }
    return key;
  }

  async _score({ group, person }: { group: string; person: string }): Promise<{ score: number }> {
    const score = await this.#credits().countDocuments({ "_id.group": group, person });
    return { score };
  }

  async _ranking({ group }: { group: string }): Promise<RankingRow[]> {
    // Rank by score alone so ties share a rank. Sort by person afterward for a consistent display order.
    return this.#credits().aggregate<RankingRow>([
      { $match: { "_id.group": group } },
      { $group: { _id: "$person", score: { $sum: 1 } } },
      { $setWindowFields: { sortBy: { score: -1 }, output: { rank: { $rank: {} } } } },
      { $sort: { score: -1, _id: 1 } },
      { $project: { _id: 0, person: "$_id", score: 1, rank: 1 } },
    ]).toArray();
  }
}
