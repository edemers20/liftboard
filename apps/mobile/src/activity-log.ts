import * as engine from "@liftboard/engine";
import { create } from "zustand";

import { copy } from "@/copy";

/** A logged session. Activities use k for the activity id; lifts use "lift". */
export type ActSession = {
  t: number;
  k: string;
  min?: number;
  src?: string;
  /** Easy, Moderate or Hard. Spin, yoga and pilates keep their own settings. */
  eff?: string;
};

/** Sports and other activities. Spin, yoga and pilates keep their class effort. */
export function usesSessionEffort(id: string): boolean {
  return id !== "spin" && id !== "yoga" && id !== "pilates";
}

export type StripDay = {
  offset: number;
  date: Date;
  letter: string;
  label: string;
  selected: boolean;
  today: boolean;
  past: boolean;
  lift: boolean;
  /** A lift is queued on this day and not logged yet. */
  planned: boolean;
  activity: boolean;
  usual: boolean;
};

export type WeekStrip = {
  days: StripDay[];
  weekOffset: number;
  canPrevWeek: boolean;
  canNextWeek: boolean;
  canPrevDay: boolean;
  canNextDay: boolean;
};

const DAY_MS = 86400000;
const WEEK_LIMIT_BACK = -8;
const WEEK_LIMIT_FORWARD = 1;

type NoticeState = {
  lines: string[];
  id: number;
  pulse: boolean;
  variant: "plan" | "plain";
  show: (lines: string[], options?: { pulse?: boolean; variant?: "plan" | "plain" }) => void;
  clear: () => void;
};

export const useNotice = create<NoticeState>((set) => ({
  lines: [],
  id: 0,
  pulse: true,
  variant: "plain",
  show: (lines, options) =>
    set((state) => ({
      lines,
      id: state.id + 1,
      pulse: options?.pulse !== false,
      variant: options?.variant ?? "plain",
    })),
  clear: () => set({ lines: [] }),
}));

export function activityName(id: string): string {
  if (id === "zone2") return copy.activities.zone2;
  const names = copy.activityNames;
  if (Object.prototype.hasOwnProperty.call(names, id)) return names[id as keyof typeof names];
  return id;
}

