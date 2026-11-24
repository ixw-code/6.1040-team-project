import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, former, is, no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { HouseholdManaging, ChoreCataloguing, TaskScheduling, Registering, Sessioning } = concepts;

const CanManageHousehold = view(
  "(requester) oversees (household)",
  ({ requester, household }) => where(HouseholdManaging._household({ household }).is({ overseer: requester })),
).holds();

const CanReadHousehold = view(
  "(requester) lives in (household)",
  ({ requester, household }) => where(HouseholdManaging._residents({ household }).is({ person: requester })),
).holds();

const CanEditPreference = view(
  "(requester) may edit preferences for (person) in (household)",
  ({ requester, person, household }) => where(
    HouseholdManaging._residents({ household }).is({ person }),
    is.le(requester, person),
    is.ge(requester, person),
  ),
).holds();

const CanRemoveResident = view(
  "(requester) may remove (person) from (household)",
  ({ requester, person, household }) => [
    where(CanManageHousehold({ requester, household })),
    where(no(CanManageHousehold({ requester, household })), is.le(requester, person), is.ge(requester, person)),
  ],
).holds();

const CanReadPreferences = view(
  "(requester) may read preferences for (person) in (household)",
  ({ requester, person, household }) => where(CanRemoveResident({ requester, person, household })),
).holds();

const HouseholdDetails = former(
  "the details of (household)",
  ({ household }, { name, overseer, person, category, categoryName }) =>
    where(HouseholdManaging._household({ household }).is({ name, overseer })).form({
      household, name, overseer,
      residents: each(HouseholdManaging._residents({ household }).is({ person })).form({ person }),
      categories: each(HouseholdManaging._categories({ household }).is({ category, name: categoryName }))
        .form({ category, name: categoryName }),
    }),
);

const PersonHouseholds = former(
  "the households of (person)",
  ({ person }, { household, name, overseer, categories }) =>
    each(HouseholdManaging._householdsByPerson({ person }).is({ household, name, overseer, categories }))
      .form({ household, name, overseer, categories }),
);

const HouseholdResidents = former(
  "the residents of (household)",
  ({ household }, { person }) =>
    each(HouseholdManaging._residents({ household }).is({ person })).form({ person }),
);

const HouseholdCategories = former(
  "the categories of (household)",
  ({ household }, { category, name }) =>
    each(HouseholdManaging._categories({ household }).is({ category, name })).form({ category, name }),
);

const ResidentPreferences = former(
  "the preferences of (person) in (household)",
  ({ household, person }, { category, preferenceLevel }) =>
    each(HouseholdManaging._preferences({ household, person }).is({ category, preferenceLevel }))
      .form({ category, preferenceLevel }),
);

function signedIn(path: string, fields: readonly string[], build: Parameters<typeof endpoint>[1]) {
  const accepted = new Set(["session", ...fields]);
  return endpoint(`/households/${path}`, build, {
    validators: {
      input: (value) => {
        const ok = typeof value === "object" && value !== null && !Array.isArray(value)
          && Object.entries(value).every(([key, field]) =>
            accepted.has(key) && (typeof field === "string" || (key === "session" && field === null)));
        return ok ? { ok: true } : { ok: false, detail: "expected household request fields as text" };
      },
    },
  });
}

const householdExists = (household: symbol) => HouseholdManaging._household({ household }).is({});
const residentExists = (household: symbol, person: symbol) => HouseholdManaging._residents({ household }).is({ person });
const categoryExists = (household: symbol, category: symbol) => HouseholdManaging._categories({ household }).is({ category });
const missingHousehold = (household: symbol) =>
  where(no(householdExists(household))).then(respond({ error: "NOT_FOUND" })).named("missingHousehold");
const accessDenied = (household: symbol, allowed: ReturnType<typeof CanManageHousehold>) =>
  where(householdExists(household), no(allowed)).then(respond({ error: "ACCESS_DENIED" })).named("accessDenied");

const CreateHousehold = signedIn("create", ["name"], ({ session, requester, name, household }) =>
  receive({ session, name }).then(Sessioning.use({ session }).responds({ subject: requester }))
    .then(HouseholdManaging.create({ name, overseer: requester }).responds({ household }))
    .then(respond({ household })),
);

