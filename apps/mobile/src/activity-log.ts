import * as engine from "@liftboard/engine";
import { create } from "zustand";

import { copy } from "@/copy";

/** A logged session. Activities use k for the activity id; lifts use "lift". */
export type ActSession = {
  t: number;
  k: string;
  min?: number;
  src?: string;
};

export type StripDay = {
  offset: number;
  date: Date;
  letter: string;
  label: string;
  selected: boolean;
  today: boolean;
  past: boolean;
  lift: boolean;
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
  show: (lines: string[]) => void;
};

export const useNotice = create<NoticeState>((set) => ({
  lines: [],
  id: 0,
  show: (lines) => set((state) => ({ lines, id: state.id + 1 })),
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

function dateLabel(day: Date, lift: boolean, activity: boolean): string {
  const formatted = day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return `${formatted}${lift ? copy.workouts.liftDone : ""}${activity ? copy.workouts.activityMark : ""}`;
}

export function stripFor(selectedOffset: number): WeekStrip {
  const today = startOfDay(Date.now());
  const selected = addDays(today, selectedOffset);
  const start = weekStart(selected.getTime());
  const wOff = weekOffset(selected, today);
  const days: StripDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const offset = daysBetween(today, date);
    const logged = sessionsOn(date);
    const lift = logged.some((session) => session.k === "lift");
    const activity = logged.some((session) => session.k !== "lift");
    days.push({
      offset,
      date,
      letter: copy.weekdayLetters.charAt(mondayIndex(date)),
      label: dateLabel(date, lift, activity),
      selected: offset === selectedOffset,
      today: offset === 0,
      past: date.getTime() < today.getTime(),
      lift,
      activity,
      usual: !activity && offset >= 0 && isUsualActivityDay(date),
    });
  }
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

export function dayLine(offset: number): string {
  const today = startOfDay(Date.now());
  const selected = addDays(today, offset);
  const formatted = selected.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return offset === 0 ? `${copy.todayPrefix}${formatted}` : formatted;
}

/** Week arrows jump seven days. Landing back in the current week opens today. */
export function shiftWeek(offset: number, direction: -1 | 1): number {
  const next = offset + direction * 7;
  const today = startOfDay(Date.now());
  const selected = addDays(today, next);
  if (weekStart(selected.getTime()).getTime() === weekStart(today.getTime()).getTime()) return 0;
  return next;
}

export function canLogDay(offset: number): boolean {
  const today = startOfDay(Date.now());
  const selected = addDays(today, offset);
  return weekOffset(selected, today) === 0 && selected.getTime() <= today.getTime();
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
  if (index < 0) {
    index = Math.max(planned, slots.length);
    if (id !== "zone2") engine.wk[id] = index + 1;
  }
  const minutes = id === "zone2" ? 45 : engine.plannedMin(id);
  engine.logAct(key, index, String(minutes), at);
  engine.save();
}

/** Turn an activity on, then log it. Logging past the plan raises the weekly count. */
export function logOther(id: string, at: number): void {
  engine.wk.acts = { ...(engine.wk.acts || {}), [id]: true };
  engine.wk[id] = 0;
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

export function saveSession(t: number, edits: SessionEdits): void {
  const session = getSession(t);
  if (!session) return;
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
