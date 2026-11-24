import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/ChoreCataloguing.md" with { type: "text" };
import {
  ChoreCataloguingConcept,
  ChoreDifficultyInvalid,
  ChoreDoesntExist,
  ChoreNameConflict,
  ChoreNameInvalid,
} from "./ChoreCataloguing.ts";

export const choreCataloguing = registerConcept({
  class: ChoreCataloguingConcept,
  spec,
  refusals: {
    CHORE_NAME_CONFLICT: ChoreNameConflict,
    CHORE_NAME_INVALID: ChoreNameInvalid,
    CHORE_DIFFICULTY_INVALID: ChoreDifficultyInvalid,
    CHORE_DOESNT_EXIST: ChoreDoesntExist,
  },
});
