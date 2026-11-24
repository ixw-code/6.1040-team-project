import { api } from "../api.ts";
import { baselineUrl, checked, evidenceUrl, post, upload, useHousehold, type ScheduleRow } from "../household.ts";
import type { Attempt, AvailabilityBlock, Person, Task } from "./types.ts";

type AttemptRow = {
  submission: string; status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string; feedback: string; reviewedAt?: string;
};
const colors = ["#b9d7f2", "#f5e79a", "#c8e3a8", "#f2bdb3", "#d3c4ec"];
const statuses = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" } as const;

export function useResidentApi() {
  const { home, person, catalog } = useHousehold();
  const household = home.household;
  function getPeople(): Person[] {
    return catalog.value.people.map((p, i) => ({
      id: p.person, name: p.username, isMe: p.person === person, color: colors[i % colors.length]!,
    }));
  }
  async function mapTask(row: ScheduleRow): Promise<Task> {
    let attempts: Attempt[] = [];
    if (row.assignee === person || row.completedBy === person) {
      const result = await post<{ completion: { history: AttemptRow[] } }>("completion/get", { task: row.task });
      attempts = result.completion.history.map(a => ({
        id: a.submission, status: statuses[a.status], submittedAt: a.submittedAt,
        photoUrl: evidenceUrl(a.submission), comment: a.feedback, reviewedAt: a.reviewedAt,
      }));
    }
    const latest = attempts[0]?.status;
    return {
      id: row.task, title: row.chore?.name ?? "Chore", ownerId: row.assignee ?? "",
      start: row.interval?.start ?? row.deadline!, due: row.deadline ?? row.interval!.end,
      end: row.interval?.end ?? row.deadline!,
      status: row.completedAt || latest === "approved" ? "approved" : latest === "rejected" ? "redo" : latest === "pending" ? "submitted" : "todo",
      instructions: row.chore?.description ?? "", criteria: row.chore?.requirements?.join("\n") ?? "",
      references: (row.chore?.references ?? []).map(id => baselineUrl(row.item, id)), attempts,
    };
  }
  async function getTask(task: string) {
    const result = await api.assignments.task({ household, task });
    if ("error" in result && result.error === "NOT_FOUND") return null;
    return mapTask(checked(result).task);
  }
  async function getSchedule(from: Date, until: Date) {
    const result = checked(await api.assignments.schedule({ household, from: from.toISOString(), until: until.toISOString() }));
    return Promise.all(result.tasks.map(mapTask));
  }
  async function getMyTasks() {
    const result = checked(await api.assignments.mine({ household, mode: "all", from: "0001-01-01T00:00:00Z", until: "9999-12-31T23:59:59Z" }));
    return Promise.all(result.tasks.map(mapTask));
  }
  async function getAvailability(): Promise<AvailabilityBlock[]> {
    const { availability } = checked(await api.assignments.availability({ household, person }));
    return availability.map(a => ({ id: a.availability, personId: person, start: a.interval.start, end: a.interval.end }));
  }
  async function submitPhoto(task: string, file: File) {
    const photo = await upload(file);
    await post("completion/submit", { task, photo });
  }
  return { getPeople, getTask, getMyTasks, getSchedule, getAvailability, submitPhoto };
}
