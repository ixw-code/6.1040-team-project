import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/TaskScheduling.md" with { type: "text" };
import {
  AvailabilityNotFound,
  CompletionTimeInvalid,
  PersonNotAvailable,
  PreferencesInvalid,
  ScheduleEntriesInvalid,
  ScheduleWindowInvalid,
  TaskIntervalInvalid,
  TaskNotFound,
  TaskSchedulingConcept,
  TaskStatusConflict,
  TaskWeightInvalid,
  WeeklyAvailabilityInvalid,
} from "./TaskScheduling.ts";

export const taskScheduling = registerConcept({
  class: TaskSchedulingConcept,
  spec,
  refusals: {
    AVAILABILITY_NOT_FOUND: AvailabilityNotFound,
    COMPLETION_TIME_INVALID: CompletionTimeInvalid,
    PERSON_NOT_AVAILABLE: PersonNotAvailable,
    PREFERENCES_INVALID: PreferencesInvalid,
    SCHEDULE_ENTRIES_INVALID: ScheduleEntriesInvalid,
    SCHEDULE_WINDOW_INVALID: ScheduleWindowInvalid,
    TASK_INTERVAL_INVALID: TaskIntervalInvalid,
    TASK_NOT_FOUND: TaskNotFound,
    TASK_STATUS_CONFLICT: TaskStatusConflict,
    TASK_WEIGHT_INVALID: TaskWeightInvalid,
    WEEKLY_AVAILABILITY_INVALID: WeeklyAvailabilityInvalid,
  },
});
