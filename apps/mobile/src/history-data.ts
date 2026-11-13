import { ACT, daySummary, exHist, isBW, num, plannedMin, weekActuals, weekRuleAt, wk } from "@liftboard/engine";

import { copy } from "@/copy";
import {
  buildWeekMix,
  dayKey,
  displayWeight,
  type MixKind,
  type WeekMix,
} from "@/history-model";

export type SessionExercise = {
  name: string;
  extra: boolean;
  cardio: boolean;
  minutes: number;
  weight: number;
  reps: number;
  bodyweight: boolean;
};

export type HistorySession = {
  t: number;
  lift: boolean;
  name: string;
  short: string;
  minutes: number;
  exercises: SessionExercise[];
  /** Logged activity. Opens the activity editor. */
  openActivity?: number;
};

export type DayKind = "lift" | "act" | "both";

export type HistoryDay = {
  kind: DayKind;
  sessions: HistorySession[];
};

export type PastWeek = {
  start: number;
  weightLb: number | null;
  lifts: number;
  planned: number;
  sport: number;
  cardio: number;
  season: string;
  ramp: boolean;
  deload: boolean;
  goal: string;
  focus: string;
};

export type LiftTrend = {
  name: string;
  weights: number[];
  latest: number;
  delta: number | null;
};

export type HistorySnapshot = {
  units: string;
  wkStart: string | undefined;
  hasSessions: boolean;
  days: Record<string, HistoryDay>;
  mix: WeekMix | null;
  weeks: PastWeek[];
  lifts: LiftTrend[];
};

type RawExercise = {
  n?: string;
  w?: number;
  r?: number;
  extra?: boolean;
  cardio?: boolean;
  min?: number;
};

type RawSession = {
  t?: number;
  k?: string;
  id?: string;
  title?: string;
  min?: number;
  ex?: RawExercise[];
};

function activityName(id: string): string {
  if (id === "zone2") return copy.history.zone2;
  if ("activityNames" in copy) {
    const table = copy.activityNames as Record<string, string>;
    if (table[id]) return table[id];
  }
  const act = ACT[id] as { name?: string } | undefined;
  return act?.name ? String(act.name) : id;
}

function sessionName(session: RawSession): string {
  if (session.k === "lift") return session.title || copy.history.lift;
  if (session.k === "zone2") return copy.history.zone2;
  return activityName(session.k || "");
}

function shortName(session: RawSession): string {
  if (session.k !== "lift") return sessionName(session);
  const title = session.title || "";
  if (title && title !== copy.history.lift) return title.split(" · ").pop() || copy.history.lift;
  return copy.history.lift;
}

function asExercise(row: RawExercise): SessionExercise | null {
  if (!row.n) return null;
  const cardio = !!row.cardio;
  return {
    name: row.n,
    extra: !!row.extra,
    cardio,
    minutes: num(row.min, 0),
    weight: num(row.w, 0),
    reps: num(row.r, 0),
    bodyweight: !cardio && !!isBW(row.n),
  };
}

function exercisesFor(session: RawSession): SessionExercise[] {
  const own = (session.ex || []).slice();
  const doneAt = session.id ? (wk.doneT || {})[session.id] : undefined;
  if (!own.length && session.id && doneAt === session.t) {
    const live = (daySummary(session.id) || []) as RawExercise[];
    if (live.length) return live.map(asExercise).filter((row): row is SessionExercise => !!row);
  }
  const listed = new Set(own.map((row) => row.n));
  const fromHist: RawExercise[] = [];
  Object.entries(exHist as Record<string, { t?: number; w?: number; r?: number }[]>).forEach(([name, points]) => {
    const hit = (points || []).find((point) => point.t === session.t);
    if (hit && !listed.has(name)) fromHist.push({ n: name, w: hit.w, r: hit.r });
  });
  return own.concat(fromHist).map(asExercise).filter((row): row is SessionExercise => !!row);
}