const AddResident = signedIn("residents/add", ["household", "person"], ({ session, requester, household, person, residency }) => {
  const allowed = CanManageHousehold({ requester, household });
  const registered = Registering._username({ user: person }).is({});
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, no(registered)).then(respond({ error: "NOT_FOUND" })).named("missingPerson"),
    where(allowed, registered).then(HouseholdManaging.addResident({ household, person }).responds({ residency }))
      .then(respond({ residency })).named("added"),
  );
});

const RemoveResident = signedIn("residents/remove", ["household", "person"], ({ session, requester, household, person, residency }) => {
  const allowed = CanRemoveResident({ requester, household, person });
  const resident = residentExists(household, person);
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, no(resident)).then(respond({ error: "NOT_FOUND" })).named("missingResident"),
    where(allowed, resident).then(HouseholdManaging.removeResident({ household, person }).responds({ residency, household, person }))
      .then(respond({ residency, household, person })).named("removed"),
  );
});

const RenameHousehold = signedIn("rename", ["household", "name"], ({ session, requester, household, name }) => {
  const allowed = CanManageHousehold({ requester, household });
  return receive({ session, household, name }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed).then(HouseholdManaging.rename({ household, name }).responds({ household }))
      .then(respond({ household })).named("renamed"),
  );
});

const SetOverseer = signedIn("overseer", ["household", "person"], ({ session, requester, household, person }) => {
  const allowed = CanManageHousehold({ requester, household });
  const resident = residentExists(household, person);
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, no(resident)).then(respond({ error: "NOT_FOUND" })).named("missingResident"),
    where(allowed, resident).then(HouseholdManaging.setOverseer({ household, person }).responds({ household }))
      .then(respond({ household })).named("transferred"),
  );
});

const AddCategory = signedIn("categories/add", ["household", "name"], ({ session, requester, household, name, category }) => {
  const allowed = CanManageHousehold({ requester, household });
  return receive({ session, household, name }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed).then(HouseholdManaging.addCategory({ household, name }).responds({ category }))
      .then(respond({ category })).named("added"),
  );
});

const RenameCategory = signedIn("categories/rename", ["household", "category", "name"], ({ session, requester, household, category, name }) => {
  const allowed = CanManageHousehold({ requester, household });
  const exists = categoryExists(household, category);
  return receive({ session, household, category, name }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, no(exists)).then(respond({ error: "NOT_FOUND" })).named("missingCategory"),
    where(allowed, exists).then(HouseholdManaging.renameCategory({ household, category, name }).responds({ category }))
      .then(respond({ category })).named("renamed"),
  );
});

const RemoveCategory = signedIn("categories/remove", ["household", "category"], ({ session, requester, household, category }) => {
  const allowed = CanManageHousehold({ requester, household });
  const exists = categoryExists(household, category);
  const chores = ChoreCataloguing._choresByCategory({ group: household, category, sortByDifficulty: false }).is({});
  const tasks = TaskScheduling._tasks({ group: household }).is({ category });
  return receive({ session, household, category }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, no(exists)).then(respond({ error: "NOT_FOUND" })).named("missingCategory"),
    where(allowed, exists, chores).then(respond({ error: "CATEGORY_IN_USE" })).named("hasChores"),
    where(allowed, exists, no(chores), tasks).then(respond({ error: "CATEGORY_IN_USE" })).named("hasTasks"),
    where(allowed, exists, no(chores), no(tasks))
      .then(HouseholdManaging.removeCategory({ household, category }).responds({ category }))
      .then(respond({ category })).named("removed"),
  );
});

const SetPreference = signedIn("preferences/set", ["household", "person", "category", "preferenceLevel"], (
  { session, requester, household, person, category, preferenceLevel, preference },
) => {
  const allowed = CanEditPreference({ requester, household, person });
  const resident = residentExists(household, person);
  const exists = categoryExists(household, category);
  return receive({ session, household, person, category, preferenceLevel })
    .then(Sessioning.use({ session }).responds({ subject: requester })).then(
      missingHousehold(household),
      where(householdExists(household), no(resident), CanReadHousehold({ requester, household }))
        .then(respond({ error: "NOT_FOUND" })).named("missingResident"),
      where(householdExists(household), no(CanReadHousehold({ requester, household })))
        .then(respond({ error: "ACCESS_DENIED" })).named("notMember"),
      where(resident, CanReadHousehold({ requester, household }), no(allowed))
        .then(respond({ error: "ACCESS_DENIED" })).named("accessDenied"),
      where(allowed, no(exists)).then(respond({ error: "NOT_FOUND" })).named("missingCategory"),
      where(allowed, exists).then(HouseholdManaging.setPreference({ household, person, category, preferenceLevel }).responds({ preference }))
        .then(respond({ preference })).named("edited"),
    );
});

