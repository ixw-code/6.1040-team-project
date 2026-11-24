import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, is, no, now, reaction, view, when, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { isTimeZone, isWeeklyAvailability } from "../shared/weeklyAvailability.ts";
import { maxAssignmentOccurrences } from "../shared/assignmentDates.ts";

const { HouseholdManaging, ChoreCataloguing, TaskScheduling, Sessioning } = concepts;
const { assignmentDate, assignmentInterval, assignmentPeople, assignmentStatus, matchesPersonalTask, assignmentIsIncomplete, availabilityWindows, assignmentCategory, activeChorePreferences } = computations;

const CanManageSchedule = view("(requester) oversees (household)", ({ requester, household }) =>
  where(HouseholdManaging._household({ household }).is({ overseer: requester })),
).holds();

const CanReadSchedule = view("(requester) lives in (household)", ({ requester, household }) =>
  where(HouseholdManaging._residents({ household }).is({ person: requester })),
).holds();

const CanEditAvailability = view(
  "(requester) may set availability for (person) in (household)",
  ({ requester, person, household }) => [
    where(CanManageSchedule({ requester, household })),
    where(no(CanManageSchedule({ requester, household })), is.le(requester, person), is.ge(requester, person)),
  ],
).holds();

const CanReadHouseholdDetails = view(
  "(requester) may read scheduling details for (person) in (household)",
  ({ requester, person, household }) => where(CanEditAvailability({ requester, person, household })),
).holds();

const ValidHouseholdChore = view(
  "(chore) belongs to (household) with an optional valid category",
  ({ chore, household }, { category, difficulty }) => [
    where(
      ChoreCataloguing._active({ chore }).is({ group: household, category, difficulty }),
      HouseholdManaging._categories({ household }).is({ category }),
    ),
    where(
      ChoreCataloguing._active({ chore }).is({ group: household, difficulty }),
      whether(ChoreCataloguing._active({ chore }).is({ category })),
      compute(assignmentCategory, { category }, { present: false, category }),
    ),
  ],
).optional();

const AssignmentIsModifiable = view(
  "(task) is an incomplete task in (household)",
  ({ task, household }, _outputs, { completedAt }) => where(
    TaskScheduling._activeTask({ task }).is({ group: household }),
    whether(TaskScheduling._get({ task }).is({ completedAt })),
    compute(assignmentIsIncomplete, { completedAt }, { incomplete: true }),
  ),
).holds();

const HouseholdPreferences = former(
  "the scheduling preferences of (person) in (household)",
  ({ household, person }, { category, preferenceLevel }) =>
    each(HouseholdManaging._preferences({ household, person }).is({ category, preferenceLevel }))
      .form({ category, preferenceLevel }),
);

const PersonAvailability = former("availability for (person) in (household)", ({ household, person }, { availability, interval }) =>
  each(TaskScheduling._availability({ group: household, person }).is({ availability, interval })).form({ availability, interval }),
);

const PersonWeeklyAvailability = former(
  "the recurring availability of (person) in (household)",
  ({ household, person }, { days }) =>
    where(TaskScheduling._weeklyAvailability({ group: household, person }).is({ days })).form({ weeklyAvailability: days }),
);

const ResidentWorkload = former("the workload of (person) in (household)", ({ household, person }, { workload }) =>
  where(TaskScheduling._workload({ group: household, person }).is({ workload })).form({ workload }),
);

const HouseholdOverview = former(
  "the scheduling overview of (household)",
  ({ household }, { person }) =>
    each(HouseholdManaging._residents({ household }).is({ person }))
      .form({
        person,
        availability: PersonAvailability({ household, person }),
        preferences: HouseholdPreferences({ household, person }),
      }).splicing(ResidentWorkload({ household, person }), PersonWeeklyAvailability({ household, person })),
);

const ChoreDetails = former(
  "the details of the catalogue (item) in (household)",
  ({ item, household }, { name, description, requirements, references }) =>
    where(ChoreCataloguing._get({ chore: item }).is({ group: household, name, description, requirements, references }))
      .form({ name, description, requirements, references }),
).optional();

