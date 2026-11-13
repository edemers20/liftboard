import { copy } from "@/copy";
import { clampPace } from "@/plan-model";
import { engine } from "@/store";
import { fromDisplay, toDisplay } from "@/units";

/** Answers collected during onboarding. Nothing is written to settings until finish. */
export type Draft = {
  step: number;
  setupDone: boolean;
  demoLevel: 0 | 1 | 2;
  demoTouched: boolean;
  sport: string;
  /** Second sport from You. A replay keeps it even when its weekly count is 0. */
  sport2: string;
  inSeason: boolean;
  goal: "Deficit only" | "Recomp" | "Maintain" | "Build";
  days: number[];
  sportCount: number;
  activities: Record<string, number>;
  focus: "Lower" | "Balanced" | "Upper";
  level: "new" | "some" | "years";
  sex: "Female" | "Male" | "Other";
  age: string;
  height: string;
  weight: string;
  bodyFat: string;
  steps: string;
};

export type PlanPreview = {
  days: { id: string; title: string }[];
  food: number;
};

export type PlanRow = { label: string; value: string; mono?: boolean };

const LDEF: Record<number, number[]> = {
  0: [],
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function currentDays(wk: { ldays?: number[]; days?: number }): number[] {
  const count = engine.DAYS.length;
  const saved = Array.isArray(wk.ldays) ? wk.ldays : null;
  if (saved && saved.length === count) return saved.slice().sort((a, b) => a - b);
  return (LDEF[count] || []).slice();
}

/** Classes always, plus anything else already on, except the sport being chosen. */
export function activityIds(sport: string): string[] {
  return engine.ACT_IDS.filter(
    (id: string) => id !== "lift" && id !== sport && (engine.ACT[id].cls || engine.enabled(id)),
  );
}

export function activityLabel(id: string): string {
  const sport = copy.onboarding.sports.find((item) => item.id === id);
  if (sport) return sport.label;
  if (id === "spin") return copy.onboarding.spin;
  return engine.ACT[id]?.name ?? id;
}

export function isSeasonal(id: string): boolean {
  return engine.SPORTS.includes(id);
}

export function usesKg(): boolean {
  return engine.wk.units === "kg";
}

export function toDisplayWeight(pounds: string): string {
  if (!usesKg() || pounds.trim() === "" || Number.isNaN(Number(pounds))) return pounds;
  return String(toDisplay(Number(pounds)));
}

export function fromDisplayWeight(value: string): string {
  return fromDisplay(value);
}

export function weightUnit(): string {
  return usesKg() ? copy.onboarding.kg : copy.onboarding.lb;
}

function textOrEmpty(value: unknown): string {
  if (value === 0 || value === "0") return "0";
  return value ? String(value) : "";
}

export function createDraft(): Draft {
  const wk = engine.wk;
  const mains = [...engine.SPORTS, "yoga", "pilates"];
  const sport = mains.includes(wk.mainSport) ? String(wk.mainSport) : "";
  const sport2 = mains.includes(wk.sport2) && wk.sport2 !== sport ? String(wk.sport2) : "";
  const setupDone = !!wk.setupDone;
  const activities: Record<string, number> = {};
  for (const id of activityIds(sport)) {
    activities[id] = engine.enabled(id) ? engine.cnt(id) : 0;
  }
  if (sport2) {
    const stored = parseInt(wk[sport2], 10);
    if (activities[sport2] == null || (!engine.enabled(sport2) && Number.isFinite(stored))) {
      activities[sport2] = Number.isFinite(stored) ? stored : 0;
    }
  }
  const level = wk.level || (wk.guide === "Less" ? "years" : "some");
  return {
    step: setupDone ? 1 : 0,
    setupDone,
    demoLevel: 1,
    demoTouched: false,
    sport,
    sport2,
    inSeason: wk.season === "In-season",
    goal: wk.mode || "Recomp",
    days: setupDone ? currentDays(wk) : [0, 2, 4],
    sportCount: sport ? engine.cnt(sport) || 2 : 0,
    activities,
    focus: wk.focus || "Balanced",
    level,
    sex: wk.sex || "Female",
    age: textOrEmpty(wk.age),
    height: textOrEmpty(wk.height),
    weight: textOrEmpty(wk.weight),
    bodyFat: textOrEmpty(wk.bf),
    steps: textOrEmpty(wk.steps),
  };
}

export function chooseSport(draft: Draft, sport: string): Draft {
  let sportCount = draft.sportCount;
  let inSeason = draft.inSeason;
  if (!sport) inSeason = false;
  if (sport && draft.activities[sport]) sportCount = draft.activities[sport];
  if (sport && !sportCount) sportCount = engine.cnt(sport) || 2;
  const sport2 = sport && sport === draft.sport2 ? "" : draft.sport2;
  return { ...draft, sport, sport2, inSeason, sportCount };
}

export function toggleInSeason(draft: Draft): Draft {
  const inSeason = !draft.inSeason;
  const days = inSeason && draft.days.length > 3 ? draft.days.slice(0, 3) : draft.days;
  return { ...draft, inSeason, days };
}

/** Returns a toast flag when in-season already has three lift days. */
export function toggleDay(draft: Draft, day: number): { draft: Draft; limited: boolean } {
  const on = draft.days.includes(day);
  if (!on && draft.inSeason && draft.days.length >= 3) return { draft, limited: true };
  const days = (on ? draft.days.filter((item) => item !== day) : draft.days.concat(day)).sort((a, b) => a - b);
  return { draft: { ...draft, days }, limited: false };
}

export function clampCount(value: number): number {
  return Math.max(0, Math.min(7, value));
}

export type StepperRow = { id: string; name: string; value: number; kind: "sport" | "other" };

export function stepperRows(draft: Draft): StepperRow[] {
  const rows: StepperRow[] = [];
  if (draft.sport) {
    rows.push({ id: draft.sport, name: activityLabel(draft.sport), value: draft.sportCount, kind: "sport" });
  }
  for (const id of activityIds(draft.sport)) {
    rows.push({ id, name: activityLabel(id), value: draft.activities[id] || 0, kind: "other" });
  }
  return rows;
}

function goalLabel(id: Draft["goal"]): string {
  return copy.onboarding.goals.find((goal) => goal.id === id)?.label ?? id;
}

function levelLabel(id: Draft["level"]): string {
  return copy.onboarding.levels.find((level) => level.id === id)?.label ?? id;
}

function focusLabel(focus: Draft["focus"]): string {
  if (focus === "Upper") return copy.onboarding.upperBody;
  if (focus === "Lower") return copy.onboarding.lowerBody;
  return copy.onboarding.balanced;
}

export function weekSummary(draft: Draft): string {
  let line = copy.onboarding.liftCount(draft.days.length);
  if (draft.sport && draft.sportCount) {
    line += ` + ${draft.sportCount}× ${activityLabel(draft.sport).toLowerCase()}`;
  }
  for (const [id, count] of Object.entries(draft.activities)) {
    if (!count || id === draft.sport) continue;
    line += ` + ${count}× ${activityLabel(id).toLowerCase()}`;
  }
  return line;
}

function seasonRow(draft: Draft): PlanRow {
  const seasonal = !!draft.sport && isSeasonal(draft.sport);
  const label = draft.sport && !seasonal ? copy.onboarding.mainActivity : copy.onboarding.season;
  if (!draft.sport) return { label, value: copy.onboarding.noSport };
  const name = activityLabel(draft.sport);
  const value = seasonal
    ? `${name} · ${draft.inSeason ? copy.onboarding.inSeasonWord : copy.onboarding.offSeasonWord}`
    : name;
  return { label, value };
}

export function planRows(draft: Draft, food: number | null): PlanRow[] {
  const reached = draft.step - 2;
  const rows: PlanRow[] = [seasonRow(draft)];
  if (reached >= 2) rows.push({ label: copy.onboarding.goal, value: goalLabel(draft.goal) });
  if (reached >= 3) rows.push({ label: copy.onboarding.week, value: weekSummary(draft) });
  if (reached >= 4) rows.push({ label: copy.onboarding.focus, value: focusLabel(draft.focus) });
  if (reached >= 5) rows.push({ label: copy.onboarding.guidance, value: levelLabel(draft.level) });
  if (reached >= 6 && food != null) {
    rows.push({
      label: copy.onboarding.fuel,
      value: copy.onboarding.kcalADay(food.toLocaleString("en-US")),
      mono: true,
    });
  }
  return rows;
}

export type WeekItem = { key: string; title: string; when: string; activity: boolean };

export function firstWorkout(draft: Draft, preview: PlanPreview): { eyebrow: string; title: string; rest: WeekItem[] } {
  const today = (new Date().getDay() + 6) % 7;
  const days = draft.days.slice().sort((a, b) => a - b);
  const next = days.find((day) => day >= today) ?? days[0];
  const order = days.filter((day) => day >= today).concat(days.filter((day) => day < today));
  const titles = preview.days;
  const rest: WeekItem[] = order.slice(1).map((day, index) => ({
    key: `lift-${day}`,
    title: titles.length ? titles[(index + 1) % titles.length]?.title || copy.onboarding.lift : copy.onboarding.lift,
    when: copy.weekdays[day] ?? "",
    activity: false,
  }));
  const add = (id: string, count: number) => {
    if (!id || !count) return;
    rest.push({
      key: `act-${id}`,
      title: copy.onboarding.withCount(activityLabel(id), count),
      when: copy.onboarding.anyDay,
      activity: true,
    });
  };
  add(draft.sport, draft.sportCount);
  for (const [id, count] of Object.entries(draft.activities)) {
    if (id !== draft.sport) add(id, count);
  }
  const when = titles.length && next != null
    ? next === today
      ? copy.onboarding.today
      : copy.weekdays[next] ?? copy.onboarding.whenever
    : copy.onboarding.whenever;
  return {
    eyebrow: copy.onboarding.firstWorkout(when),
    title: titles.length ? titles[0]?.title || copy.onboarding.logActivity : copy.onboarding.logActivity,
    rest,
  };
}

function fitPace(wk: { mode?: string; ratePct?: string }) {
  const next = clampPace(wk.mode, wk.ratePct);
  if (next !== undefined) wk.ratePct = next;
}

function weekStartMs(time: number, weekStart: unknown): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  const back = weekStart === "Sun" ? date.getDay() : (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return date.getTime();
}

/**
 * Writes answers onto the engine week. Replaces wk.acts with the picked
 * activities so earlier activities are not merged in. The second sport from You
 * stays on, including when its weekly count is 0. Logs and history stay.
 */
function writeAnswers(wk: Record<string, any>, draft: Draft, real: boolean) {
  wk.acts = { lift: true };
  if (draft.sport) {
    wk.acts[draft.sport] = true;
    wk[draft.sport] = draft.sportCount;
  }
  wk.mainSport = draft.sport;
  wk.season = draft.sport && draft.inSeason && isSeasonal(draft.sport) ? "In-season" : "Off-season";
  for (const [id, count] of Object.entries(draft.activities)) {
    if (id === draft.sport) continue;
    if (count > 0) {
      wk.acts[id] = true;
      wk[id] = count;
    }
  }
  const second = draft.sport && draft.sport2 && draft.sport2 !== draft.sport ? draft.sport2 : "";
  if (second) {
    wk.acts[second] = true;
    wk[second] = draft.activities[second] ?? 0;
    wk.sport2 = second;
  } else {
    wk.sport2 = "";
  }
  wk.level = draft.level;
  wk.guide = draft.level === "years" ? "Less" : "More";
  wk.mode = draft.goal;
  wk.ldays = draft.days.slice().sort((a, b) => a - b);
  wk.days = draft.days.length;
  wk.focus = draft.focus;
  wk.sex = draft.sex;
  const bio: Record<string, string> = {
    age: draft.age,
    height: draft.height,
    weight: draft.weight,
    bf: draft.bodyFat,
    steps: draft.steps,
  };
  for (const [key, value] of Object.entries(bio)) {
    if (value.trim() !== "") wk[key] = value;
  }
  engine.fixSports(wk);
  engine.syncDays();
  fitPace(wk);
  if (real) {
    wk.createdAt = wk.createdAt || Date.now();
    if (!wk.setupDone) {
      wk.setupDone = true;
      wk.weekStart = weekStartMs(Date.now(), wk.wkStart);
    }
    wk.tourDone = true;
    wk.onbDone = true;
    engine.save();
  }
}

/** Runs the engine on these answers, then puts the saved week back. */
export function previewOnboarding(draft: Draft): PlanPreview {
  const snap = JSON.stringify(engine.wk);
  try {
    writeAnswers(engine.wk, draft, false);
    const planned = engine.plan();
    return {
      days: engine.DAYS.map((day: { id: string; title: string }) => ({ id: day.id, title: day.title })),
      food: engine.r5(planned.math.intake),
    };
  } finally {
    const restored = JSON.parse(snap) as Record<string, unknown>;
    for (const key of Object.keys(engine.wk)) delete engine.wk[key];
    Object.assign(engine.wk, restored);
    engine.syncDays();
    engine.save();
  }
}

export function finishOnboarding(draft: Draft) {
  writeAnswers(engine.wk, draft, true);
}

export function skipOnboarding() {
  engine.wk.onbDone = true;
  engine.save();
}