const MyHouseholds = signedIn("mine", [], ({ session, requester }) =>
  receive({ session }).then(Sessioning.use({ session }).responds({ subject: requester }))
    .then(respond({
      households: PersonHouseholds({ person: requester }),
    })),
);

const GetHousehold = signedIn("get", ["household"], ({ session, requester, household }) => {
  const allowed = CanReadHousehold({ requester, household });
  return receive({ session, household }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed).then(respond({ household: HouseholdDetails({ household }) })).named("details"),
  );
});

const GetResidents = signedIn("residents", ["household"], ({ session, requester, household }) => {
  const allowed = CanReadHousehold({ requester, household });
  return receive({ session, household }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed).then(respond({
      residents: HouseholdResidents({ household }),
    })).named("residents"),
  );
});

const GetCategories = signedIn("categories", ["household"], ({ session, requester, household }) => {
  const allowed = CanReadHousehold({ requester, household });
  return receive({ session, household }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed).then(respond({
      categories: HouseholdCategories({ household }),
    })).named("categories"),
  );
});

const GetPreferences = signedIn("preferences", ["household", "person"], ({
  session, requester, household, person,
}) => {
  const allowed = CanReadPreferences({ requester, household, person });
  const resident = residentExists(household, person);
  return receive({ session, household, person }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, no(resident)).then(respond({ error: "NOT_FOUND" })).named("missingResident"),
    where(allowed, resident).then(respond({
      preferences: ResidentPreferences({ household, person }),
    })).named("preferences"),
  );
});

const RemoveHousehold = signedIn("remove", ["household"], ({ session, requester, household }) => {
  const allowed = CanManageHousehold({ requester, household });
  const chores = ChoreCataloguing._chores({ group: household, sortByDifficulty: false }).is({});
  const tasks = TaskScheduling._tasks({ group: household }).is({});
  const availability = TaskScheduling._hasAvailability({ group: household }).is({ available: true });
  return receive({ session, household }).then(Sessioning.use({ session }).responds({ subject: requester })).then(
    missingHousehold(household),
    accessDenied(household, allowed),
    where(allowed, chores).then(respond({ error: "HOUSEHOLD_IN_USE" })).named("hasChores"),
    where(allowed, no(chores), tasks).then(respond({ error: "HOUSEHOLD_IN_USE" })).named("hasTasks"),
    where(allowed, no(chores), no(tasks), availability).then(respond({ error: "HOUSEHOLD_IN_USE" })).named("hasAvailability"),
    where(allowed, no(chores), no(tasks), no(availability))
      .then(HouseholdManaging.remove({ household }).responds({ household }))
      .then(respond({ household })).named("removed"),
  );
});

export const householdHttpErrors = {
  UNAUTHENTICATED: "UNAUTHORIZED",
  ACCESS_DENIED: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  HOUSEHOLD_NOT_FOUND: "NOT_FOUND",
  HOUSEHOLD_RESIDENT_NOT_FOUND: "NOT_FOUND",
  CATEGORY_NOT_FOUND: "NOT_FOUND",
  HOUSEHOLD_NAME_INVALID: "INVALID_REQUEST",
  HOUSEHOLD_RESIDENT_CONFLICT: "CONFLICT",
  HOUSEHOLD_OVERSEER_CONFLICT: "CONFLICT",
  CATEGORY_NAME_INVALID: "INVALID_REQUEST",
  CATEGORY_NAME_CONFLICT: "CONFLICT",
  PREFERENCE_LEVEL_INVALID: "INVALID_REQUEST",
  CATEGORY_IN_USE: "CONFLICT",
  HOUSEHOLD_IN_USE: "CONFLICT",
} as const;

export const composition = {
  CanManageHousehold, CanReadHousehold, CanRemoveResident, CanEditPreference, CanReadPreferences, HouseholdDetails,
  PersonHouseholds, HouseholdResidents, HouseholdCategories, ResidentPreferences,
  CreateHousehold, AddResident, RemoveResident, RenameHousehold, SetOverseer, AddCategory, RenameCategory,
  RemoveCategory, SetPreference, MyHouseholds, GetHousehold, GetResidents, GetCategories, GetPreferences, RemoveHousehold,
};