const ScheduleTaskDetails = former(
  "the display details of (task) in (household) at (asOf)",
  ({ task, household, asOf }, { item, category, name, deadline, interval, assignee, source, completedAt, completedBy, weight, status }) =>
    where(
      TaskScheduling._get({ task }).is({ group: household, item, weight }),
      whether(TaskScheduling._get({ task }).is({ category })),
      compute(assignmentCategory, { category }, { category }),
      whether(TaskScheduling._get({ task }).is({ deadline })),
      whether(TaskScheduling._get({ task }).is({ interval })),
      whether(TaskScheduling._get({ task }).is({ assignee, source })),
      whether(TaskScheduling._get({ task }).is({ completedAt, completedBy })),
      compute(assignmentStatus, { deadline, interval, completedAt, asOf }, status),
    ).form({
      task, item, category, deadline, interval, assignee, source, completedAt, completedBy, weight, status,
      categoryName: each(HouseholdManaging._categories({ household }).is({ category, name })).first(name),
      chore: whether(ChoreDetails({ item, household })),
    }),
);

const HouseholdSchedule = former(
  "the schedule of (household) from (from) until (until) at (asOf)",
  ({ household, from, until, asOf }, { task }) =>
    each(TaskScheduling._schedule({ group: household, from, until }).is({ task }))
      .form({}).splicing(ScheduleTaskDetails({ task, household, asOf })),
);

const PersonalTaskMatches = view(
  "(task) matches (mode) for (person)",
  ({ task, person, mode }, _outputs, { assignee, completedBy }) => where(
    whether(TaskScheduling._get({ task }).is({ assignee })),
    whether(TaskScheduling._get({ task }).is({ completedBy })),
    compute(matchesPersonalTask, { person, assignee, completedBy, mode }, { matches: true }),
  ),
).holds();

const MyTasks = former(
  "the (mode) tasks of (person) in (household) from (from) until (until) at (asOf)",
  ({ household, from, until, asOf, person, mode }, { task }) =>
    each(TaskScheduling._schedule({ group: household, from, until }).is({ task }))
      .where(PersonalTaskMatches({ task, person, mode }))
      .form({}).splicing(ScheduleTaskDetails({ task, household, asOf })),
);

const ResidentRemoved = reaction(({ household, person }) =>
  when(HouseholdManaging.removeResident({}).responds({ household, person }))
    .where(no(HouseholdManaging._residents({ household }).is({ person })))
    .then(TaskScheduling.removePerson({ group: household, person })),
);

const text = (value: unknown) => typeof value === "string";
function date(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 19) === value.slice(0, 19);
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const interval = (value: unknown) => object(value) && Object.keys(value).length === 2 && date(value.start) && date(value.end);
const entries = (value: unknown) => Array.isArray(value) && value.every((entry: unknown) =>
  object(entry) && text(entry.task) && Object.keys(entry).every((key) => key === "task" || key === "assignee")
  && (!Object.hasOwn(entry, "assignee") || text(entry.assignee)));
const nullable = (validate: (value: unknown) => boolean) => (value: unknown) => value === null || validate(value);

function route(path: string, fields: Record<string, (value: unknown) => boolean>,
  build: Parameters<typeof endpoint>[1], defaults: Record<string, unknown> = {}) {
  const validators = { session: nullable(text), household: text, ...fields };
  return endpoint(`/assignments/${path}`, build, {
    input: { required: Object.keys(validators).filter((key) => !Object.hasOwn(defaults, key)), defaults },
    validators: {
      input: (value) => object(value) && Object.entries(value).every(([key, field]) =>
        Object.hasOwn(validators, key) && validators[key as keyof typeof validators](field))
        ? { ok: true } : { ok: false, detail: "invalid assignment request" },
    },
  });
}

const householdExists = (household: symbol) => HouseholdManaging._household({ household }).is({});
const residentExists = (household: symbol, person: symbol) => HouseholdManaging._residents({ household }).is({ person });
const missingHousehold = (household: symbol) =>
  where(no(householdExists(household))).then(respond({ error: "NOT_FOUND" })).named("missingHousehold");
const denied = (household: symbol, allowed: ReturnType<typeof CanManageSchedule>) =>
  where(householdExists(household), no(allowed)).then(respond({ error: "ACCESS_DENIED" })).named("denied");
