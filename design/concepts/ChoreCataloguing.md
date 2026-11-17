# ChoreCataloguing

## Purpose 
Let people record and maintain a shared catalog chores, keeping track of chore type, relative difficulty, and relative preference. 

*Prevents*: people are unsure of what chores need to be done; work is distributed unfairly because of overlooked chore difficulty and personal preferences; people need to repeatedly describe chores each time they are assigned. 

## Principle 
Alice, Bob, and Charlie share an apartment where Charlie manages chore assignment. Charlie adds "Wash dishes" to the catalog with a difficulty weight of 2.0 and "Clean bathroom" with a difficult weight of 4.0.  

Alice marks that she prefers to wash dishes but doesn't like cleaning the bathroom, while Bob marks the opposite. Both can update their preferences later, and Charlie can update the overall difficulties over time. 

## Types 
```types
external Person 

external Household

enum ChoreType is REGULAR or RECURRING
```

## State 
```state
a set of Chores with 
  a name String 
  a household Household
  a type ChoreType
  a difficulty Number 
  unique name and household

a set of Preferences with 
  a chore Chore
  a person Person 
  a weight Number

Rule: Difficulty and preference weights are floats bounded in the range [0.0, 10.0] 
```

## Actions 
```actions
create(name: String, household: Household, type: ChoreType, difficulty: Number): returns (chore: Chore)
  where chore with name for household already exists 
  then 
    refuses CHORE_NAME_CONFLICT "Chore with the same name already exists."
  where chore with name for household doesn't already exist 
  then 
    add a new chore with name, household, type, and difficulty
    returns chore

updateDifficulty(chore: Chore, household: Household, difficulty: number): returns (chore: Chore)
  where chore doesn't exist in the household catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then
    update chore difficulty to difficulty
    returns chore

updateName(chore: Chore, household: Household, newName: String, optiona): returns (chore: Chore)
  where chore doesn't exist in the household catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then
    update chore name to newName
    returns chore

updateType(chore: Chore, household: Household, newType: ChoreType): returns (chore: Chore)
  where chore doesn't exist in the household catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then
    update chore type to newType
    returns chore

setPreference(chore: Chore, person: Person, weight: Number): returns (preference: Preference)
  where chore doesn't exist in the household catalog
  then 
    refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists in the catalog
  then 
    create a new preference or update existing preference with chore, person, and weight 
    returns preference

remove(chore: Chore, household: Household): returns (chore: Chore, household: Household)
  where chore doesn't exist in the household catalog
      refuses CHORE_DOESNT_EXIST "This chore doesn't exist in the catalog."
  where chore exists 
  then
    remove that chore
    remove all preferences related to that achore
    returns chore, household
```

## Queries 
```queries
_chores(household: Household) : many (name: String, type: ChoreType, difficulty: Number)
  Returns all the chores associated with a given household. 

_personPreferences(person: Person) : many (chore: Chore, weight: Number)
  Returns all the preference weights for chores that a given person has indicated.

_chorePreferences(chore: Chore) : many (person: Person, weight: Number)
  Returns all the people and their indicated preference weights associated with a chore
```
