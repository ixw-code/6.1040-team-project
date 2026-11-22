import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;
let db: Db | undefined;

// Connect on first use, so tooling that imports the app (sync-engine check, artifacts) runs without MONGODB_URL.
export function getDb(): Db {
  if (!db) {
    const url = process.env.MONGODB_URL;
    if (!url) {
      throw new Error("MONGODB_URL is not set. Add it to your .env file.");
    }
    client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
    db = client.db();
  }
  return db;
}