const missingResident = (allowed: ReturnType<typeof CanManageSchedule>, household: symbol, person: symbol) =>
  where(allowed, no(residentExists(household, person)), householdExists(household))
    .then(respond({ error: "NOT_FOUND" })).named("missingResident");

const AddAvailability = route("availability/add", { person: text, start: date, end: date }, (
  { session, requester, household, person, start, end, fromDate, untilDate, availability },
) => {
  const allowed = CanEditAvailability({ requester, person, household });
  return receive({ session, household, person, start, end }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed), missingResident(allowed, household, person),
    where(allowed, residentExists(household, person),
      compute(assignmentDate, { value: start }, fromDate), compute(assignmentDate, { value: end }, untilDate))
      .then(TaskScheduling.addAvailability({ group: household, person, start: fromDate, end: untilDate }).responds({ availability }))
      .then(respond({ availability })).named("added"),
  );
});

const EditAvailability = route("availability/edit", {
  windows: value => Array.isArray(value) && value.length > 0 && value.length <= 31 && value.every(interval),
  adding: value => typeof value === "boolean",
}, ({ session, household, person, windows, adding, intervals, freed }) =>
  receive({ session, household, windows, adding }).then(Sessioning.use({ session }).responds({ subject: person })).then(
    missingHousehold(household), denied(household, CanReadSchedule({ requester: person, household })),
    where(residentExists(household, person), compute(availabilityWindows, { windows }, intervals))
      .then(TaskScheduling.editAvailability({ group: household, person, windows: intervals, adding }).responds({ freed }))
      .then(respond({ freed })).named("edited"),
  ),
);

const SetWeeklyAvailability = route("availability/weekly/set", { days: isWeeklyAvailability, timeZone: isTimeZone }, (
  { session, household, person, days, timeZone, freed },
) => receive({ session, household, days, timeZone }).then(Sessioning.use({ session }).responds({ subject: person })).then(
  missingHousehold(household), denied(household, CanReadSchedule({ requester: person, household })),
  where(residentExists(household, person))
    .then(TaskScheduling.setWeeklyAvailability({ group: household, person, days, timeZone }).responds({ freed }))
    .then(respond({ freed })).named("saved"),
));

const RemoveAvailability = route("availability/remove", { person: text, availability: text }, (
  { session, requester, household, person, availability, freed },
) => {
  const allowed = CanEditAvailability({ requester, person, household });
  const exists = TaskScheduling._availability({ group: household, person }).is({ availability });
  return receive({ session, household, person, availability }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed), missingResident(allowed, household, person),
    where(allowed, residentExists(household, person), no(exists)).then(respond({ error: "NOT_FOUND" })).named("missingAvailability"),
    where(allowed, residentExists(household, person), exists)
      .then(TaskScheduling.removeAvailability({ availability }).responds({ freed })).then(respond({ freed })).named("removed"),
  );
});

const RetryResidentCleanup = route("residents/cleanup", { person: text }, ({ session, requester, household, person, freed }) => {
  const allowed = CanManageSchedule({ requester, household });
  const resident = residentExists(household, person);
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, resident).then(respond({ error: "RESIDENT_STILL_PRESENT" })).named("stillResident"),
    where(allowed, no(resident)).then(TaskScheduling.removePerson({ group: household, person }).responds({ freed }))
      .then(respond({ freed })).named("cleaned"),
  );
});

const CreateTask = route("tasks/create", { chore: text, deadline: nullable(date), interval: nullable(interval) }, (
  { session, requester, household, chore, deadline, interval, due, scheduledInterval, category, weight, task },
) => {
  const allowed = CanManageSchedule({ requester, household });
  const valid = ValidHouseholdChore({ chore, household });
  return receive({ session, household, chore, deadline, interval }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, no(valid.is({}))).then(respond({ error: "NOT_FOUND" })).named("missingChore"),
    where(allowed, valid.is({ category, difficulty: weight }),
      compute(assignmentDate, { value: deadline }, due), compute(assignmentInterval, { value: interval }, scheduledInterval))
      .then(TaskScheduling.add({ group: household, item: chore, category, weight, deadline: due, interval: scheduledInterval }).responds({ task }))
      .then(respond({ task })).named("created"),
  );
}, { deadline: null, interval: null });

