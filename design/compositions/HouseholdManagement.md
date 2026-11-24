# Household Management

Household Management allows people to establish and manage households, including their residents, overseer, work categories, and resident preferences.

HouseholdManaging stores households, residencies, categories, and preferences. ChoreCataloguing associates reusable chores with households and categories, while TaskScheduling associates tasks and resident availability with households.

## Creating households

A signed-in person can create a household and automatically become its overseer and first resident. The [CreateHousehold endpoint](reaction:HouseholdManagement.CreateHousehold) invokes `HouseholdManaging.create` with the household name and requesting person. Each endpoint resolves the requester through `Sessioning.use` using the existing session cookie. The session subject is a `Registering.User`, which is also the binding for `HouseholdManaging.Person`.

Requests are refused with `HOUSEHOLD_NAME_INVALID` for invalid names, or `UNAUTHENTICATED` if the requester is not signed in. The shared session action signals this as `NOT_SIGNED_IN`, which the HTTP policy exposes as `UNAUTHORIZED`.

```endpoints
HouseholdManagement.CreateHousehold at /households/create
```

## Managing residents

The overseer can add residents to their household. The [CanManageHousehold view](view:HouseholdManagement.CanManageHousehold) verifies their authorization. The [AddResident endpoint](reaction:HouseholdManagement.AddResident) checks that the supplied person identifies a registered user, then invokes `HouseholdManaging.addResident`, which initializes the new resident's preferences to `NEUTRAL` for all existing categories.

Residents can leave voluntarily, while the overseer can remove other residents. The [CanRemoveResident view](view:HouseholdManagement.CanRemoveResident) checks that the requester is the resident being removed or the household overseer. The [RemoveResident endpoint](reaction:HouseholdManagement.RemoveResident) invokes `HouseholdManaging.removeResident`.

Successful removal returns the residency, household, and person. ChoreAssignments will use these results in its `ResidentRemoved` reaction, which invokes `TaskScheduling.removePerson` to clear the departing resident's availability and incomplete assignments. Completed task history is preserved. The overseer must transfer oversight before leaving.

Requests are refused with `NOT_FOUND` for nonexistent households or residents, `HOUSEHOLD_RESIDENT_CONFLICT` for duplicate residency, or `HOUSEHOLD_OVERSEER_CONFLICT` when removing the overseer. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
HouseholdManagement.AddResident at /households/residents/add
HouseholdManagement.RemoveResident at /households/residents/remove
```

## Managing household details and oversight

The overseer can rename their household or transfer oversight to another resident. The [CanManageHousehold view](view:HouseholdManagement.CanManageHousehold) verifies their permission.

The [RenameHousehold endpoint](reaction:HouseholdManagement.RenameHousehold) invokes `HouseholdManaging.rename`, while the [SetOverseer endpoint](reaction:HouseholdManagement.SetOverseer) invokes `HouseholdManaging.setOverseer`. Transferring oversight does not change household membership or existing task assignments.

Requests are refused with `NOT_FOUND` for nonexistent households or residents, or `HOUSEHOLD_NAME_INVALID` for invalid names. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
HouseholdManagement.RenameHousehold at /households/rename
HouseholdManagement.SetOverseer at /households/overseer
```

## Managing categories

The overseer can create, rename, or remove categories for organizing the household's chores. The [CanManageHousehold view](view:HouseholdManagement.CanManageHousehold) verifies their permission.

The [AddCategory endpoint](reaction:HouseholdManagement.AddCategory) invokes `HouseholdManaging.addCategory`, which initializes a `NEUTRAL` preference for every existing resident. The [RenameCategory endpoint](reaction:HouseholdManagement.RenameCategory) invokes `HouseholdManaging.renameCategory`. Category names must be unique within the household.

The [RemoveCategory endpoint](reaction:HouseholdManagement.RemoveCategory) checks whether the category is referenced by existing chores in `ChoreCataloguing` or tasks in `TaskScheduling` before invoking `HouseholdManaging.removeCategory`. Removing a category also removes its resident preferences.

