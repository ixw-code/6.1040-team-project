// Shapes the resident screens work with. The placeholder API in residentApi.ts returns these;
// when real endpoints land, map their wire output into these shapes there, not in the screens.

/** A task's status from its assignee's side. */
export type TaskStatus = "todo" | "submitted" | "approved" | "redo";

/** A photo attempt's review state. */
export type AttemptStatus = "pending" | "approved" | "rejected";

export interface Person {
  id: string;
  name: string;
  /** Pastel color used for this person's tasks and availability. */
  color: string;
  isMe: boolean;
}

export interface Attempt {
  id: string;
  /** Null until real photo storage exists; screens show a placeholder. */
  photoUrl: string | null;
  submittedAt: string;
  status: AttemptStatus;
  reviewedAt?: string;
  reviewer?: string;
  comment?: string;
}

export interface Task {
  id: string;
  title: string;
  ownerId: string;
  /** Start of the window the task can be done in (ISO). */
  start: string;
  /** Deadline (ISO). */
  due: string;
  status: TaskStatus;
  instructions: string;
  criteria: string;
  /** Overseer's reference photos; null entries render as placeholders. */
  references: (string | null)[];
  attempts: Attempt[];
}

export type TaskDetail = Omit<Task, "start">;

export interface AvailabilityBlock {
  id: string;
  personId: string;
  start: string;
  end: string;
}

export type Repeat = "once" | "daily" | "weekly";

export interface AvailabilityChange {
  date: string; // yyyy-mm-dd
  from: string; // hh:mm
  until: string; // hh:mm
  repeat: Repeat;
}

export interface Preference {
  choreId: string;
  chore: string;
  /** 1–10, or null when the resident hasn't rated it. */
  rating: number | null;
  /** Household average, shown when unrated. */
  average: number;
}

/** Enough of a task to draw it on a swap card. */
export interface TaskSummary {
  id: string;
  title: string;
  due: string;
  status: TaskStatus;
  ownerId: string;
}

export type SwapState = "pending" | "accepted" | "declined" | "cancelled";

export interface SwapRequest {
  id: string;
  fromId: string;
  toId: string;
  /** The task the requester hands over. */
  offered: TaskSummary;
  /** The task the requester wants. */
  wanted: TaskSummary;
  state: SwapState;
  createdAt: string;
  resolvedAt?: string;
}

export interface SwapOverview {
  incoming: SwapRequest[];
  outgoing: SwapRequest[];
  history: SwapRequest[];
}
