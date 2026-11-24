import { inject, type InjectionKey, type Ref } from "vue";
import type { ShiftHappensWireHttp } from "../../generated/wire.ts";
import { useSession } from "./session.ts";

export type Home = ShiftHappensWireHttp["/households/mine"]["output"]["households"][number];
export type ScheduleRow = ShiftHappensWireHttp["/assignments/schedule"]["output"]["tasks"][number];
export type AssignmentRow = ShiftHappensWireHttp["/assignments/list"]["output"]["assignments"][number];
export interface Catalog {
  people: { person: string; username: string }[];
  chores: { chore: string; name: string; description: string; difficulty: number; references: string[] }[];
  choreOrder: string[];
  ranking: { person: string; score: number; rank: number }[];
}

interface HouseholdContext {
  home: Home;
  person: string;
  catalog: Ref<Catalog>;
  refresh(): Promise<void>;
}
export const householdKey: InjectionKey<HouseholdContext> = Symbol("household");
export function useHousehold() {
  const context = inject(householdKey);
  if (!context) throw new Error("Select a household first.");
  return context;
}

const messages: Record<string, string> = {
  UNAUTHORIZED: "Sign in again to continue.", FORBIDDEN: "You do not have permission for this action.",
  NOT_FOUND: "This item is no longer available.", USERNAME_NOT_FOUND: "No account has that username.",
  CHORE_ORDER_INVALID: "Place each chore in the ranking once.",
  CHORE_NAME_CONFLICT: "A chore with that name already exists.", HOUSEHOLD_RESIDENT_CONFLICT: "This resident is already a member.",
  INVALID_REQUEST: "Check your entries and try again.", CONFLICT: "The request conflicts with the current household or schedule.",
  UNSUPPORTED_MEDIA_TYPE: "Choose a JPG, PNG, or WebP image.", PHOTO_TOO_LARGE: "Choose a photo up to 10 MB.",
  INVALID_PHOTO: "This file could not be read as an image.",
};
function refuse(code: string): never {
  if (code === "UNAUTHORIZED") useSession().sessionEnded();
  throw new Error(messages[code] ?? "The request failed. Please try again.");
}

export function checked<T extends object>(result: T): Exclude<T, { error: string }> {
  if ("error" in result) refuse(String(result.error));
  return result as Exclude<T, { error: string }>;
}
async function request<T>(path: string, body: BodyInit, type: string): Promise<T> {
  const res = await fetch("/api/" + path, { method: "POST", credentials: "same-origin", body, headers: { "Content-Type": type } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) refuse(data?.error ?? (res.status === 413 ? "PHOTO_TOO_LARGE" : "INTERNAL_ERROR"));
  return data;
}
export const post = <T>(path: string, input: object) => request<T>(path, JSON.stringify(input), "application/json");
export async function upload(file: File) {
  if (file.size > 10 * 1024 * 1024) refuse("PHOTO_TOO_LARGE");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) refuse("UNSUPPORTED_MEDIA_TYPE");
  return (await request<{ photo: string }>("photos", file, file.type)).photo;
}
export const baselineUrl = (chore: string, photo: string) => `/api/catalog/${encodeURIComponent(chore)}/references/${encodeURIComponent(photo)}`;
export const evidenceUrl = (id: string, image: "photo" | "baseline" = "photo") => `/api/completion/submissions/${encodeURIComponent(id)}/${image}`;
export function localDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function weekWindow(day: string) {
  const from = new Date(day + "T00:00");
  const until = new Date(from);
  until.setDate(until.getDate() + 7);
  return { from: from.toISOString(), until: until.toISOString() };
}
