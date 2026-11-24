import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Ranking.md" with { type: "text" };
import { RankingConcept } from "./Ranking.ts";

// Pair the implementation with its Markdown spec so sync-engine can check and register it.
export const ranking = registerConcept({ class: RankingConcept, spec });
