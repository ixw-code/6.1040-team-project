import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { PhotoCheckingConcept } from "./concepts/PhotoChecking/PhotoChecking.ts";
import { RankingConcept } from "./concepts/Ranking/Ranking.ts";
import { getDb } from "./db.ts";
import { RegisteringConcept } from "./concepts/Registering/Registering.ts";
import { Authenticating } from "./concepts/Authenticating/registry.ts";
import { Sessioning } from "./concepts/Sessioning/registry.ts";
import { composition as Users } from "./compositions/Users.ts";

// Use the app database by default and let tests supply an isolated database.
export function assembleApplication(database = getDb) {
  return assemble({
    conceptSet: applicationConceptSet,
    composition: {
      Users,
    },
    instances: {
      Ranking: new RankingConcept(database),
      PhotoChecking: new PhotoCheckingConcept(database),
      Registering: new RegisteringConcept(database),
      Authenticating: new Authenticating(database),
      Sessioning: new Sessioning(database),
    },
  });
}
