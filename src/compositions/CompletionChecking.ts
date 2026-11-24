import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";

const { Sessioning, TaskScheduling, HouseholdManaging, ChoreCataloguing, PhotoChecking } = concepts;

const CanSubmit = view("(person) can submit (photo) for (task)", ({ person, photo, task }, { group, item }) =>
  where(
    TaskScheduling._completionContext({ task }).is({ group, item, assignee: person, completion: "INCOMPLETE" }),
    HouseholdManaging._residents({ household: group }).is({ person }),
    PhotoChecking._ownedUpload({ photo, person }).is({}),
  ),
).optional();

const Submit = endpoint("/completion/submit", ({
  session, task, photo, person, group, item, requirements, references, criteria, baseline, submission,
}) => {
  const permitted = CanSubmit({ person, photo, task });
  return receive({ session, task, photo }).then(Sessioning.use({ session }).responds({ subject: person })).then(
    where(no(permitted.is({}))).then(respond({ error: "NOT_FOUND" })).named("missing"),
    where(
      permitted.is({ group, item }),
      whether(ChoreCataloguing._get({ chore: item }).is({ group, requirements, references })),
      compute(computations.evidenceInstructions, { requirements, references }, { criteria, baseline }),
    ).then(PhotoChecking.submit({ subject: task, person, photo, criteria, baseline, method: "MANUAL" }).responds({ submission }))
      .then(respond({ submission })).named("submitted"),
  );
}, {
  validators: {
    input: (input) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { ok: false, detail: "invalid completion submission" };
      }
      const { task, photo, session, ...extra } = input as Record<string, unknown>;
      const nonblank = (value: unknown) => typeof value === "string" && value.length <= 256 && value.trim() !== "";
      return Object.keys(extra).length === 0 && nonblank(task) && nonblank(photo)
        && (session === null || typeof session === "string")
        ? { ok: true } : { ok: false, detail: "invalid completion submission" };
    },
  },
});

export const composition = { CanSubmit, Submit };
