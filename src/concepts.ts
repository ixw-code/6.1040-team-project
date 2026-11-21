import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { photoChecking } from "./concepts/PhotoChecking.registry.ts";
import { ranking } from "./concepts/Ranking.registry.ts";

export const applicationConceptSet = conceptSet({ Ranking: ranking, PhotoChecking: photoChecking });
export const { concepts } = applicationConceptSet;
