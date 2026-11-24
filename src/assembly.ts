import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { PhotoCheckingConcept } from "./concepts/PhotoChecking.ts";
import { RankingConcept } from "./concepts/Ranking.ts";
import { getDb } from "./db.ts";
import { RegisteringConcept } from "./concepts/Registering/Registering.ts";
import { Authenticating } from "./concepts/Authenticating/registry.ts";
import { Sessioning } from "./concepts/Sessioning/registry.ts";
import { composition as ChoreAssignments } from "./compositions/ChoreAssignments.ts";
import { composition as Users } from "./compositions/Users.ts";

import { composition as HouseholdManagement } from "./compositions/HouseholdManagement.ts";
import { HouseholdManagingConcept } from "./concepts/HouseholdManaging/HouseholdManaging.ts";
import { ChoreCataloguingConcept } from "./concepts/ChoreCataloguing/ChoreCataloguing.ts";
import { TaskSchedulingConcept } from "./concepts/TaskScheduling/TaskScheduling.ts";

// Use the app database by default and let tests supply an isolated database.
export function assembleApplication(database = getDb) {
  return assemble({
    conceptSet: applicationConceptSet,
    composition: {
      Users,
      HouseholdManagement,
      ChoreAssignments,
    },
    instances: {
      HouseholdManaging: new HouseholdManagingConcept(database),
      ChoreCataloguing: new ChoreCataloguingConcept(database),
      TaskScheduling: new TaskSchedulingConcept(database),
      Ranking: new RankingConcept(database),
      PhotoChecking: new PhotoCheckingConcept(database),
      Registering: new RegisteringConcept(database),
      Authenticating: new Authenticating(database),
      Sessioning: new Sessioning(database),
    },
  });
}
