import type { assembleApplication } from "../assembly.ts";
import type { CompletionHooks } from "./CompletionChecking.ts";

type Concepts = ReturnType<typeof assembleApplication>["concepts"];

export function completionHooks({ TaskScheduling, ChoreCataloguing, HouseholdManaging }: Concepts): CompletionHooks {
  return {
    householdTasks: household => TaskScheduling._tasks({ group: household }),
    async task(task) {
      const [entry] = await TaskScheduling._get({ task });
      if (!entry) return;
      const [chore] = await ChoreCataloguing._get({ chore: entry.item });
      if (!chore || chore.group !== entry.group) return;
      return {
        task, household: entry.group, assignee: entry.assignee ?? "", title: chore.name,
        criteria: chore.requirements.join("\n"), photoInstructions: chore.description,
        baseline: chore.references[0], dueAt: entry.deadline ?? entry.interval!.end, interval: entry.interval,
        active: !entry.archived && !entry.completedAt, archived: entry.archived, completed: Boolean(entry.completedAt),
      };
    },
    async role(household, person) {
      const [home] = await HouseholdManaging._household({ household });
      if (!home) return;
      if (home.overseer === person) return "OVERSEER";
      const members = await HouseholdManaging._residents({ household });
      if (members.some(member => member.person === person)) return "RESIDENT";
    },
    async recordCompletion({ task, person, submittedAt }) {
      const result = await TaskScheduling.complete({ task, completedBy: person, completedAt: submittedAt });
      if (!("error" in result)) return;
      // A retry of the same approval must still reach the idempotent ranking credit.
      const [entry] = await TaskScheduling._get({ task });
      if (entry?.completedBy !== person || entry.completedAt?.getTime() !== submittedAt.getTime()) {
        throw new Error("Unable to record task completion.");
      }
    },
  };
}
