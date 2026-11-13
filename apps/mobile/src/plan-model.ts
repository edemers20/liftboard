import * as engine from "@liftboard/engine";

import { copy, fill } from "./copy";

/**
 * Week placement and the "Your plan" sentence follow the web app.
 * Fuel, changes and watch notes come from engine.plan().
 */

const L2K = 2.20462;
const DAY = 864e5;
const LIFT_DEFAULTS: Record<number, number[]> = {
  0: [],
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};
const PACE: Record<string, string[]> = {
  "Deficit only": ["0.5", "0.75", "1"],
  Recomp: ["0.25", "0.5", "0.7"],
};

type Session = { t: number; k: string; id?: string; title?: string };
type Day = { id: string; title: string };

export type PlanPart = string | { key: string; text: string };

export type PlanRow = {
  id: string;
  kind: "lift" | "act";
  title: string;
  sub: string;
  status: "done" | "next" | "open";
  /** Logged activity session. Lift rows open by id. */
  openedAt?: number;
  /** Workouts day offset for an activity that is not logged yet. */
  dayOffset?: number;
};

export type PlanRead = {
  weekTitle: string;
  rows: PlanRow[];
  liftDays: number[];
  activityDays: number[];
  liftingOn: boolean;
  showCycle: boolean;
  checkInLine: string;
  ckDone: boolean;
  sentence: PlanPart[];
  seasonal: boolean;
  seasonNote: string | null;
  showRamp: boolean;
  showDeload: boolean;
  deloadFlag: string | null;
  inSeasonNow: boolean;
  lossGoal: boolean;
  showFocus: boolean;
  paces: { value: string; label: string }[];
  restFlag: string | null;
  finishedEarly: boolean;
  finishedNote: string | null;
  canUndoFinish: boolean;
  planHeading: string;
  changes: { cause: string; detail: string }[];
  watch: string[];
  recovery: { lower: number | null; upper: number | null };
  fuel: {
    today: string;
    base: string;
    vsText: string;
    vsTone: "up" | "down" | "flat";
    lossLabel: string;
    lossValue: string;
    lossUnit: string | null;
    explain: string;
    deficit: string | null;
    finishers: string | null;
  };
  form: {
    ready: string;
    sore: string;
    cycle: string;
    drink: string;
    weight: string;
    share: string;
    seasonOn: boolean;
    rampOn: boolean;
    deloadOn: boolean;
    mode: string;
    focus: string;
    ratePct: string;
  };
};

function isKg() {
  return engine.wk.units === "kg";
}

function day0(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number) {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + n);
  return next;
}

function monIdx(d: Date) {
  return (d.getDay() + 6) % 7;
}

function weekStartOf(t: number) {
  return engine.weekStartOf(t);
}

function grouped(n: number) {
  return n.toLocaleString("en-US");
}

export function weightForInput(stored: string) {
  if (!stored) return "";
  const n = parseFloat(stored);
  if (!Number.isFinite(n)) return stored;
  if (!isKg()) return String(n);
  return String(Math.round((n / L2K) * 10) / 10);
}

export function weightForStore(typed: string) {
  const value = typed.trim();
  if (!value) return "";
  const n = parseFloat(value);
  if (!isKg() || !Number.isFinite(n)) return value;
  return String(Math.round(n * L2K * 100) / 100);
}

export function migratePace() {
  const wk = engine.wk;
  if (wk.ratePct != null || wk.rate == null) return false;
  const pct = (engine.num(wk.rate, 0.5) / engine.num(wk.weight, 150)) * 100;
  const options = wk.mode === "Recomp" ? [0.25, 0.5, 0.7] : [0.5, 0.75, 1];
  wk.ratePct = String(
    options.reduce((best, option) => (Math.abs(option - pct) < Math.abs(best - pct) ? option : best)),
  );
  return true;
}

export function fitPace() {
  const options = PACE[engine.wk.mode as string];
  if (!options) return;
  if (!options.includes(String(engine.wk.ratePct))) engine.wk.ratePct = options[1];
}

function liftDayIndexes() {
  const count = engine.DAYS.length;
  const saved = engine.wk.ldays;
  if (Array.isArray(saved) && saved.length === count) return [...saved].sort((a: number, b: number) => a - b);
  return [...(LIFT_DEFAULTS[count] || [])];
}

