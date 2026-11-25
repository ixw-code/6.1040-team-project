import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { photoChecking } from "./concepts/PhotoChecking/registry.ts";
import { ranking } from "./concepts/Ranking/registry.ts";
import { registering } from "./concepts/Registering/registry.ts";
import { authenticating } from "./concepts/Authenticating/registry.ts";
import { sessioning } from "./concepts/Sessioning/registry.ts";
import { householdManaging } from "./concepts/HouseholdManaging/registry.ts";
import { choreCataloguing } from "./concepts/ChoreCataloguing/registry.ts";
import { taskScheduling } from "./concepts/TaskScheduling/registry.ts";

import {
    assignmentDate, assignmentInterval,
    assignmentPeople, matchesPersonalTask, availabilityWindows, assignmentCategory, activeChorePreferences,
} from "./helpers/assignments.ts";

import { evidenceInstructions, evidenceWindow } from "./helpers/evidenceInstructions.ts";

export const applicationConceptSet = conceptSet({
    HouseholdManaging: householdManaging,
    ChoreCataloguing: choreCataloguing,
    TaskScheduling: taskScheduling,
    Ranking: ranking,
    PhotoChecking: photoChecking, 
    Registering: registering, 
    Authenticating: authenticating, 
    Sessioning: sessioning
}, {
    evidenceInstructions, evidenceWindow,
    assignmentDate, assignmentInterval,
    assignmentPeople, matchesPersonalTask, availabilityWindows, assignmentCategory, activeChorePreferences,
});
export const { concepts, computations } = applicationConceptSet;
