# ChoreCataloguing

## Purpose 
Let people record and maintain a shared catalog chores, keeping track of chore details, chore requirements, reference photos for completion, and relative difficulty.

*Prevents*: people are unsure of what chores need to be done; work is distributed unfairly because of overlooked relative chore difficulty; people need to repeatedly describe chores each time they are assigned. 

## Principle 
Alice, Bob, and Charlie share an apartment where Charlie manages chore assignment. Charlie adds "Wash dishes" to the catalog with under category "Kitchen" with a difficulty weight of 2.0 and "Clean bathroom" under category "Bathroom" with a difficult weight of 4.0.  

As the overseer, Charlie can update chore details and their difficulties based on feedback over time. Charlie also updates the requirements list and a set of reference photos for completion of each chore. Alice and Bob can see these specifications every time they go to do the chores so they don't need to keep asking Charlie again. 

## Types 
```types
external Group
  The context where chores are catalogued, such as a household.

external Category
  The secondary context within the group where chores are catalogued.

external Photo
  A reference to a photo.

opaque ChoreSet
  A list of chore identities.

opaque RequirementSet
  A set of requirement strings.

opaque PhotoSet
  A set of photo references.
```

## State 
```state
a set of Chores with 
  a name String 
  a group Group
  an optional category Category
  an optional archived Flag
  a difficulty Number 
  a description String
  a requirements set of String
  a references set of Photo
  Rule: active chores have a unique name within their group

Rule: when supplied, the composition checks that a chore's category belongs to the same group as the chore
Rule: a chore's name contains at least one non-whitespace character
Rule: chore names are compared exactly, including case and surrounding whitespace
Rule: difficulty weights are finite numbers bounded in the range [1.0, 10.0]
```

## Actions 
```actions
create(group: Group, name: String, description: String, category?: Category, difficulty: Number, requirements: RequirementSet, references: PhotoSet ): returns (chore: Chore)
  where an active chore with the same name for the group already exists
  then 
    refuses CHORE_NAME_CONFLICT "Chore with the same name already exists."
  where chore name is invalid according to rules
  then
    refuses CHORE_NAME_INVALID "Chore name is invalid."
  where difficulty is invalid according to the rules
  then
    refuses CHORE_DIFFICULTY_INVALID "Chore difficulty must be in the range [1, 10]."
  where name and difficulty are valid and name is unused in group
  then
    add a new chore with name, description, group, category, difficulty, requirements, and photo references
    returns chore

updateDifficulty(chore: Chore, group: Group, difficulty: Number): returns (chore: Chore)
  where chore doesn't exist in the group catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where difficulty is invalid according to the rules
  then
    refuses CHORE_DIFFICULTY_INVALID "Chore difficulty must be in the range [1, 10]."
  where chore exists and difficulty is valid
  then
    update chore difficulty to difficulty
    returns chore

updateDetails(chore: Chore, group: Group, newCategory: Category, newName: String, newDescription: String): returns (chore: Chore)
  where chore doesn't exist in the group catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where newName is invalid according to the rules
  then
    refuses CHORE_NAME_INVALID "Chore name is invalid."
  where another chore in group has newName
  then
    refuses CHORE_NAME_CONFLICT "Chore with the same name already exists."
  where chore exists, newName is valid, and no other chore in group has newName
  then
    update chore name, description, and category
    returns chore

updateRequirements(chore: Chore, group: Group, requirements: RequirementSet ): returns (chore: Chore)
  where chore doesn't exist in the group catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then 
    updates chore with new set of requirements
    returns chore

updateReferencePhotos(chore: Chore, group: Group, references: PhotoSet ): returns (chore: Chore)
  where chore doesn't exist in the group catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then 
    updates chore with new set of photo references 
    returns chore

remove(chore: Chore, group: Group): returns (chore: Chore, group: Group)
  where chore doesn't exist in the group catalog
  then
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then
    remove that chore
    returns chore, group
archive(chore: Chore, group: Group): returns (chore: Chore, group: Group)
  where the chore does not exist in the group
  then
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where the chore exists in the group
  then
    mark the chore archived and keep its details for existing tasks
    exclude the chore from the active catalog and free its name for use in the group
    returns chore, group
```

## Queries 
```queries
_get(chore: Chore) : optional (group: Group, name: String, category?: Category, difficulty: Number, description: String, requirements: RequirementSet, references: PhotoSet)
  Returns the details of the chore if it exists, or no rows if it does not.

_active(chore: Chore) : optional (group: Group, name: String, category?: Category, difficulty: Number, description: String, requirements: RequirementSet, references: PhotoSet)
  Returns the chore only while it is in the active catalog.

_catalogItems(group: Group) : one (items: ChoreSet)
  Returns the IDs currently in the active catalog.

_chores(group: Group, sortByDifficulty: Flag) : many (chore: Chore, name: String, description: String, category?: Category, difficulty: Number, requirements: RequirementSet, references: PhotoSet)
  Returns all the chores associated with a given group, in alphabetical order by name when sortByDifficulty is false, or by ascending difficulty then name when it is true. Breaks remaining ties by chore identity and returns no rows when none match.

_choresByCategory(group: Group, category: Category, sortByDifficulty: Flag) : many (chore: Chore, name: String, description: String, difficulty: Number, requirements: RequirementSet, references: PhotoSet)
  Returns the chores associated with a group and category, in alphabetical order by name when sortByDifficulty is false, or by ascending difficulty then name when it is true. Breaks remaining ties by chore identity and returns no rows when none match.
```