function activityDayIndexes() {
  const saved = engine.wk.adays;
  return Array.isArray(saved) ? [...saved].sort((a: number, b: number) => a - b) : [];
}

function rampOn() {
  return engine.hasSport() && !engine.inSeason() && engine.wk.ramp === "Yes";
}

function activityIds(): string[] {
  const on = (engine.ACT_IDS as string[]).filter((id) => id !== "lift" && engine.enabled(id));
  return rampOn() ? [...on, "zone2"] : on;
}

function activityName(id: string) {
  if (id === "zone2") return copy.plan.zone2;
  return engine.ACT[id]?.name ?? id;
}

function plannedCount(id: string) {
  return id === "zone2" ? 1 : engine.cnt(id);
}

function loggedCount(id: string) {
  const key = id === "zone2" ? "zAct" : engine.actKey(id);
  const logged = engine.wk[key] || [];
  return logged.filter((value: unknown) => String(value ?? "").trim() !== "").length;
}

function weekdayShort(date: Date, today: Date) {
  const offset = Math.round((day0(date.getTime()).getTime() - today.getTime()) / DAY);
  if (offset === 0) return copy.plan.today;
  if (offset === 1) return copy.plan.tomorrow;
  return copy.plan.weekdays[monIdx(date)].slice(0, 3);
}

function planRows(days: Day[]): PlanRow[] {
  const today = day0(Date.now());
  const model = engine.weekModel(engine.planOff()) as {
    dates: number[];
    tIdx: number;
    byDay: Session[][];
    plan: Record<string, string>;
    todo: string[];
  };
  const dates = model.dates.map((stamp) => new Date(stamp));
  const sessions = model.byDay.flat();
  const todo = model.todo || [];
  const done = engine.wk.done || {};
  const rows: (PlanRow & { order: number })[] = [];
  days.forEach((day) => {
    if (!done[day.id]) return;
    const session = sessions.find((item) => item.k === "lift" && item.id === day.id);
    rows.push({
      order: session ? session.t : 0,
      id: day.id,
      kind: "lift",
      title: day.title,
      sub: session ? weekdayShort(new Date(session.t), today) : copy.plan.done,
      status: "done",
    });
  });
  todo.forEach((id, index) => {
    const day = days.find((item) => item.id === id);
    if (!day) return;
    const placedAt = Object.keys(model.plan).find((key) => model.plan[key] === id);
    const when = placedAt == null ? null : dates[Number(placedAt)];
    rows.push({
      order: when ? when.getTime() + 1 : 9e15 + index,
      id,
      kind: "lift",
      title: day.title,
      sub: when ? weekdayShort(when, today) : copy.plan.doesntFit,
      status: index === 0 ? "next" : "open",
    });
  });
  sessions
    .filter((session) => session.k !== "lift")
    .forEach((session) => {
      rows.push({
        order: session.t,
        id: session.k,
        kind: "act",
        title: activityName(session.k),
        sub: weekdayShort(new Date(session.t), today),
        status: "done",
        openedAt: session.t,
      });
    });
  const openActivityDays = dates
    .map((_date, index) => index)
    .filter(
      (index) =>
        index >= model.tIdx &&
        activityDayIndexes().includes(monIdx(dates[index])) &&
        !model.byDay[index].some((session) => session.k !== "lift"),
    );
  let slot = 0;
  activityIds().forEach((id) => {
    for (let count = loggedCount(id); count < plannedCount(id); count += 1) {
      const dayIndex = openActivityDays[slot];
      slot += 1;
      const when = dayIndex == null ? null : dates[dayIndex];
      rows.push({
        order: when ? when.getTime() + 2 : 9.5e15,
        id,
        kind: "act",
        title: activityName(id),
        sub: when ? weekdayShort(when, today) : copy.plan.anyDay,
        status: "open",
        dayOffset: when ? Math.round((day0(when.getTime()).getTime() - day0(Date.now()).getTime()) / DAY) : 0,
      });
    }
  });
  return rows.sort((a, b) => a.order - b.order).map(({ order: _order, ...row }) => row);
}

