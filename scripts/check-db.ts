import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URI;
if (!url) {
  throw new Error("MONGODB_URI is not set. Copy .env.example to .env first.");
}

const timeout = process.argv.includes("--wait") ? 30_000 : 3000;
const client = new MongoClient(url, { serverSelectionTimeoutMS: timeout });
const checks = client.db().collection<{ _id: string; at: Date }>("setup_checks");
const id = crypto.randomUUID();

try {
  await client.connect();
  await client.db().command({ ping: 1 });
  await checks.insertOne({ _id: id, at: new Date() });
  if (!(await checks.findOne({ _id: id }))) {
    throw new Error("The database check could not read back its temporary record.");
  }
  await checks.deleteOne({ _id: id });
  console.log(`MongoDB ready: ${client.db().databaseName} (ping, write, read, delete passed).`);
} catch (error) {
  console.error("MongoDB check failed. Start Podman and run `bun run db:up`.");
  console.error(error instanceof Error ? error.message : "Unknown database error.");
  process.exitCode = 1;
} finally {
  await client.close();
}
