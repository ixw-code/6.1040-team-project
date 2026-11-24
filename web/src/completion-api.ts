import { useSession } from "./session.ts";

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
    throw new Error(refusal.error ?? "Request failed (" + response.status + ")");
  }
  return response.json();
}

export function submissionImage(submission: string) {
  return "/api/completion/submissions/" + encodeURIComponent(submission) + "/photo";
}