const CreateTaskBatch = route("tasks/create-batch", {
  chore: text,
  batchId: value => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value),
  windows: value => Array.isArray(value) && value.length > 0 && value.length <= maxAssignmentOccurrences && value.every(interval),
  repeatWeekly: value => typeof value === "boolean",
  timeZone: nullable(isTimeZone),
}, ({ session, requester, household, chore, batchId, windows, repeatWeekly, timeZone, intervals, category, weight, tasks }) => {
  const allowed = CanManageSchedule({ requester, household });
  const valid = ValidHouseholdChore({ chore, household });
  return receive({ session, household, chore, batchId, windows, repeatWeekly, timeZone })
    .then(Sessioning.use({ session }).responds({ subject: requester })).then(
      missingHousehold(household), denied(household, allowed),
      where(allowed, no(valid.is({}))).then(respond({ error: "NOT_FOUND" })).named("missingChore"),
      where(allowed, valid.is({ category, difficulty: weight }), compute(availabilityWindows, { windows }, intervals))
        .then(TaskScheduling.addBatch({ group: household, item: chore, category, weight, intervals, batchId, repeatWeekly, timeZone }).responds({ tasks }))
        .then(respond({ tasks })).named("created"),
    );
}, { repeatWeekly: false, timeZone: null });

function taskChange(path: string, field: "deadline" | "interval" | undefined) {
  return route(path, { task: text, ...(field === "deadline" ? { deadline: nullable(date) }
    : field === "interval" ? { interval: nullable(interval) } : {}) },
    ({ session, requester, household, task, deadline, interval, timing }) => {
      const allowed = CanManageSchedule({ requester, household });
      const exists = TaskScheduling._activeTask({ task }).is({ group: household });
      const modifiable = AssignmentIsModifiable({ task, household });
      const input = { session, household, task, ...(field === "deadline" ? { deadline } : field === "interval" ? { interval } : {}) };
      const conversion = field === "deadline" ? [compute(assignmentDate, { value: deadline }, timing)]
        : field === "interval" ? [compute(assignmentInterval, { value: interval }, timing)] : [];
      const change = field === "deadline" ? TaskScheduling.updateDeadline({ task, deadline: timing })
        : field === "interval" ? TaskScheduling.updateInterval({ task, interval: timing }) : TaskScheduling.remove({ task });
      return receive(input).then(Sessioning.use({ session }).responds({ subject: requester })).then(
        missingHousehold(household), denied(household, allowed),
        where(allowed, no(exists)).then(respond({ error: "NOT_FOUND" })).named("missingTask"),
        where(allowed, exists, no(modifiable)).then(respond({ error: "TASK_STATUS_CONFLICT" })).named("completedTask"),
        where(allowed, modifiable, ...conversion).then(change.responds({ task })).then(respond({ task })).named("changed"),
      );
    }, field ? { [field]: null } : {});
}

const RemoveTask = taskChange("tasks/remove", undefined);
const DeleteAssignment = route("tasks/delete", { task: text }, ({ session, requester, household, task }) => {
  const allowed = CanManageSchedule({ requester, household });
  return receive({ session, household, task }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed).then(TaskScheduling.archiveAssignment({ group: household, task }).responds({ task }))
      .then(respond({ task })).named("deleted"),
  );
});

const UpdateDeadline = taskChange("tasks/deadline", "deadline");
const UpdateInterval = taskChange("tasks/interval", "interval");

const windowFields = { from: date, until: date };
const windowReads = (from: symbol, until: symbol, fromDate: symbol, untilDate: symbol) => [
  compute(assignmentDate, { value: from }, fromDate),
  compute(assignmentDate, { value: until }, untilDate),
];

