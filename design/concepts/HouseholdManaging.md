# HouseholdManaging

## Purpose
Let people establish and maintain shared households, and manage its residents, overseer, and keep track of household work categories and resident preferences.

*Prevents*: uncertainty about who belongs to a household, who oversees a household, and the categories available for organizing housework. 

## Principle 
Alice creates a household for "Apartment 2B" as its resident overseer. She can add Bob and Charlie as fellow residents, and set categories of work like "Kitchen", "Bathroom", and "Living Room". 

Each resident can identify their preferences for whether they prefer to do a certain category of work, are neutral towards it, or dislike doing it. 

As overseer, Alice can update the household and category details or transfer oversight to another resident. Residents will be removed from the household after leaving, and changes propagate throughout the system.

## Types 
```types
external Person
  A user who can join a household.

PreferenceLevel is PREFER or NEUTRAL or AVOID
  How a person feels about a household work category.

opaque PersonSet
  A set of people.

opaque ResidentRows
  A set of rows, each with person: Person.

opaque SchedulingPreferences
  A set of rows, each with person: Person, category: Category, and preferenceLevel: PreferenceLevel.

opaque ChoreOrder
  A list of chore IDs ordered from most to least preferred.

opaque ChorePreferences
  A set of rows with a person and their chore order.

opaque CategorySet
  A set of categories.
```


## State 
```state
a set of Households with 
  a name String
  an overseer Person
  a categories set of Category

a set of Residencies with
  a household Household
  a person Person
  an optional choreOrder ChoreOrder
  unique household and person

a set of Categories with 
  a name String

a set of Preferences with
  a residency Residency
  a category Category
  a preferenceLevel PreferenceLevel
  unique residency and category

Rule: household and category names contain at least one non-whitespace character
Rule: category names are compared exactly, including case and surrounding whitespace
Rule: a household overseer must also be a resident of that household
Rule: a person can belong to multiple households
Rule: a person can be an overseer for multiple households
Rule: a category belongs to only one household
Rule: categories have unique names within a household
Rule: a preference's category must belong to its residency's household
Rule: every residency has exactly one preference for each category in its household
```

