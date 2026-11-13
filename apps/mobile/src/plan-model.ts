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
/** Cap is the last old option. Mid is the fallback when no pace is saved. */
const PACE_CAP: Record<string, { max: number; mid: string }> = {
  "Deficit only": { max: 1, mid: "0.75" },
  Recomp: { max: 0.7, mid: "0.5" },
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
  pace: {
    shown: string;
    percent: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  } | null;
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

/** Keeps a saved percent. An empty pace becomes the goal's middle value; anything over the cap clamps to it. */
export function clampPace(mode: unknown, ratePct: unknown): string | undefined {
  const cap = PACE_CAP[String(mode)];
  if (!cap) return ratePct == null ? undefined : String(ratePct);
  const p = parseFloat(String(ratePct ?? ""));
  if (!(p > 0)) return cap.mid;
  if (p > cap.max) return String(cap.max);
  return String(ratePct);
}

export function fitPace() {
  const next = clampPace(engine.wk.mode, engine.wk.ratePct);
  if (next !== undefined && next !== String(engine.wk.ratePct ?? "")) engine.wk.ratePct = next;
}

function paceRange() {
  const cap = PACE_CAP[String(engine.wk.mode)];
  if (!cap) return null;
  const kg = isKg();
  const parsed = engine.num(engine.wk.weight, 150);
  const weight = parsed > 0 ? parsed : 150;
  const step = kg ? 0.05 : 0.1;
  const maxU = (cap.max / 100) * weight / (kg ? L2K : 1);
  const min = +(step * 2).toFixed(2);
  if (maxU < min - 1e-9) {
    const only = +maxU.toFixed(kg ? 2 : 1);
    return { kg, weight, step, min: only, max: only };
  }
  const count = Math.floor((maxU - min) / step + 1e-9);
  return { kg, weight, step, min, max: +(min + count * step).toFixed(4) };
}

function nearestStep(current: number, min: number, max: number, step: number) {
  const count = Math.round((max - min) / step);
  let best = min;
  let bestDist = Infinity;
  for (let i = 0; i <= count; i++) {
    const value = +(min + i * step).toFixed(4);
    const dist = Math.abs(value - current);
    if (dist < bestDist) {
      bestDist = dist;
      best = value;
    }
  }
  return best;
}

function formatStep(value: number, step: number) {
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return decimals ? String(+value.toFixed(decimals)) : String(Math.round(value));
}

/** Percent label for a pace amount in the current units. */
export function pacePercentLabel(unitText: string) {
  const n = parseFloat(unitText);
  const range = paceRange();
  if (!range || !Number.isFinite(n)) return "";
  const lb = n * (range.kg ? L2K : 1);
  return ((lb / range.weight) * 100).toFixed(2);
}

/**
 * Percent to store for a dial amount. Null when it is the step already
 * closest to the saved pace, so opening the dial and confirming does not move it.
 */
export function paceFromDial(unitText: string): string | null {
  const picked = parseFloat(unitText);
  const range = paceRange();
  if (!range || !Number.isFinite(picked)) return null;
  const stored = parseFloat(String(engine.wk.ratePct ?? ""));
  if (stored > 0) {
    const current = (stored / 100) * range.weight / (range.kg ? L2K : 1);
    const nearest = nearestStep(current, range.min, range.max, range.step);
    if (Math.abs(picked - nearest) < range.step * 0.01) return null;
  }
  const lb = picked * (range.kg ? L2K : 1);
  const next = String(+((lb / range.weight) * 100).toFixed(4));
  if (stored > 0 && Math.abs(stored - parseFloat(next)) < 5e-5) return null;
  return next;
}

function paceField() {
  const range = paceRange();
  if (!range) return null;
  const stored = parseFloat(String(engine.wk.ratePct ?? ""));
  const pct = stored > 0 ? stored : 0.5;
  const current = (pct / 100) * range.weight / (range.kg ? L2K : 1);
  return {
    shown: formatStep(current, range.step),
    percent: pct.toFixed(2),
    min: range.min,
    max: range.max,
    step: range.step,
    unit: range.kg ? copy.plan.kgPerWeek : copy.plan.lbPerWeek,
  };
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
    lossGoal: !!PACE_CAP[engine.wk.mode as string],
    showFocus: !!engine.enabled("lift"),
    pace: paceField(),
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
