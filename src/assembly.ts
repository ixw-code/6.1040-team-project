import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { PhotoCheckingConcept } from "./concepts/PhotoChecking.ts";
import { RankingConcept } from "./concepts/Ranking.ts";
import { getDb } from "./db.ts";
import { RegisteringConcept } from "./concepts/Registering/Registering.ts";
import { Authenticating } from "./concepts/Authenticating/registry.ts";

// Use the app database by default and let tests supply an isolated database.
export function assembleApplication(database = getDb) {
  return assemble({
    conceptSet: applicationConceptSet,
    composition: {},
    instances: {
      Ranking: new RankingConcept(database),
      PhotoChecking: new PhotoCheckingConcept(database),
      Registering: new RegisteringConcept(database),
      Authenticating: new Authenticating(database)
    },
  });
}
