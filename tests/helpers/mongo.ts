import { afterAll, beforeAll } from "bun:test";
import { MongoClient, type Db } from "mongodb";

export function useMongoTestDb(name: string): () => Db {
  let client: MongoClient | undefined;
  let db: Db | undefined;

  beforeAll(async () => {
    const url = process.env.MONGODB_URL;
    if (!url) throw new Error("Set MONGODB_URL to run the MongoDB tests.");
    client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
    try {
      await client.connect();
    } catch (error) {
      throw new Error("MongoDB test connection failed. Check MONGODB_URL and run `bun run db:up`.", {
        cause: error,
      });
    }
    // Each suite gets a disposable database so test writes and cleanup stay isolated.
    db = client.db(`${name}_test_${crypto.randomUUID()}`);
  });

  afterAll(async () => {
    try {
      await db?.dropDatabase();
    } finally {
      await client?.close();
    }
  });

  return () => {
    if (!db) throw new Error("The test database was not initialized.");
    return db;
  };
}