function automatic(path: string, weekly: boolean) {
  const fields = weekly ? windowFields : { ...windowFields, onlyUnassigned: (value: unknown) => typeof value === "boolean" };
  return route(path, fields, ({ session, requester, household, from, until, onlyUnassigned, fromDate, untilDate, people, preferences, chorePreferences, items, usablePreferences, scheduled, unassigned }) => {
    const allowed = CanManageSchedule({ requester, household });
    return receive({ session, household, from, until, ...(!weekly && { onlyUnassigned }) })
      .then(Sessioning.use({ session }).responds({ subject: requester })).then(
        missingHousehold(household), denied(household, allowed),
        where(allowed, ...windowReads(from, until, fromDate, untilDate),
          HouseholdManaging._schedulingInputs({ household }).is({ people, preferences, chorePreferences }),
          ChoreCataloguing._catalogItems({ group: household }).is({ items }),
          compute(activeChorePreferences, { chorePreferences, items }, usablePreferences))
          .then(TaskScheduling.autoSchedule({
            group: household, from: fromDate, until: untilDate, onlyUnassigned: weekly ? true : onlyUnassigned,
            people, preferences, chorePreferences: usablePreferences,
          }).responds({ scheduled, unassigned })).then(respond({ scheduled, unassigned })).named("scheduled"),
      );
  });
}

const AutoSchedule = automatic("auto-schedule", false);
const WeeklyAutoSchedule = automatic("weekly", true);

const Reset = route("reset", windowFields, ({ session, requester, household, from, until, fromDate, untilDate, cleared }) => {
  const allowed = CanManageSchedule({ requester, household });
  return receive({ session, household, from, until }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, ...windowReads(from, until, fromDate, untilDate))
      .then(TaskScheduling.reset({ group: household, from: fromDate, until: untilDate }).responds({ cleared }))
      .then(respond({ cleared })).named("reset"),
  );
});

const SetSchedule = route("set", { entries }, ({ session, requester, household, entries, people, updated }) => {
  const allowed = CanManageSchedule({ requester, household });
  return receive({ session, household, entries }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, compute(assignmentPeople, { entries }, people), HouseholdManaging._allResidents({ household, people }).is({ all: false }))
      .then(respond({ error: "NOT_FOUND" })).named("missingAssignee"),
    where(allowed, compute(assignmentPeople, { entries }, people), HouseholdManaging._allResidents({ household, people }).is({ all: true }))
      .then(TaskScheduling.setSchedule({ group: household, entries }).responds({ entries: updated }))
      .then(respond({ entries: updated })).named("assigned"),
  );
});

const GetSchedule = route("schedule", windowFields, ({ session, requester, household, from, until, fromDate, untilDate, asOf }) => {
  const allowed = CanReadSchedule({ requester, household });
  return receive({ session, household, from, until }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, ...windowReads(from, until, fromDate, untilDate), is.ge(fromDate, untilDate))
      .then(respond({ error: "SCHEDULE_WINDOW_INVALID" })).named("invalidWindow"),
    where(allowed, ...windowReads(from, until, fromDate, untilDate), is.lt(fromDate, untilDate), now(asOf))
      .then(respond({ tasks: HouseholdSchedule({ household, from: fromDate, until: untilDate, asOf }) })).named("schedule"),
  );
});

const AssignmentList = former(
  "the assignments of (household) from (from) until (until)",
  ({ household, from, until }, { task, item, weekly, occurrences, remaining, mixed, assignee, startsAt, endsAt }) =>
    each(TaskScheduling._assignments({ group: household, from, until })
      .is({ task, item, weekly, occurrences, remaining, mixed, assignee, startsAt, endsAt }))
      .form({
        task, item, weekly, occurrences, remaining, mixed, assignee, startsAt, endsAt,
        chore: whether(ChoreDetails({ item, household })),
      }),
);

const GetAssignments = route("list", windowFields, ({ session, requester, household, from, until, fromDate, untilDate }) => {
  const allowed = CanManageSchedule({ requester, household });
  return receive({ session, household, from, until }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, ...windowReads(from, until, fromDate, untilDate), is.ge(fromDate, untilDate))
      .then(respond({ error: "SCHEDULE_WINDOW_INVALID" })).named("invalidWindow"),
    where(allowed, ...windowReads(from, until, fromDate, untilDate), is.lt(fromDate, untilDate))
      .then(respond({ assignments: AssignmentList({ household, from: fromDate, until: untilDate }) })).named("assignments"),
  );
});

const GetTask = route("task", { task: text }, ({ session, requester, household, task, asOf }) => {
  const allowed = CanReadSchedule({ requester, household });
  const exists = TaskScheduling._activeTask({ task }).is({ group: household });
  return receive({ session, household, task }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, no(exists)).then(respond({ error: "NOT_FOUND" })).named("missingTask"),
    where(allowed, exists, now(asOf)).then(respond({ task: ScheduleTaskDetails({ household, task, asOf }) })).named("task"),
  );
});

