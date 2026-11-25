import { useSession } from "./session.ts";

export class CompletionRequestError extends Error {
  constructor(readonly status: number, code: string) {
    super(code);
  }
}

export async function completionRequest<T>(path: string, body: object | File): Promise<T> {
  const file = body instanceof File;
  const response = await fetch("/api" + path, {
    method: "POST",
    headers: { "Content-Type": file ? body.type : "application/json" },
    body: file ? body : JSON.stringify(body),
  });
  if (response.status === 401) useSession().sessionEnded();
  if (!response.ok) {
    const refusal = await response.json().catch(() => ({}));
    throw new CompletionRequestError(response.status, refusal.error ?? "Request failed (" + response.status + ")");
  }
  return response.json();
}

export function submissionImage(submission: string) {
  return "/api/completion/submissions/" + encodeURIComponent(submission) + "/photo";
}

export function submissionBaselineImage(submission: string) {
  return "/api/completion/submissions/" + encodeURIComponent(submission) + "/baseline";
}

export function taskBaselineImage(task: string) {
  return "/api/completion/tasks/" + encodeURIComponent(task) + "/baseline";
}
