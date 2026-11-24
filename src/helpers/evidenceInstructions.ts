export function evidenceInstructions({
  requirements, references,
}: { requirements?: string[]; references?: string[] }) {
  return { criteria: requirements?.join("\n") ?? "", baseline: references?.[0] ?? "" };
}