function mixKind(session: RawSession): MixKind {
  if (session.k === "lift") return "lift";
  if (session.k === "zone2") return "cardio";
  const act = ACT[session.k || ""] as { sport?: number; cls?: number } | undefined;
  if (act?.sport) return "sport";
  if (act?.cls) return "cls";
  return "cardio";
}

function mixMinutes(session: RawSession): number {
  if (session.k === "lift") return num(session.min, 0) || num(wk.time, 60);
  return num(session.min, 0) || (ACT[session.k || ""] ? plannedMin(session.k) : 45);
}

function goalName(mode: string | undefined): string {
  const goals = copy.history.goals;
  if (mode && Object.prototype.hasOwnProperty.call(goals, mode)) return goals[mode as keyof typeof goals];
  return mode || "";
}

function dayKind(sessions: HistorySession[]): DayKind {
  const lift = sessions.some((session) => session.lift);
  const activity = sessions.some((session) => !session.lift);
  if (lift && activity) return "both";
  return lift ? "lift" : "act";
}

export function readHistory(now = Date.now()): HistorySnapshot {
  const units = wk.units === "kg" ? "kg" : "lb";
  const raw = ((wk.sessions || []) as RawSession[]).slice().sort((a, b) => num(a.t, 0) - num(b.t, 0));
  const days: Record<string, HistoryDay> = {};
  const sessions: HistorySession[] = raw.map((session) => {
    const lift = session.k === "lift";
    const t = num(session.t, 0);
    return {
      t,
      lift,
      name: sessionName(session),
      short: shortName(session),
      minutes: num(session.min, 0),
      exercises: lift ? exercisesFor(session) : [],
      openActivity: !lift && t ? t : undefined,
    };
  });
  sessions.forEach((session) => {
    const key = dayKey(session.t);
    const day = days[key] || { kind: "act" as DayKind, sessions: [] };
    day.sessions.push(session);
    days[key] = day;
  });
  Object.values(days).forEach((day) => {
    day.kind = dayKind(day.sessions);
  });

  const weeks = ((wk.weeks || []) as Record<string, unknown>[]).slice().reverse().map((week) => {
    const start = num(week.start, 0);
    const actual = weekActuals(start);
    const fromLog = actual.n > 0;
    return {
    start,
    weightLb: week.w ? num(week.w, 0) : null,
    lifts: num(week.lifts, 0),
    planned: num(week.planned, 0),
    sport: fromLog ? actual.sport : num(week.sport ?? week.pickle, 0),
    cardio: fromLog ? actual.burn : num(week.cardio, 0),
    season: String(week.season || ""),
    ramp: !!week.ramp,
    deload: !!week.deload,
    goal: goalName(typeof week.mode === "string" ? week.mode : undefined),
    focus: typeof week.focus === "string" ? week.focus : "",
  };
  });

  const lifts: LiftTrend[] = Object.keys(exHist as Record<string, { w?: number }[]>)
    .filter((name) => ((exHist as Record<string, unknown[]>)[name] || []).length)
    .map((name) => {
      const points = (exHist as Record<string, { w?: number }[]>)[name] || [];
      const weights = points.map((point) => num(point.w, 0));
      const shown = weights.map((weight) => displayWeight(weight, units));
      const latest = shown[shown.length - 1] ?? 0;
      return {
        name,
        weights,
        latest,
        delta: shown.length > 1 ? latest - (shown[0] ?? 0) : null,
      };
    });

  return {
    units,
    wkStart: weekRuleAt(now),
    hasSessions: sessions.length > 0,
    days,
    mix: sessions.length
      ? buildWeekMix(
          raw.map((session) => ({ t: num(session.t, 0), kind: mixKind(session), minutes: mixMinutes(session) })),
          now,
          weekRuleAt(now),
        )
      : null,
    weeks,
    lifts,
  };
}
