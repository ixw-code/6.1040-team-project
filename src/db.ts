import { MongoClient, type Db } from "mongodb";

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = process.env.MONGODB_URL;
    if (!url) {
      throw new Error("MONGODB_URL is not set. Add it to your .env file.");
    }
    db = new MongoClient(url, { serverSelectionTimeoutMS: 3000 }).db();
  }
  return db;
}