/** Hours until each half of the body is ready. A readout only; it does not change the plan. */
function recoveryHours() {
  const now = Date.now();
  const hour = 36e5;
  const extra = engine.wk.ready === "Low" ? 12 : 0;
  const until = { lower: 0, upper: 0 };
  const hit = (part: "lower" | "upper", at: number, hours: number) => {
    if (hours > 0) until[part] = Math.max(until[part], at + (hours + extra) * hour);
  };
  (engine.wk.sessions || [])
    .filter((session: Session) => now - session.t < 4 * DAY)
    .forEach((session: Session) => {
      if (session.k === "lift") {
        const title = String(session.title || "");
        if (/^Lower/.test(title)) hit("lower", session.t, 48);
        else if (/^Upper/.test(title)) hit("upper", session.t, 48);
        else {
          hit("lower", session.t, 36);
          hit("upper", session.t, 36);
        }
        return;
      }
      const activity = engine.ACT[session.k] || {};
      hit("lower", session.t, 24 * (activity.leg || 0));
      if (activity.sh || activity.pull) hit("upper", session.t, 24);
    });
  const left = (at: number) => {
    const hours = Math.ceil((at - now) / hour);
    return hours <= 0 ? null : hours;
  };
  return { lower: left(until.lower), upper: left(until.upper) };
}

function weekTitle() {
  const start = addDays(weekStartOf(Date.now()), engine.planOff() * 7);
  const end = addDays(start, 6);
  const label = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return start.getMonth() === end.getMonth() ? `${label(start)} \u2013 ${end.getDate()}` : `${label(start)} \u2013 ${label(end)}`;
}

function andList(items: string[]) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")}${copy.plan.sentence.and}${items[items.length - 1]}`;
}

function supportNames() {
  const sports: string[] = engine.seasonSports();
  const labels: Record<string, string> = {
    calves: copy.plan.support.calf,
    adductor: copy.plan.support.adductor,
    cuff: copy.plan.support.cuff,
  };
  return Object.keys(engine.SUP)
    .filter((key) => sports.some((sport) => engine.SUP[key].includes(sport)))
    .map((key) => labels[key])
    .filter((name): name is string => !!name);
}

function liftDaysText(count: number, inSeasonNow: boolean) {
  const sentence = copy.plan.sentence;
  const prefix = inSeasonNow ? `${sentence.fullBody} ` : "";
  return `${count} ${prefix}${sentence.liftDay}${count === 1 ? "" : "s"}`;
}

function planSentence(math: { intake: number; protein: number[]; cardioTarget: number }): PlanPart[] {
  const sentence = copy.plan.sentence;
  const inSeasonNow = engine.inSeason();
  const lifting = engine.enabled("lift");
  const count = engine.DAYS.length;
  const parts: PlanPart[] = [];
  const sport = engine.hasSport()
    ? engine
        .seasonSports()
        .map((id: string) => String(engine.ACT[id].name).toLowerCase())
        .join(sentence.and)
    : "";
  const days: PlanPart = { key: "days", text: liftDaysText(count, inSeasonNow) };

  if (lifting && !count) parts.push(sentence.noLift, { key: "aim", text: sentence.otherActivity }, sentence.period);
  if (lifting && count) {
    if (engine.wk.deload === "Yes") {
      parts.push(sentence.thisIs, { key: "deload", text: sentence.lighter }, sentence.about60, days, sentence.period);
    } else if (inSeasonNow) {
      const names = supportNames();
      parts.push(
        sentence.its,
        { key: "season", text: fill(sentence.sportSeason, [sport]) },
        sentence.soYoure,
        { key: "aim", text: sentence.holding },
        sentence.with,
        days,
        sentence.aWeek,
      );
      if (names.length) {
        parts.push(sentence.plusSupport, { key: "support", text: fill(sentence.supportWork, [andList(names)]) });
      }
      parts.push(sentence.period);
    } else {
      const focusText =
        engine.wk.focus === "Balanced" ? sentence.evenly : engine.wk.focus === "Upper" ? sentence.upper : sentence.lower;
      if (sport) {
        parts.push(
          sentence.itsYour,
          { key: "season", text: fill(sentence.offSeason, [sport]) },
          sentence.soYoure,
          { key: "aim", text: sentence.building },
          sentence.with,
          days,
          sentence.aWeek,
        );
      } else {
        parts.push(sentence.youre, { key: "aim", text: sentence.building }, sentence.with, days, sentence.aWeek);
      }
      parts.push(engine.wk.focus === "Balanced" ? sentence.working : sentence.focused, { key: "focus", text: focusText });
      if (rampOn()) parts.push(sentence.plusRamp, { key: "ramp", text: sentence.zone2Session }, sentence.readyFor);
      parts.push(sentence.period);
    }
  }

  const phrase =
    (
      {
        "Deficit only": sentence.loseFast,
        Recomp: sentence.loseKeep,
        Maintain: sentence.maintain,
        Build: sentence.build,
      } as Record<string, string>
    )[engine.wk.mode] || sentence.loseFat;
  parts.push(
    sentence.to,
    { key: "goal", text: phrase },
    sentence.fuelWith,
    { key: "eat", text: fill(sentence.calories, [grouped(engine.r5(math.intake))]) },
    sentence.and,
    { key: "protein", text: fill(sentence.protein, [math.protein[0], math.protein[1]]) },
    sentence.aDay,
  );
  if (math.cardioTarget > 0) {
    parts.push(
      sentence.andBurn,
      { key: "cardio", text: fill(sentence.calories, [grouped(engine.r5(math.cardioTarget))]) },
      sentence.inCardio,
    );
  }
  parts.push(sentence.end);
  return parts;
}

