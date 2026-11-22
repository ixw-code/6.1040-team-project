import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { applicationConceptSet } from "./concepts.ts";
import { TradingConcept } from "./concepts/Trading.ts";
import { getDb } from "./db.ts";

// Use the app database by default and let tests supply an isolated database.
export function assembleApplication(database: () => Db = getDb) {
  return assemble({
    conceptSet: applicationConceptSet,
    composition: {},
    instances: {
      Trading: new TradingConcept(database),
    },
  });
}
