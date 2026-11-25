import { submissionWindowState } from "../shared/assignmentDates.ts";

export function evidenceInstructions({
  requirements, references,
}: { requirements: string[]; references: string[] }) {
  return { criteria: requirements.join("\n"), baseline: references[0] || undefined };
}

export function evidenceWindow({
  interval, submittedAt,
}: { interval: { start: Date; end: Date }; submittedAt: Date }) {
  return { state: submissionWindowState(interval, submittedAt.getTime()) };
}
