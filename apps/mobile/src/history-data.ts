import {
  ACT,
  daySummary,
  exHist,
  isBW,
  liftTrends,
  num,
  plannedMin,
  recentPrs,
  weekActuals,
  weekCompleted,
  weekRuleAt,
  weekStreak,
  wk,
} from "@liftboard/engine";

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

export type MuscleBar = {
  name: string;
  done: number;
  planned: number;
};

export type HistoryWeek = {
  start: number;
  lifts: number;
  planned: number;
  sets: number;
  burn: number;
  completed: boolean;
  counted: boolean;
  miss: string[];
  /** Null when this week was closed before muscle sets were saved. */
  muscles: MuscleBar[] | null;
};

export type HistoryPr = {
  kind: "top" | "reps";
  name: string;
  weight: number;
  reps: number;
  t: number;
};

export type HistoryLiftWeek = {
  start: number;
  weight: number;
  reps: number;
  e1: number;
  pr: boolean;
};

export type HistoryLift = {
  name: string;
  e1: number;
  weight: number;
  reps: number;
  delta: number | null;
  series: number[];
  rows: HistoryLiftWeek[];
};

export type HistorySnapshot = {
  units: string;
  wkStart: string | undefined;
  hasSessions: boolean;
  days: Record<string, HistoryDay>;
  mix: WeekMix | null;
  /** Newest closed week first. */
  weeks: HistoryWeek[];
  /** Oldest of the recent closed weeks first. Green when that week counts toward the streak. */
  dots: boolean[];
  streak: number;
  prs: HistoryPr[];
  lifts: HistoryLift[];
};

type RawExercise = {
  n?: string;
  w?: number;
  r?: number;
  extra?: boolean;
  cardio?: boolean;
  min?: number;
  sets?: number;
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

  const weeks = ((wk.weeks || []) as Record<string, unknown>[])
    .slice()
    .sort((a, b) => num(b.start, 0) - num(a.start, 0))
    .map((week) => {
      const start = num(week.start, 0);
      const liftsDone = num(week.lifts, 0);
      const planned = num(week.planned, 0);
      const muscles = muscleBars(week.muscles);
      return {
        start,
        lifts: liftsDone,
        planned,
        sets: loggedSets(start, raw),
        burn: weekActuals(start).burn,
        completed: weekCompleted({ counted: week.counted === true, lifts: liftsDone, planned }),
        counted: !!week.counted && liftsDone < planned,
        miss: Array.isArray(week.miss) ? week.miss.filter((name): name is string => typeof name === "string" && name.length > 0) : [],
        muscles,
      };
    });

  const lifts: HistoryLift[] = liftTrends().map((trend) => {
    const rows = trend.rows.map((row) => ({
      start: row.start,
      weight: displayWeight(row.w, units),
      reps: row.r,
      e1: displayWeight(row.e1 ?? 0, units),
      pr: row.pr === "top" || row.pr === "reps",
    }));
    const last = rows[rows.length - 1];
    const first = rows[0];
    return {
      name: trend.name,
      e1: last?.e1 ?? 0,
      weight: last?.weight ?? 0,
      reps: last?.reps ?? 0,
      delta: rows.length > 1 && last && first ? last.e1 - first.e1 : null,
      series: rows.map((row) => row.e1),
      rows,
    };
  });

  const prs: HistoryPr[] = recentPrs()
    .slice(0, 12)
    .map((pr) => ({
      kind: pr.kind,
      name: pr.name,
      weight: displayWeight(pr.w, units),
      reps: pr.r,
      t: pr.t,
    }));

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
    dots: weeks
      .slice()
      .sort((a, b) => a.start - b.start)
      .slice(-12)
      .map((week) => week.completed),
    streak: weekStreak(),
    prs,
    lifts,
  };
}

function loggedSets(start: number, sessions: RawSession[]): number {
  const end = start + 7 * 864e5;
  let total = 0;
  for (const session of sessions) {
    const t = num(session.t, 0);
    if (session.k !== "lift" || t < start || t >= end) continue;
    for (const exercise of session.ex || []) {
      if (exercise.cardio) continue;
      const sets = num(exercise.sets, 0);
      total += sets > 0 ? sets : num(exercise.r, 0) > 0 ? 1 : 0;
    }
  }
  return total;
}

function muscleBars(value: unknown): MuscleBar[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map((row) => {
      const item = row as { name?: unknown; done?: unknown; planned?: unknown };
      return {
        name: typeof item.name === "string" ? item.name : "",
        done: num(item.done, 0),
        planned: num(item.planned, 0),
      };
    })
    .filter((row) => row.name && (row.done > 0 || row.planned > 0));
  return rows.length ? rows : null;
}