function checkInLine() {
  const wk = engine.wk;
  const sore =
    (
      {
        None: copy.plan.noSoreness,
        Legs: copy.plan.soreLegs,
        "Upper body": copy.plan.soreUpper,
        Everything: copy.plan.soreAll,
      } as Record<string, string>
    )[wk.sore] || "";
  const feeling = fill(copy.plan.feeling, [(wk.ready === "Low" ? copy.plan.low : copy.plan.normal).toLowerCase()]);
  const cycle =
    engine.fem() && wk.cycle && wk.cycle !== copy.plan.notTracking ? String(wk.cycle).toLowerCase() : "";
  const weight = wk.wAvg ? `${weightForInput(String(wk.wAvg))} ${isKg() ? copy.plan.kg : copy.plan.lb}` : "";
  return [feeling, sore, cycle, weight].filter(Boolean).join(", ");
}

function explain(math: {
  useOura: boolean;
  nLift: number;
  liftDay: number;
  bmr: number;
  base: number;
  stepsK: number;
  tef: number;
  calib: number;
}) {
  if (math.useOura) return copy.plan.wearable;
  const lifting = math.nLift ? ` ${fill(copy.plan.plusLifting, [engine.r5(math.liftDay)])}` : "";
  const calibrated = engine.wk.calibN
    ? fill(copy.plan.calibrated, [math.calib >= 0 ? "+" : "", engine.r5(math.calib), engine.wk.calibN])
    : "";
  return fill(copy.plan.baseExplainer, [
    engine.r5(math.bmr),
    engine.r5(math.base - math.bmr),
    engine.r5(math.stepsK),
    lifting,
    engine.r5(math.tef),
    calibrated,
  ]);
}

function ruleLines(rules: string[]) {
  return rules.map((html) => {
    const match = /^<b>([\s\S]*?)<\/b> → ([\s\S]*)$/.exec(html);
    if (!match) return { cause: "", detail: html.replace(/<[^>]+>/g, "") };
    return { cause: match[1], detail: match[2] };
  });
}

function paceChoices() {
  const options = PACE[engine.wk.mode as string];
  if (!options) return [];
  const weight = engine.num(engine.wk.weight, 150);
  const unit = isKg() ? copy.plan.kg : copy.plan.lb;
  return options.map((value) => {
    const pounds = Math.round((Number(value) / 100) * weight * 10) / 10;
    const shown = isKg() ? Math.round((pounds / L2K) * 10) / 10 : pounds;
    return { value, label: `${value}% \u00b7 ${shown} ${unit}` };
  });
}

function goalLabel(mode: string) {
  return copy.plan.goals.find((goal) => goal.value === mode)?.label ?? mode;
}

