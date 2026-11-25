// Labels, colors and date formatting shared by the resident screens.
import type { AttemptStatus, Person, TaskStatus } from "./types.ts";

const PALETTE = ["#b0d898", "#efbcd5", "#f6c79a", "#d3bdee", "#9ccfe8", "#e8d68a"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  submitted: "Submitted",
  approved: "Approved",
  redo: "Redo",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--rs-todo)",
  submitted: "var(--rs-submitted)",
  approved: "var(--rs-approved)",
  redo: "var(--rs-redo)",
};

export const ATTEMPT_LABEL: Record<AttemptStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Not approved",
};

export const ATTEMPT_COLOR: Record<AttemptStatus, string> = {
  pending: "var(--rs-submitted)",
  approved: "var(--rs-approved)",
  rejected: "var(--rs-redo)",
};

export const ATTEMPT_BORDER: Record<AttemptStatus, string> = {
  pending: "#d8c25a",
  approved: "#85b562",
  rejected: "#d27a70",
};

/** Someone else's task never shows Todo vs Redo, only whether it's done. */
export function otherStatusLabel(status: TaskStatus): string {
  if (status === "approved") return "Approved";
  if (status === "submitted") return "Submitted";
  return "Not done";
}

export const isOpen = (status: TaskStatus) => status === "todo" || status === "redo";

/** Post-it color: mine by status; others by person, grayed out once submitted or approved. */
export function noteColor(status: TaskStatus, owner: Person | undefined): string {
  if (!owner || owner.isMe) return STATUS_COLOR[status];
  return isOpen(status) ? owner.color : "var(--rs-other-done)";
}

// Stable color per person, so the same resident keeps the same color across screens.
export function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export function statusText(status: TaskStatus, owner: Person | undefined): string {
  return !owner || owner.isMe ? STATUS_LABEL[status] : otherStatusLabel(status);
}

const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });

/** "Nov 28, 11:59 PM" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
/** "Nov 28" */
export const formatDate = (iso: string | Date) => shortDate.format(new Date(iso));

export const isOverdue = (task: { due: string; status: TaskStatus }) =>
  isOpen(task.status) && new Date(task.due).getTime() < Date.now();

/** "8a", "12p" for the time grid. */
export function hourLabel(hour: number): string {
  const h = hour % 24;
  return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
}

/** "2p–7p" */
export function timeRange(startIso: string, endIso: string): string {
  const short = (d: Date) => {
    const h = d.getHours(), m = d.getMinutes();
    return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "a" : "p"}`;
  };
  return `${short(new Date(startIso))}–${short(new Date(endIso))}`;
}

/** Column heading for a day: Today, Tomorrow, then weekday names. */
export function dayHeading(day: Date): { label: string; sub: string } {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(day).getTime() - today.getTime()) / 86_400_000);
  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : weekday.format(day);
  return { label, sub: diff <= 1 ? `${weekday.format(day)} ${day.getDate()}` : formatDate(day) };
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A stable small tilt per note so the board looks hand-pinned. */
export function tilt(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `${((Math.abs(h) % 7) - 3) * 0.6}deg`;
}
