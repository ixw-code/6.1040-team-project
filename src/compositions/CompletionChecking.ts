import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, no, now, view, where } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";

const { Sessioning, TaskScheduling, HouseholdManaging, ChoreCataloguing, PhotoChecking } = concepts;

const CanSubmit = view("(person) can submit (photo) for (task)", (
  { person, photo, task }, { interval, requirements, references }, { group, item },
) => where(
    TaskScheduling._completionContext({ task }).is({ group, item, assignee: person, completion: "INCOMPLETE", interval }),
    TaskScheduling._activeTask({ task }).is({ group }),
    HouseholdManaging._residents({ household: group }).is({ person }),
    PhotoChecking._ownedUpload({ photo, person }).is({}),
    ChoreCataloguing._get({ chore: item }).is({ group, requirements, references }),
  ),
).optional();

const Submit = endpoint("/completion/submit", ({
  session, task, photo, person, interval, requirements, references, criteria, baseline, submission, submittedAt,
}) => {
  const permitted = CanSubmit({ person, photo, task });
  return receive({ session, task, photo }).then(Sessioning.use({ session }).responds({ subject: person })).then(
    where(no(permitted.is({}))).then(respond({ error: "NOT_FOUND" })).named("missing"),
    where(
      permitted.is({ interval }),
      now(submittedAt),
      compute(computations.evidenceWindow, { interval, submittedAt }, { state: "upcoming" }),
    ).then(respond({ error: "SUBMISSION_NOT_OPEN" })).named("tooEarly"),
    where(
      permitted.is({ interval }),
      now(submittedAt),
      compute(computations.evidenceWindow, { interval, submittedAt }, { state: "closed" }),
    ).then(respond({ error: "SUBMISSION_CLOSED" })).named("tooLate"),
    where(
      permitted.is({ interval, requirements, references }),
      now(submittedAt),
      compute(computations.evidenceWindow, { interval, submittedAt }, { state: "open" }),
      compute(computations.evidenceInstructions, { requirements, references }, { criteria, baseline }),
    ).then(PhotoChecking.submit({
      subject: task, person, photo, criteria, baseline, method: "MANUAL", submittedAt,
    }).responds({ submission }))
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