## Actions 
```actions
create(name: String, overseer: Person) : returns (household: Household)
  where name is invalid according to rules
  then
    refuses HOUSEHOLD_NAME_INVALID "Household name cannot be empty."
  where name is valid
  then
    create a new household with name, overseer, and an empty set of categories
    create a residency for the overseer in the household
    returns household

rename(household: Household, name: String) : returns (household: Household)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where name is invalid according to rules
  then
    refuses HOUSEHOLD_NAME_INVALID "Household name is invalid."
  where household exists and name is valid
  then
    update the household's name
    returns household

addResident(household: Household, person: Person) : returns (residency: Residency)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where person is already a resident of household
  then
    refuses HOUSEHOLD_RESIDENT_CONFLICT "This person is already a resident."
  where household exists and person is not a resident
  then
    add a new residency with household and person
    create a neutral preference for the residency and each household category
    returns residency

removeResident(household: Household, person: Person) : returns (residency: Residency, household: Household, person: Person)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where person is not a resident of household
  then
    refuses HOUSEHOLD_RESIDENT_NOT_FOUND "This person does not belong to the household."
  where person is the household's overseer
  then
    refuses HOUSEHOLD_OVERSEER_CONFLICT "Household oversight must be transferred before removal."
  where person is a resident and is not the overseer
  then
    remove the residency and associated preferences
    returns residency, household, person

setOverseer(household: Household, person: Person) : returns (household: Household)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where person is not a resident of household
  then
    refuses HOUSEHOLD_RESIDENT_NOT_FOUND "The overseer must belong to the household."
  where household exists and person is a resident
  then
    update the household's overseer to person
    returns household

addCategory(household: Household, name: String) : returns (category: Category)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where name is invalid according to rules
  then
    refuses CATEGORY_NAME_INVALID "Category name is invalid."
  where a category with name already belongs to household
  then
    refuses CATEGORY_NAME_CONFLICT "A category with this name already exists."
  where household exists, name is nonempty, and name is unused
  then
    create category with name and add category to household's categories
    create a neutral preference for each household residency and the category
    returns category

renameCategory(household: Household, category: Category, name: String) : returns (category: Category)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where category is not in household's categories
  then
    refuses CATEGORY_NOT_FOUND "This category does not belong to the household."
  where name is empty
  then
    refuses CATEGORY_NAME_INVALID "Category name cannot be empty."
  where another category with name already belongs to household
  then
    refuses CATEGORY_NAME_CONFLICT "A category with this name already exists."
  where category belongs to household and name is nonempty and no other category in household has name
  then
    update the category's name
    returns category

removeCategory(household: Household, category: Category) : returns (category: Category)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where category is not in household's categories
  then
    refuses CATEGORY_NOT_FOUND "This category does not belong to the household."
  where category belongs to household
  then
    remove all preferences associated with category
    remove category from household's categories and from set  Categories
    returns category

setPreference(household: Household, person: Person, category: Category, preferenceLevel: PreferenceLevel): returns (preference: Preference)
  where person is not a resident of household
  then
    refuses HOUSEHOLD_RESIDENT_NOT_FOUND "This person is not a resident."
  where category does not belong to household
  then
    refuses CATEGORY_NOT_FOUND "This category does not belong to the household."
  where preferenceLevel is invalid
  then
    refuses PREFERENCE_LEVEL_INVALID "Preference level must be PREFER, NEUTRAL, or AVOID."
  where person is a resident, category belongs to household, and preferenceLevel is valid
  then
    update the residency's preference level for category
    returns preference

setChoreOrder(household: Household, person: Person, order: ChoreOrder): returns (order: ChoreOrder)
  where order repeats a chore
  then
    refuses CHORE_ORDER_INVALID "Rank each chore at most once."
  where the order is valid and household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where the order is valid and person is not a resident of an existing household
  then
    refuses HOUSEHOLD_RESIDENT_NOT_FOUND "This person is not a resident."
  where the order is valid and person is a resident
  then
    replace the residency's chore order
    returns order

remove(household: Household) : returns (household: Household)
  where household does not exist
  then
    refuses HOUSEHOLD_NOT_FOUND "This household does not exist."
  where household exists
  then
    remove all preferences associated with household's residencies
    remove all residencies associated with household
    remove all categories belonging to household from Categories
    remove the household
    returns household
```

## Queries
```queries
_household(household: Household) : optional (name: String, overseer: Person)
  Returns the household details, or no rows if the household does not exist.

_householdsByPerson(person: Person) : many (household: Household, name: String, overseer: Person, categories: CategorySet)
  Returns the households that the person is a resident of, in alphabetical order by name, breaking ties by household identity. Each row lists categories in alphabetical order by name. Returns no rows if the person belongs to no households.

_categories(household: Household) : many (category: Category, name: String)
  Returns the categories of the household, in alphabetical order by name, breaking ties by category identity. Returns no rows if the household is unknown or has no categories.

_residents(household: Household) : many (person: Person)
  Returns the residents belonging to the household in the order they joined, or no rows if the household is unknown.

_choreOrder(household: Household, person: Person) : one (order: ChoreOrder)
  Returns this resident's saved order, or an empty list when they have none.

_schedulingInputs(household: Household) : one (people: ResidentRows, preferences: SchedulingPreferences, chorePreferences: ChorePreferences)
  Returns residents, saved chore rankings, and legacy category preferences from one household snapshot, or empty sets if the household does not exist.

_allResidents(household: Household, people: PersonSet) : one (all: Flag)
  Returns whether each supplied person is a resident of the household. Returns true for an empty set and false for a nonempty set when the household is unknown.

_preferences(household: Household, person: Person) : many (category: Category, preferenceLevel: PreferenceLevel)
  Returns the preference levels for each category for a person in the household, ordered as in _categories. Returns no rows if the household or residency is unknown or there are no categories.
```
