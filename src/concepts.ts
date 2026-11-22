import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { trading } from "./concepts/Trading.registry.ts";

export const applicationConceptSet = conceptSet({ Trading: trading });
export const { concepts } = applicationConceptSet;