export function readPlan(): PlanRead {
  const planned = engine.plan();
  const days: Day[] = engine.DAYS.map((day: Day) => ({ id: day.id, title: day.title }));
  const math = planned.math;
  const build = engine.wk.mode === "Build" || engine.wk.mode === "Maintain";
  const vs = math.vsLast as number | null;
  const vsTone = vs == null || Math.abs(vs) < 5 ? "flat" : vs > 0 ? "up" : "down";
  const vsText =
    vsTone === "flat" ? copy.plan.same : fill(copy.plan.perDay, [vs! > 0 ? "+" : "\u2212", Math.abs(vs!)]);
  const unit = isKg() ? copy.plan.kg : copy.plan.lb;
  const lossAmount = isKg() ? Math.round((math.rateEff / L2K) * 100) / 100 : math.rateEff;
  const seasonal = engine.hasSport() && (engine.SPORTS as string[]).includes(engine.wk.mainSport);
  const inSeasonNow = engine.inSeason();
  const deloadWhy: string[] = engine.deloadInfo();
  const next = planned.nextId ? planned.days?.[planned.nextId] : null;
  const nextDay = days.find((day) => day.id === planned.nextId);

  return {
    weekTitle: weekTitle(),
    rows: planRows(days),
    finishedEarly: engine.earlyDone(),
    finishedNote: engine.earlyDone()
      ? fill(copy.plan.finishedNote, [
          new Date(engine.wk.weekStart).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        ])
      : null,
    canUndoFinish: engine.hasFinishSnap(),
    planHeading: engine.earlyDone() ? copy.plan.nextWeeksPlan : copy.plan.thisWeeksPlan,
    liftDays: liftDayIndexes(),
    activityDays: activityDayIndexes(),
    liftingOn: !!engine.enabled("lift"),
    showCycle: !!engine.fem(),
    checkInLine: checkInLine(),
    ckDone: !!engine.wk.ckDone,
    sentence: planSentence(math),
    seasonal,
    seasonNote: seasonal
      ? null
      : engine.hasSport()
        ? fill(copy.plan.noSeason, [engine.ACT[engine.wk.mainSport].name])
        : copy.plan.pickSport,
    showRamp: seasonal && !inSeasonNow,
    showDeload: days.length > 0,
    deloadFlag:
      deloadWhy.length && engine.wk.deload !== "Yes" ? fill(copy.plan.deloadSuggested, [deloadWhy.join(", ")]) : null,
    inSeasonNow,
    lossGoal: !!PACE[engine.wk.mode as string],
    showFocus: !!engine.enabled("lift"),
    paces: paceChoices(),
    restFlag: next?.restSuggest && nextDay ? fill(copy.plan.restBefore, [nextDay.title]) : null,
    changes: ruleLines(planned.rules || []),
    watch: planned.notes || [],
    recovery: recoveryHours(),
    fuel: {
      today: grouped(engine.r5(math.intake)),
      base: grouped(engine.r5(math.everyday)),
      vsText,
      vsTone,
      lossLabel: build ? copy.plan.goal : copy.plan.expectedLoss,
      lossValue: build ? goalLabel(engine.wk.mode) : String(lossAmount),
      lossUnit: build ? null : fill(copy.plan.perWeek, ["", unit]).trim(),
      explain: explain(math),
      deficit: build ? null : fill(copy.plan.kcal, [grouped(engine.r5(math.target))]),
      finishers: math.nLift && math.nFin ? fill(copy.plan.finishers, [math.m, math.nFin]) : null,
    },
    form: {
      ready: engine.wk.ready,
      sore: engine.wk.sore,
      cycle: engine.wk.cycle,
      drink: engine.wk.drink,
      weight: weightForInput(String(engine.wk.wAvg ?? "")),
      share: String(engine.wk.share ?? ""),
      seasonOn: engine.wk.season === "In-season",
      rampOn: engine.wk.ramp === "Yes",
      deloadOn: engine.wk.deload === "Yes",
      mode: engine.wk.mode,
      focus: engine.wk.focus,
      ratePct: String(engine.wk.ratePct ?? ""),
    },
  };
}