export function startOfDay(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(day: Date, n: number): Date {
  const next = new Date(day);
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday is 0, matching wk.adays. */
export function mondayIndex(day: Date): number {
  return (day.getDay() + 6) % 7;
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
}

export function weekStart(t: number): Date {
  return engine.weekStartOf(t);
}

export function weekOffset(day: Date, today = startOfDay(Date.now())): number {
  return Math.round(daysBetween(weekStart(today.getTime()), weekStart(day.getTime())) / 7);
}

function dayKey(day: Date): string {
  return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
}

function allSessions(): ActSession[] {
  return (engine.wk.sessions || []) as ActSession[];
}

export function sessionsOn(day: Date): ActSession[] {
  const key = startOfDay(day.getTime()).getTime();
  return allSessions().filter((session) => startOfDay(session.t).getTime() === key);
}

export function activitySessionsOn(day: Date): ActSession[] {
  return sessionsOn(day)
    .filter((session) => session.k !== "lift")
    .slice()
    .sort((a, b) => a.t - b.t);
}

export function isUsualActivityDay(day: Date): boolean {
  const days = Array.isArray(engine.wk.adays) ? (engine.wk.adays as number[]) : [];
  return days.includes(mondayIndex(day));
}

function dateLabel(day: Date, lift: boolean, planned: boolean, activity: boolean): string {
  const formatted = day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const mark = lift ? copy.workouts.liftDone : planned ? copy.workouts.liftPlanned : "";
  return `${formatted}${mark}${activity ? copy.workouts.activityMark : ""}`;
}

/** Days the Workouts pager can reach: start of the week 8 back through the end of next week. */
export function dayBounds(now = Date.now()): { min: number; max: number; minWeek: number; maxWeek: number } {
  const today = startOfDay(now);
  const start = weekStart(today.getTime());
  return {
    min: daysBetween(today, addDays(start, WEEK_LIMIT_BACK * 7)),
    max: daysBetween(today, addDays(start, WEEK_LIMIT_FORWARD * 7 + 6)),
    minWeek: WEEK_LIMIT_BACK,
    maxWeek: WEEK_LIMIT_FORWARD,
  };
}

export function weekDays(weekOff: number, selectedOffset: number, now = Date.now()): StripDay[] {
  const today = startOfDay(now);
  const start = addDays(weekStart(today.getTime()), weekOff * 7);
  const plan = (engine.weekModel(weekOff, now).plan || {}) as Record<number, unknown>;
  const days: StripDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const offset = daysBetween(today, date);
    const logged = sessionsOn(date);
    const lift = logged.some((session) => session.k === "lift");
    const planned = !lift && plan[i] != null;
    const activity = logged.some((session) => session.k !== "lift");
    days.push({
      offset,
      date,
      letter: copy.weekdayLetters.charAt(mondayIndex(date)),
      label: dateLabel(date, lift, planned, activity),
      selected: offset === selectedOffset,
      today: offset === 0,
      past: date.getTime() < today.getTime(),
      lift,
      planned,
      activity,
      usual: !activity && offset >= 0 && isUsualActivityDay(date),
    });
  }
  return days;
}

export function stripFor(selectedOffset: number, now = Date.now()): WeekStrip {
  const today = startOfDay(now);
  const selected = addDays(today, selectedOffset);
  const wOff = weekOffset(selected, today);
  const days = weekDays(wOff, selectedOffset, now);
  const index = Math.max(0, days.findIndex((day) => day.selected));
  return {
    days,
    weekOffset: wOff,
    canPrevWeek: wOff > WEEK_LIMIT_BACK,
    canNextWeek: wOff < WEEK_LIMIT_FORWARD,
    canPrevDay: !(wOff <= WEEK_LIMIT_BACK && index === 0),
    canNextDay: !(wOff >= WEEK_LIMIT_FORWARD && index === 6),
  };
}

/** Same weekday in `targetWeek`. Moving onto the current week opens today; staying put keeps the day. */
export function offsetForWeek(fromOffset: number, targetWeek: number, now = Date.now()): number {
  const today = startOfDay(now);
  const fromWeek = weekOffset(addDays(today, fromOffset), today);
  if (targetWeek === fromWeek) return fromOffset;
  const next = fromOffset + (targetWeek - fromWeek) * 7;
  const selected = addDays(today, next);
  if (weekStart(selected.getTime()).getTime() === weekStart(today.getTime()).getTime()) return 0;
  return next;
}

export function dayLine(offset: number): string {
  const today = startOfDay(Date.now());
  const selected = addDays(today, offset);
  const formatted = selected.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return formatted;
}

/** Week arrows jump seven days. Landing back in the current week opens today. */
export function shiftWeek(offset: number, direction: -1 | 1, now = Date.now()): number {
  const today = startOfDay(now);
  const fromWeek = weekOffset(addDays(today, offset), today);
  return offsetForWeek(offset, fromWeek + direction, now);
}

export function canLogDay(offset: number): boolean {
  const today = startOfDay(Date.now());
  const selected = addDays(today, offset);
  return weekOffset(selected, today) === 0 && selected.getTime() <= today.getTime();
}

/** Activities you plan (not one-offs), main sport first, for the activity-day prompt. */
export function plannedActivityNames(): string[] {
  return (engine.plannedActs() as string[]).map((id) => activityName(id));
}

export function showReminder(offset: number): boolean {
  const today = startOfDay(Date.now());
  const selected = addDays(today, offset);
  if (selected.getTime() < today.getTime()) return false;
  if (!isUsualActivityDay(selected)) return false;
  return activitySessionsOn(selected).length === 0;
}

export function showRest(offset: number): boolean {
  const today = startOfDay(Date.now());
  const selected = addDays(today, offset);
  if (selected.getTime() >= today.getTime()) return false;
  if (sessionsOn(selected).length) return false;
  const board = engine.dayBoard(offset) as { plannedId?: string | null; liftDone?: boolean };
  return !board.plannedId && !board.liftDone;
}

function rampOn(): boolean {
  return engine.hasSport() && !engine.inSeason() && engine.wk.ramp === "Yes";
}

export function chipIds(): string[] {
  const ids = (engine.ACT_IDS as string[]).filter((id) => id !== "lift" && engine.enabled(id));
  if (rampOn()) ids.push("zone2");
  return ids;
}

/** Every activity that is not already turned on. */
export function otherIds(): string[] {
  return (engine.ACT_IDS as string[]).filter((id) => id !== "lift" && !engine.enabled(id));
}

function actStorageKey(id: string): string {
  return id === "zone2" ? "zAct" : engine.actKey(id);
}

export function plannedOf(id: string): number {
  return id === "zone2" ? 1 : engine.cnt(id);
}

export function loggedOf(id: string): number {
  const slots = (engine.wk[actStorageKey(id)] || []) as unknown[];
  return slots.filter((value) => String(value ?? "").trim() !== "").length;
}

function stampTaken(t: number): boolean {
  return allSessions().some((session) => session.t === t);
}

/** Today uses the current time. Any other day uses noon, nudged so each log can be opened on its own. */
export function stampOn(day: Date, isToday: boolean): number {
  let t = isToday ? Date.now() : startOfDay(day.getTime()).getTime() + 12 * 60 * 60 * 1000;
  while (stampTaken(t)) t += 1;
  return t;
}

/** How far the minutes list is actually filled. Empty holes left by a delete do not raise the count. */
function filledLength(slots: unknown[]): number {
  let used = 0;
  for (let i = 0; i < slots.length; i++) {
    if (String(slots[i] ?? "").trim() !== "") used = i + 1;
  }
  return used;
}

export function logActivity(id: string, at: number): void {
  const key = actStorageKey(id);
  const slots = (engine.wk[key] || []) as unknown[];
  const planned = plannedOf(id);
  let index = -1;
  for (let i = 0; i < planned; i++) {
    if (String(slots[i] ?? "").trim() === "") {
      index = i;
      break;
    }
  }
  if (index < 0) index = Math.max(planned, filledLength(slots));
  const minutes = id === "zone2" ? 45 : engine.plannedMin(id);
  engine.logAct(key, index, String(minutes), at);
  if (usesSessionEffort(id)) {
    engine.wk.sessions = allSessions().map((item) =>
      item.t === at ? { ...item, eff: item.eff || "Moderate" } : item,
    );
  }
  engine.save();
}

/** Turn an activity on just for this log, then log it. Deleting the last session turns it off again. */
export function logOther(id: string, at: number): void {
  engine.wk.acts = { ...(engine.wk.acts || {}), [id]: true };
  engine.wk[id] = 0;
  engine.wk[actStorageKey(id)] = [];
  engine.wk.once = { ...(engine.wk.once || {}), [id]: true };
  engine.wk.adhoc = { ...(engine.wk.adhoc || {}), [id]: true };
  logActivity(id, at);
}

export function getSession(t: number): ActSession | null {
  return allSessions().find((session) => session.t === t) ?? null;
}

export function isRecent(t: number): boolean {
  return Date.now() - t < 15 * 60 * 1000;
}

export function writeSession(t: number, value: string): ActSession | null {
  const session = getSession(t);
  if (!session) return null;
  const [key, index, week] = String(session.src || "").split(":");
  const live = Boolean(session.src) && String(engine.wk.weekStart || 0) === week;
  const slot = Number(index);
  if (live && key && Number.isFinite(slot)) engine.logAct(key, slot, value);
  else if (value === "") engine.wk.sessions = allSessions().filter((item) => item.t !== t);
  else {
    engine.wk.sessions = allSessions().map((item) =>
      item.t === t ? { ...item, min: engine.num(value, 0) } : item,
    );
  }
  engine.save();
  return session;
}

export type SessionEdits = {
  minutes: string;
  intensity?: string;
  effort?: string;
  heated?: boolean;
};

export function setSessionEffort(t: number, effort: string): void {
  const session = getSession(t);
  if (!session || !usesSessionEffort(session.k)) return;
  engine.wk.sessions = allSessions().map((item) => (item.t === t ? { ...item, eff: effort } : item));
  engine.save();
}

function slotsStillLogged(id: string): boolean {
  const slots = (engine.wk[actStorageKey(id)] || []) as unknown[];
  return slots.some((value) => String(value ?? "").trim() !== "");
}

/** Remove the session. A one-off activity (logged from Other) is turned off once nothing of it remains this week. */
export function deleteSession(t: number): void {
  const session = getSession(t);
  if (!session) return;
  const id = session.k;
  writeSession(t, "");
  const once = { ...(engine.wk.once || {}) } as Record<string, boolean>;
  const adhoc = { ...(engine.wk.adhoc || {}) } as Record<string, boolean>;
  if (!once[id] && !adhoc[id]) return;
  if (slotsStillLogged(id)) return;
  engine.wk.acts = { ...(engine.wk.acts || {}), [id]: false };
  engine.wk[id] = 0;
  engine.wk[actStorageKey(id)] = [];
  delete once[id];
  delete adhoc[id];
  engine.wk.once = once;
  engine.wk.adhoc = adhoc;
  engine.fixSports(engine.wk);
  engine.save();
}

export function saveSession(t: number, edits: SessionEdits): void {
  const session = getSession(t);
  if (!session) return;
  if (usesSessionEffort(session.k) && edits.effort) {
    engine.wk.sessions = allSessions().map((item) => (item.t === t ? { ...item, eff: edits.effort } : item));
  }
  if (session.k === "spin" && edits.intensity) engine.wk.spint = edits.intensity;
  if (session.k === "yoga") {
    if (edits.effort) engine.wk.yeff = edits.effort;
    if (edits.heated != null) engine.wk.heated = edits.heated ? "Yes" : "No";
  }
  if (session.k === "pilates" && edits.effort) engine.wk.peff = edits.effort;
  writeSession(t, edits.minutes.trim() || "0");
}

export function spinIntensity(): string {
  return engine.wk.spint || "Hard";
}

export function effortFor(id: string): string {
  if (id === "pilates") return engine.wk.peff || "Moderate";
  return engine.wk.yeff || "Moderate";
}

export function heatedOn(): boolean {
  return engine.wk.heated === "Yes";
}

export function effortDescription(id: string, level: string): string {
  const yoga = id !== "pilates";
  if (level === copy.activities.light) return yoga ? copy.activities.yogaLight : copy.activities.pilatesLight;
  if (level === copy.activities.hard) return yoga ? copy.activities.yogaHard : copy.activities.pilatesHard;
  return yoga ? copy.activities.yogaModerate : copy.activities.pilatesModerate;
}

/** Activities still short of their weekly count, when yesterday is empty and in this week. */
export function yesterdayOpen(): string[] | null {
  if ((engine.wk.remind || "On") !== "On") return null;
  const today = startOfDay(Date.now());
  const yesterday = addDays(today, -1);
  if (weekStart(yesterday.getTime()).getTime() !== weekStart(today.getTime()).getTime()) return null;
  if (sessionsOn(yesterday).length) return null;
  if (engine.wk.remindSeen === dayKey(yesterday)) return null;
  const open = chipIds().filter((id) => loggedOf(id) < plannedOf(id));
  return open.length ? open : null;
}

export function answerYesterday(id: string | null): void {
  const yesterday = addDays(startOfDay(Date.now()), -1);
  engine.wk.remindSeen = dayKey(yesterday);
  if (id) logActivity(id, stampOn(yesterday, false));
  else engine.save();
}
