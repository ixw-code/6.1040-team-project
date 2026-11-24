import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/HouseholdManaging.md" with { type: "text" };
import {
  CategoryNameConflict,
  CategoryNameInvalid,
  CategoryNotFound,
  HouseholdManagingConcept,
  HouseholdNameInvalid,
  HouseholdNotFound,
  HouseholdOverseerConflict,
  HouseholdResidentConflict,
  HouseholdResidentNotFound,
  PreferenceLevelInvalid
} from "./HouseholdManaging.ts";

export const householdManaging = registerConcept({
  class: HouseholdManagingConcept,
  spec,
  refusals: {
    HOUSEHOLD_NAME_INVALID: HouseholdNameInvalid,
    HOUSEHOLD_NOT_FOUND: HouseholdNotFound,
    HOUSEHOLD_RESIDENT_CONFLICT: HouseholdResidentConflict,
    HOUSEHOLD_OVERSEER_CONFLICT: HouseholdOverseerConflict,
    HOUSEHOLD_RESIDENT_NOT_FOUND: HouseholdResidentNotFound,
    CATEGORY_NAME_INVALID: CategoryNameInvalid,
    CATEGORY_NAME_CONFLICT: CategoryNameConflict,
    CATEGORY_NOT_FOUND: CategoryNotFound,
    PREFERENCE_LEVEL_INVALID: PreferenceLevelInvalid,
  },
});