const GetMyTasks = route("mine", {
  ...windowFields, mode: (value) => value === "all" || value === "assigned" || value === "completed",
}, ({ session, requester, household, from, until, mode, fromDate, untilDate, asOf }) => {
  const allowed = CanReadSchedule({ requester, household });
  return receive({ session, household, from, until, mode }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed, ...windowReads(from, until, fromDate, untilDate), is.ge(fromDate, untilDate))
      .then(respond({ error: "SCHEDULE_WINDOW_INVALID" })).named("invalidWindow"),
    where(allowed, ...windowReads(from, until, fromDate, untilDate), is.lt(fromDate, untilDate), now(asOf))
      .then(respond({ tasks: MyTasks({ household, from: fromDate, until: untilDate, person: requester, mode, asOf }) })).named("tasks"),
  );
}, { mode: "all" });

const GetTotal = route("total", { person: text }, ({ session, requester, household, person, workload }) => {
  const allowed = CanReadHouseholdDetails({ requester, household, person });
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed), missingResident(allowed, household, person),
    where(allowed, residentExists(household, person), TaskScheduling._workload({ group: household, person }).is({ workload }))
      .then(respond({ workload })).named("total"),
  );
});

const GetAvailability = route("availability", { person: text }, ({ session, requester, household, person }) => {
  const allowed = CanReadHouseholdDetails({ requester, household, person });
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed), missingResident(allowed, household, person),
    where(allowed, residentExists(household, person))
      .then(respond({ availability: PersonAvailability({ household, person }) })).named("availability"),
  );
});

const GetWeeklyAvailability = route("availability/weekly", { person: text }, ({ session, requester, household, person, days }) => {
  const allowed = CanReadHouseholdDetails({ requester, household, person });
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed), missingResident(allowed, household, person),
    where(allowed, residentExists(household, person), TaskScheduling._weeklyAvailability({ group: household, person }).is({ days }))
      .then(respond({ days })).named("availability"),
  );
});

const GetHouseholdOverview = route("overview", {}, ({ session, requester, household }) => {
  const allowed = CanManageSchedule({ requester, household });
  return receive({ session, household }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household), denied(household, allowed),
    where(allowed).then(respond({ residents: HouseholdOverview({ household }) })).named("overview"),
  );
});

export const assignmentHttpErrors = {
  TASK_NOT_FOUND: "NOT_FOUND", AVAILABILITY_NOT_FOUND: "NOT_FOUND",
  WEEKLY_AVAILABILITY_INVALID: "INVALID_REQUEST", TASK_INTERVAL_INVALID: "INVALID_REQUEST", TASK_WEIGHT_INVALID: "INVALID_REQUEST",
  SCHEDULE_WINDOW_INVALID: "INVALID_REQUEST", PREFERENCES_INVALID: "INVALID_REQUEST",
  SCHEDULE_ENTRIES_INVALID: "INVALID_REQUEST", TASK_STATUS_CONFLICT: "CONFLICT",
  PERSON_NOT_AVAILABLE: "CONFLICT", RESIDENT_STILL_PRESENT: "CONFLICT",
} as const;

export const composition = {
  CanManageSchedule, CanReadSchedule, CanEditAvailability, CanReadHouseholdDetails,
  ValidHouseholdChore, AssignmentIsModifiable, HouseholdPreferences,
  PersonAvailability, PersonWeeklyAvailability, ResidentWorkload, HouseholdOverview, ChoreDetails, ScheduleTaskDetails, HouseholdSchedule, PersonalTaskMatches, MyTasks,
  ResidentRemoved, RetryResidentCleanup, AddAvailability, EditAvailability, SetWeeklyAvailability, RemoveAvailability, CreateTask, CreateTaskBatch, RemoveTask, DeleteAssignment,
  UpdateDeadline, UpdateInterval, AutoSchedule, WeeklyAutoSchedule, Reset, SetSchedule,
  GetSchedule, AssignmentList, GetAssignments, GetTask, GetMyTasks, GetTotal, GetAvailability, GetWeeklyAvailability, GetHouseholdOverview,
};
