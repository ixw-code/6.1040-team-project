export type Sample = "sink-submitted" | "sink-baseline" | "counter-submitted" | "counter-baseline";
export type Photo = { sample: Sample; alt: string } | { url: string; alt: string };
export type Decision = "approved" | "rejected";
export type ReviewStatus = "pending" | Decision;

export type Chore = {
  id: string;
  title: string;
  resident: string;
  initials: string;
  criteria: string;
  photoInstructions: string;
  baseline: Photo;
};

export type Attempt = {
  id: string;
  taskId: string;
  photo: Photo;
  submittedAt: Date;
  review?: { decision: Decision; feedback: string; reviewedAt: Date };
};

export const residentChore: Chore = {
  id: "kitchen-sink",
  title: "Clear the kitchen sink",
  resident: "Alice Chen",
  initials: "AC",
  criteria: "The sink and drying rack are empty and free of dishes.",
  photoInstructions: "Fit the entire sink and drying rack in one well-lit photo.",
  baseline: { sample: "sink-baseline", alt: "Empty kitchen sink and drying rack" },
};

export const chores = [residentChore, {
  id: "kitchen-counter",
  title: "Wipe the kitchen counter",
  resident: "Sam Rivera",
  initials: "SR",
  criteria: "The counter is wiped dry and free of crumbs and spills.",
  photoInstructions: "Include the counter beside the sink in the photo.",
  baseline: { sample: "counter-baseline", alt: "Clean kitchen counter beside the sink" },
}] satisfies Chore[];

export const choresById = Object.fromEntries(chores.map((chore) => [chore.id, chore]));

export function createPreviewAttempts(): Attempt[] {
  return [
    {
      id: "sink-first-attempt",
      taskId: residentChore.id,
      photo: { sample: "sink-submitted", alt: "Kitchen sink with a mug and plate in the basin" },
      submittedAt: new Date(2026, 10, 22, 9, 14),
    },
    {
      id: "counter-first-attempt",
      taskId: "kitchen-counter",
      photo: { sample: "counter-submitted", alt: "Kitchen counter with crumbs by the sink" },
      submittedAt: new Date(2026, 10, 22, 9, 42),
    },
  ];
}

export function statusOf(attempt: Attempt | undefined): ReviewStatus | "unsubmitted" {
  if (!attempt) return "unsubmitted";
  return attempt.review?.decision ?? "pending";
}

export function reviewAttempt(attempt: Attempt, decision: Decision, note: string) {
  if (attempt.review) return "already-reviewed";
  const feedback = note.trim();
  if (decision === "rejected" && !feedback) return "missing-feedback";
  attempt.review = { decision, feedback, reviewedAt: new Date() };
  return "saved";
}

export function submitPhoto(attempts: Attempt[], taskId: string, photo: Photo) {
  const latest = attempts.findLast((attempt) => attempt.taskId === taskId);
  if (latest && statusOf(latest) !== "rejected") return false;
  attempts.push({ id: crypto.randomUUID(), taskId, photo, submittedAt: new Date() });
  return true;
}