Requests are refused with `NOT_FOUND` for nonexistent households or categories, `CATEGORY_NAME_INVALID` for invalid names, or `CATEGORY_NAME_CONFLICT` for duplicate names. Category removal is additionally refused with `CATEGORY_IN_USE` if dependent chores or tasks exist. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
HouseholdManagement.AddCategory at /households/categories/add
HouseholdManagement.RenameCategory at /households/categories/rename
HouseholdManagement.RemoveCategory at /households/categories/remove
```

## Setting preferences

Residents can set their preferences for categories of work in their household, choosing `PREFER`, `NEUTRAL`, or `AVOID`. Preferences are initialized to `NEUTRAL` when a residency or category is created.

The [CanEditPreference view](view:HouseholdManagement.CanEditPreference) verifies that the requester is the resident whose preference is being changed. The [SetPreference endpoint](reaction:HouseholdManagement.SetPreference) invokes `HouseholdManaging.setPreference` with the household, resident, category, and selected preference level.

Requests are refused with `NOT_FOUND` for nonexistent residents or categories, or `PREFERENCE_LEVEL_INVALID` for an invalid preference level. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
HouseholdManagement.SetPreference at /households/preferences/set
```

## Reading household information

Signed-in people can retrieve the households they belong to through the [MyHouseholds endpoint](reaction:HouseholdManagement.MyHouseholds), which uses the [PersonHouseholds former](former:HouseholdManagement.PersonHouseholds) to collect rows from `HouseholdManaging._householdsByPerson`.

Residents can view their household's details, residents, and categories. The [CanReadHousehold view](view:HouseholdManagement.CanReadHousehold) verifies household membership.

The [GetHousehold endpoint](reaction:HouseholdManagement.GetHousehold) uses the [HouseholdDetails former](former:HouseholdManagement.HouseholdDetails) to combine `HouseholdManaging._household`, `_residents`, and `_categories`.

The [GetResidents endpoint](reaction:HouseholdManagement.GetResidents) and [GetCategories endpoint](reaction:HouseholdManagement.GetCategories) use the [HouseholdResidents former](former:HouseholdManagement.HouseholdResidents) and [HouseholdCategories former](former:HouseholdManagement.HouseholdCategories) to retrieve their corresponding lists from HouseholdManaging.

Residents can retrieve their own category preferences, while the overseer can retrieve any resident's preferences. The [CanReadPreferences view](view:HouseholdManagement.CanReadPreferences) verifies these permissions. The [GetPreferences endpoint](reaction:HouseholdManagement.GetPreferences) uses the [ResidentPreferences former](former:HouseholdManagement.ResidentPreferences) to collect rows from `HouseholdManaging._preferences`.

Requests are refused with `NOT_FOUND` when the household or requested resident does not exist, `ACCESS_DENIED` when the requester lacks permission to access the information, or `UNAUTHENTICATED` when the requester is not signed in.

```endpoints
HouseholdManagement.MyHouseholds at /households/mine
HouseholdManagement.GetHousehold at /households/get
HouseholdManagement.GetResidents at /households/residents
HouseholdManagement.GetCategories at /households/categories
HouseholdManagement.GetPreferences at /households/preferences
```

## Removing households

The overseer can permanently remove a household. The [CanManageHousehold view](view:HouseholdManagement.CanManageHousehold) verifies their permission.

The [RemoveHousehold endpoint](reaction:HouseholdManagement.RemoveHousehold) checks that no chores, tasks, or availability remain associated with the household, including availability recorded for people no longer resident before invoking `HouseholdManaging.remove`. Removing the household also removes its residencies, categories, and preferences.

Requests are refused with `NOT_FOUND` if the household does not exist. Removal is additionally refused with `HOUSEHOLD_IN_USE` if dependent chores, tasks, or availability remain. Unauthorized requests return `ACCESS_DENIED`; unauthenticated requests return `UNAUTHENTICATED`.

```endpoints
HouseholdManagement.RemoveHousehold at /households/remove
```

## Notes

### Assumptions

ChoreAssignments obtains household residents and preferences through HouseholdManaging for automatic scheduling, and uses household membership and oversight to authorize schedule management. HouseholdManagement exposes the corresponding resident, category, and preference information for the application interface.

Resident removal triggers scheduling cleanup through ChoreAssignments.

Alpha supports household creation, membership management, oversight, categories, preferences, household information retrieval, and restricted deletion.

### Extensions

Beta may introduce a `Roling` concept or expand the `HouseholdManaging` concept for multiple administrators and more granular permissions.

A future invitation workflow could require residents to accept household membership instead of allowing the overseer to add them directly.

Household deletion may eventually support cascading deletion or archival of dependent chores, tasks, and historical records.
