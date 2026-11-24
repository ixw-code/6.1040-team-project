import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { photoChecking } from "./concepts/PhotoChecking.registry.ts";
import { ranking } from "./concepts/Ranking.registry.ts";
import { registering } from "./concepts/Registering/registry.ts";
import { authenticating } from "./concepts/Authenticating/registry.ts";

export const applicationConceptSet = conceptSet({ Ranking: ranking, PhotoChecking: photoChecking, Registering: registering, Authenticating: authenticating});
export const { concepts } = applicationConceptSet;
